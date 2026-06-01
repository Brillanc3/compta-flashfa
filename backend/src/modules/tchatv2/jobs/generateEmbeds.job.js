'use strict';

const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const dns = require('dns').promises;
const { prisma } = require('../../../shards/database');
const { nextV2 } = require('../lib/snowflake');
const { redis } = require('../../../shards/redisClient');
const emitter = require('../sockets/socket.emitter');
const { MESSAGE_SELECT } = require('../message/message.repository');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const prefix = process.env.ENV === 'dev' ? 'dev:bull' : 'bull';

const PRIVATE_IP_RANGES = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fc[0-9a-f]{2}:/i,
    /^fd[0-9a-f]{2}:/i,
];

function isPrivateIp(ip) {
    return PRIVATE_IP_RANGES.some(r => r.test(ip));
}

async function isSsrfSafe(url) {
    try {
        const { hostname } = new URL(url);
        const addresses = await dns.resolve4(hostname).catch(() => []);
        const addresses6 = await dns.resolve6(hostname).catch(() => []);
        const all = [...addresses, ...addresses6];
        if (all.length === 0) return false;
        return !all.some(isPrivateIp);
    } catch {
        return false;
    }
}

let _worker = null;

function startEmbedWorker() {
    if (_worker) return _worker;

    const workerConn = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

    _worker = new Worker('tchatv2-embeds', async (job) => {
        const { url, messageId } = job.data;

        // Cache check — évite de rescraper la même URL
        const cacheKey = `v2:og:${Buffer.from(url).toString('base64').slice(0, 64)}`;
        const cached = await redis.get(cacheKey);

        let ogData;
        if (cached) {
            ogData = JSON.parse(cached);
        } else {
            if (!await isSsrfSafe(url)) {
                return { skipped: true, reason: 'ssrf' };
            }

            const ogs = require('open-graph-scraper');
            const { result, error } = await ogs({ url, timeout: 5000 });
            if (error || !result?.ogTitle) return { skipped: true, reason: 'no-og' };

            ogData = {
                title:       result.ogTitle        || null,
                description: result.ogDescription  || null,
                imageUrl:    result.ogImage?.[0]?.url || null,
                url,
            };

            await redis.set(cacheKey, JSON.stringify(ogData), 'EX', 86400);
        }

        // Vérifier que le message existe encore
        const msg = await prisma.v2Message.findUnique({
            where: { id: BigInt(messageId) },
            select: { id: true, channelId: true },
        });
        if (!msg) return { skipped: true, reason: 'message-deleted' };

        // Créer l'embed
        await prisma.v2Embed.create({
            data: {
                id:          nextV2(),
                messageId:   BigInt(messageId),
                type:        'rich',
                url:         ogData.url,
                title:       ogData.title,
                description: ogData.description,
                imageUrl:    ogData.imageUrl,
            },
        });

        // Broadcast MESSAGE_UPDATE pour rafraîchir les embeds côté client
        const updated = await prisma.v2Message.findUnique({
            where: { id: BigInt(messageId) },
            select: MESSAGE_SELECT,
        });
        if (updated) emitter.messageUpdate(String(msg.channelId), updated);

        return { success: true };
    }, { connection: workerConn, concurrency: 3, prefix });

    _worker.on('failed', (job, err) => {
        console.error(`[tchatv2:embeds] job ${job?.id} failed: ${err?.message}`);
    });

    console.log('[tchatv2:embeds] Worker démarré');
    return _worker;
}

module.exports = { startEmbedWorker };
