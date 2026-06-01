'use strict';

const { prisma } = require('../../../shards/database');
const { redis }  = require('../../../shards/redisClient');
const { hasPermission, Permission } = require('../tchatv2.constants');

/**
 * Fastify preHandler : applique le slow mode du channel.
 * Doit être placé après requirePermission (pour que req.perms soit disponible).
 */
async function slowMode(req, reply) {
    const { channelId } = req.params;
    if (!channelId) return;

    const channel = await prisma.v2Channel.findUnique({
        where:  { id: BigInt(channelId) },
        select: { rateLimitPerUser: true },
    });
    if (!channel || channel.rateLimitPerUser === 0) return;

    const perms = req.perms ?? 0n;
    if (
        hasPermission(perms, Permission.MANAGE_MESSAGES) ||
        hasPermission(perms, Permission.MANAGE_CHANNELS)
    ) return;

    const userId = req.user.id;
    const k      = `v2:slow:${channelId}:${userId}`;
    const set    = await redis.set(k, '1', 'NX', 'EX', channel.rateLimitPerUser);

    if (!set) {
        const ttl = await redis.ttl(k);
        return reply.code(429).send({
            code:        20016,
            message:     'Slow mode is enabled in this channel',
            retry_after: ttl > 0 ? ttl : channel.rateLimitPerUser,
        });
    }
}

module.exports = { slowMode };
