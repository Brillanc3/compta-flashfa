'use strict';

const { prisma } = require('../../../../shards/database');

const ALLOWED_STATUSES = new Set(['online', 'idle', 'dnd']);

/**
 * PRESENCE_UPDATE (client → server) : changer le status affiché (idle, dnd, online).
 * Broadcast aux guilds du user.
 */
function registerPresenceHandlers(socket, v2) {
    const { setChosenStatus } = require('../presence.service');

    socket.on('PRESENCE_UPDATE', async ({ status } = {}) => {
        if (!ALLOWED_STATUSES.has(status)) return;
        try {
            await setChosenStatus(socket.userId, status);

            const memberships = await prisma.v2Member.findMany({
                where:  { userId: Number(socket.userId) },
                select: { guildId: true },
            });
            const payload = { userId: String(socket.userId), status };
            for (const { guildId } of memberships) {
                v2.to(`guild:${String(guildId)}`).emit('PRESENCE_UPDATE', payload);
            }
        } catch {}
    });
}

module.exports = { registerPresenceHandlers };
