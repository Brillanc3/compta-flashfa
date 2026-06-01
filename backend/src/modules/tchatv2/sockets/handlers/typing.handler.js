'use strict';

const { redis }   = require('../../../../shards/redisClient');
const { canSend } = require('../../permissions/permission.cache');

/**
 * TYPING_START — throttle Redis NX EX 5s, puis broadcast aux autres clients du channel.
 */
function registerTypingHandlers(socket, v2) {
    socket.on('TYPING_START', async ({ channelId, guildId } = {}) => {
        if (!channelId || !guildId) return;
        try {
            const ok = await canSend(channelId, guildId, socket.userId);
            if (!ok) return;

            // SET NX EX 5 — une seule émission toutes les 5s par user/channel
            const key = `v2:typing:${channelId}:${socket.userId}`;
            const set = await redis.set(key, '1', 'NX', 'EX', 5);
            if (!set) return;

            // socket.to(...) exclut l'émetteur
            socket.to(`channel:${channelId}`).emit('TYPING_START', {
                channelId: String(channelId),
                userId:    String(socket.userId),
            });
        } catch {}
    });
}

module.exports = { registerTypingHandlers };
