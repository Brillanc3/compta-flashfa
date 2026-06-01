'use strict';

const crypto = require('crypto');
const { prisma } = require('../../../shards/database');
const repo = require('./webhook.repository');
const { nextV2 } = require('../lib/snowflake');
const { Permission, hasPermission } = require('../tchatv2.constants');
const { getChannelPermissions } = require('../permissions/permission.cache');
const { redis } = require('../../../shards/redisClient');
const msgRepo  = require('../message/message.repository');
const emitter  = require('../sockets/socket.emitter');
const audit   = require('../moderation/audit.service');
const { AuditLogActionType } = require('../tchatv2.constants');

const WEBHOOK_FLAG = 64; // 1 << 6

function err(msg, status, code) {
    const e = new Error(msg);
    e.statusCode = status;
    e.code = code;
    return e;
}

function rateLimitKey(webhookId) {
    return `v2:wh:rl:${webhookId}`;
}

async function createWebhook({ channelId, guildId, userId, name, avatarHash, perms }) {
    const p = perms ?? await getChannelPermissions(channelId, guildId, userId);
    if (!hasPermission(p, Permission.MANAGE_WEBHOOKS)) throw err('Missing Permissions', 403, 50013);

    const token         = crypto.randomBytes(32).toString('hex'); // 64 chars
    const signingSecret = crypto.randomBytes(32).toString('hex'); // P0.2 — HMAC secret
    const webhook = await repo.create({
        id: nextV2(),
        guildId: BigInt(guildId),
        channelId: BigInt(channelId),
        name,
        avatarHash: avatarHash || null,
        token,
        signingSecret,
        createdBy: Number(userId),
    });

    audit.log({
        guildId,
        actorId:    userId,
        targetId:   webhook.id,
        actionType: AuditLogActionType.WEBHOOK_CREATE,
    });

    return webhook;
}

const SIG_MAX_SKEW_MS = 5 * 60 * 1000; // 5 min

// Comparaison de tokens en temps constant (timing-safe).
function safeEqualHex(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch {
        return false;
    }
}

// P0.2 — Vérifie HMAC-SHA256(`${ts}.${rawBody}`) avec secret webhook.
// Headers attendus : x-webhook-signature (hex), x-webhook-timestamp (ms epoch).
function verifyWebhookSignature(secret, rawBody, signatureHeader, timestampHeader) {
    if (!signatureHeader || !timestampHeader) return false;
    const ts = Number(timestampHeader);
    if (!Number.isFinite(ts)) return false;
    if (Math.abs(Date.now() - ts) > SIG_MAX_SKEW_MS) return false;

    const payload  = `${timestampHeader}.${rawBody ?? ''}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return safeEqualHex(expected, String(signatureHeader));
}

async function executeWebhook({ webhookId, token, content, username, avatarUrl, tts, embeds = [], attachmentIds = [], rawBody, signatureHeader, timestampHeader }) {
    const webhook = await repo.findById(webhookId);
    if (!webhook || !safeEqualHex(webhook.token, token)) throw err('Unknown Webhook', 404, 10015);

    // Si les headers HMAC sont présents, on vérifie la signature.
    // Si absents, on accepte (token seul suffit) — compatibilité outils externes (Postman, etc.).
    if (webhook.signingSecret && (signatureHeader || timestampHeader)) {
        const ok = verifyWebhookSignature(webhook.signingSecret, rawBody, signatureHeader, timestampHeader);
        if (!ok) throw err('Invalid webhook signature', 401, 50014);
    }

    // Rate limit : 30 msg / 60s
    const rlKey = rateLimitKey(String(webhookId));
    const count = await redis.incr(rlKey);
    if (count === 1) await redis.expire(rlKey, 60);
    if (count > 30) throw err('You are being rate limited', 429, 20029);

    const channel = await prisma.v2Channel.findUnique({
        where: { id: webhook.channelId },
        select: { id: true, guildId: true },
    });
    if (!channel) throw err('Channel not found', 404, 10003);

    const messageId = nextV2();
    const msg = await prisma.v2Message.create({
        data: {
            id: messageId,
            channelId: webhook.channelId,
            authorId: webhook.createdBy,
            content: content || '',
            flags: WEBHOOK_FLAG,
            authorUsername:   username   || webhook.name,
            authorAvatarHash: avatarUrl  || webhook.avatarHash || null,
            authorNickname:   null,
            mentionsJson: '{}',
        },
        select: msgRepo.MESSAGE_SELECT,
    });

    await prisma.v2Channel.update({
        where: { id: webhook.channelId },
        data: { lastMessageId: messageId },
    });

    if (embeds.length > 0) {
        const embedRows = embeds.map((e) => ({
            id:           nextV2(),
            messageId,
            type:         e.type || 'rich',
            url:          e.url          || null,
            title:        e.title        || null,
            description:  e.description  || null,
            color:        e.color        ?? null,
            imageUrl:     e.image?.url   || null,
            thumbnailUrl: e.thumbnail?.url || null,
            authorName:   e.author?.name || null,
            authorUrl:    e.author?.url  || null,
            footerText:   e.footer?.text || null,
            rawJson:      JSON.stringify(e),
        }));
        await prisma.v2Embed.createMany({ data: embedRows });
        msg.embeds = embedRows.map(r => ({
            id: r.id, type: r.type, url: r.url, title: r.title,
            description: r.description, color: r.color,
            imageUrl: r.imageUrl, thumbnailUrl: r.thumbnailUrl,
            authorName: r.authorName, authorUrl: r.authorUrl,
            footerText: r.footerText, rawJson: r.rawJson,
        }));
    }

    msgRepo.invalidateLastMsgCache(String(webhook.channelId));
    const broadcast = await msgRepo.hydrateOne(msg, null);
    emitter.messageCreate(String(channel.id), String(channel.guildId), broadcast);
    return msg;
}

async function deleteWebhook({ webhookId, guildId, userId, perms }) {
    const webhook = await repo.findById(webhookId);
    if (!webhook) throw err('Unknown Webhook', 404, 10015);

    const p = perms ?? await getChannelPermissions(String(webhook.channelId), String(guildId), userId);
    if (!hasPermission(p, Permission.MANAGE_WEBHOOKS)) throw err('Missing Permissions', 403, 50013);

    await repo.remove(webhookId);
}

module.exports = { createWebhook, executeWebhook, deleteWebhook, WEBHOOK_FLAG };
