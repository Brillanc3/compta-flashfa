'use strict';

const { prisma }  = require('../../../../shards/database');
const { canView } = require('../../permissions/permission.cache');

/**
 * À la connexion : join user room + tous les guild rooms.
 * CHANNEL_FOCUS / CHANNEL_BLUR : gestion des channel rooms.
 */
async function registerSubscriptionHandlers(socket, v2) {
    socket.join(`user:${socket.userId}`);

    try {
        const memberships = await prisma.v2Member.findMany({
            where:  { userId: Number(socket.userId) },
            select: { guildId: true },
        });
        for (const { guildId } of memberships) {
            socket.join(`guild:${String(guildId)}`);
        }
    } catch (e) {
        console.error('[tchatv2/subscription] join guilds error:', e.message);
    }

    const pendingFocus = new Set();

    socket.on('CHANNEL_FOCUS', async ({ channelId, guildId } = {}) => {
        if (!channelId) return;
        if (pendingFocus.has(channelId)) return;
        pendingFocus.add(channelId);
        try {
            // DM focus: guildId absent → vérifier membership DM
            if (!guildId) {
                const r = await prisma.v2DmRecipient.findUnique({
                    where: { channelId_userId: { channelId: BigInt(channelId), userId: Number(socket.userId) } },
                    select: { id: true, hiddenAt: true },
                }).catch(() => null);
                if (!pendingFocus.has(channelId)) return;
                if (!r || r.hiddenAt) return;
                socket.join(`channel:${channelId}`);
                return;
            }
            const ok = await canView(channelId, guildId, socket.userId);
            // If CHANNEL_BLUR arrived while canView was pending, abort join
            if (!pendingFocus.has(channelId)) return;
            if (!ok) return;
            socket.join(`channel:${channelId}`);
        } catch {} finally {
            pendingFocus.delete(channelId);
        }
    });

    socket.on('CHANNEL_BLUR', ({ channelId } = {}) => {
        if (!channelId) return;
        pendingFocus.delete(channelId); // annule un FOCUS en cours pour ce channel
        socket.leave(`channel:${channelId}`);
    });
}

module.exports = { registerSubscriptionHandlers };
