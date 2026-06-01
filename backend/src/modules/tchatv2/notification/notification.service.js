'use strict';

const webpush = require('web-push');
const { prisma } = require('../../../shards/database');

// Init VAPID une seule fois
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
    );
} else {
    console.warn('[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY manquants — push désactivé');
}

async function subscribe(userId, { endpoint, p256dh, auth, deviceType = 'web' }) {
    const uid = Number(userId);

    // Cap à 10 subscriptions par user — LRU eviction si dépassé
    const count = await prisma.v2PushSubscription.count({ where: { userId: uid } });
    if (count >= 10) {
        const oldest = await prisma.v2PushSubscription.findFirst({
            where: { userId: uid },
            orderBy: { lastUsedAt: 'asc' },
        });
        if (oldest) await prisma.v2PushSubscription.delete({ where: { id: oldest.id } });
    }

    return prisma.v2PushSubscription.upsert({
        where: { userId_endpoint: { userId: uid, endpoint } },
        create: { userId: uid, endpoint, p256dh, auth, deviceType },
        update: { p256dh, auth, lastUsedAt: new Date() },
    });
}

async function unsubscribe(userId, endpoint) {
    await prisma.v2PushSubscription.deleteMany({
        where: { userId: Number(userId), endpoint },
    });
}

async function sendPushToUser(userId, payload) {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return [];

    const subs = await prisma.v2PushSubscription.findMany({
        where: { userId: Number(userId) },
    });
    if (!subs.length) return [];

    const results = await Promise.allSettled(
        subs.map(sub =>
            webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                JSON.stringify(payload),
            ).catch(async err => {
                // 410 Gone = subscription expirée, supprimer
                if (err.statusCode === 410) {
                    await prisma.v2PushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
                }
                throw err;
            })
        )
    );
    return results;
}

module.exports = { subscribe, unsubscribe, sendPushToUser };
