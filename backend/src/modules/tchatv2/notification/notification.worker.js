'use strict';

const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const { sendPushToUser } = require('./notification.service');
const { shouldDeliver } = require('./userSettings.service');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const prefix    = process.env.ENV === 'dev' ? 'dev:bull' : 'bull';

const queueConn = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const notifQueue = new Queue('tchatv2-notifications', { connection: queueConn, prefix });

let _worker = null;

/**
 * Job data shape:
 * {
 *   type: 'mention' | 'dm',
 *   recipientIds: number[],
 *   messageId: string,
 *   channelId: string,
 *   guildId: string,
 *   authorUsername: string,
 *   contentPreview: string,
 * }
 */
async function runJob(job) {
    const { type, recipientIds, messageId, channelId, guildId, authorUsername, contentPreview } = job.data;

    if (!recipientIds || !recipientIds.length) return;

    const isMention = type === 'mention';
    const isDm      = type === 'dm';

    const allowed = [];
    for (const uid of recipientIds) {
        try {
            const ok = await shouldDeliver(uid, channelId, { isMention });
            if (ok) allowed.push(uid);
        } catch {
            allowed.push(uid);
        }
    }
    if (!allowed.length) return;

    for (const uid of allowed) {
        const payload = {
            title: isMention
                ? `${authorUsername} vous a mentionné`
                : isDm
                    ? `Nouveau message de ${authorUsername}`
                    : `Nouveau message`,
            body: (contentPreview || '').slice(0, 100),
            url: guildId
                ? `/chat/${guildId}/${channelId}`
                : `/chat/dm/${channelId}`,
            messageId,
            channelId,
            guildId: guildId || null,
            type,
        };

        await sendPushToUser(uid, payload).catch(() => {});
    }
}

function startNotificationWorker() {
    if (_worker) return _worker;

    const workerConn = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

    _worker = new Worker('tchatv2-notifications', runJob, {
        connection: workerConn,
        concurrency: 3,
        prefix,
    });

    _worker.on('failed', (job, err) => {
        console.error(`[tchatv2-notifications] job ${job?.id} failed: ${err?.message}`);
    });

    console.log('[tchatv2-notifications] Worker démarré');
    return _worker;
}

async function scheduleNotificationJob(data) {
    await notifQueue.add('push', data, {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
    });
}

module.exports = { startNotificationWorker, scheduleNotificationJob, notifQueue };
