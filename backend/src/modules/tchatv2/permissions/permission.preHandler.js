'use strict';

const { hasPermission, Permission } = require('../tchatv2.constants');
const { getChannelPermissions, getGuildPermissions } = require('./permission.cache');

/**
 * Factory retournant un preHandler Fastify qui vérifie une permission.
 *
 * Usage :
 *   fastify.post('/channels/:channelId/messages',
 *     { preHandler: requirePermission('SEND_MESSAGES') },
 *     handler)
 *
 * En scope 'channel' : attend req.params.channelId + req.params.guildId
 * En scope 'guild'   : attend req.params.guildId
 *
 * @param {string|bigint} flag  Clé de Permission ou valeur bigint
 * @param {'channel'|'guild'} scope
 * @returns {Function} preHandler async (req, reply) => void
 */
function requirePermission(flag, scope = 'channel') {
    const flagBit = typeof flag === 'string' ? Permission[flag] : BigInt(flag);
    if (!flagBit) throw new Error(`requirePermission: unknown flag "${flag}"`);

    return async function permissionPreHandler(req, reply) {
        const userId = req.user?.id;
        if (!userId) {
            return reply.code(401).send({ code: 0, message: 'Unauthorized' });
        }

        let perms;

        if (scope === 'channel') {
            const channelId = req.params.channelId;
            const guildId   = req.params.guildId;
            if (!channelId || !guildId) {
                return reply.code(400).send({ code: 0, message: 'Missing channelId or guildId' });
            }
            perms = await getChannelPermissions(channelId, guildId, userId);
        } else {
            const guildId = req.params.guildId;
            if (!guildId) {
                return reply.code(400).send({ code: 0, message: 'Missing guildId' });
            }
            perms = await getGuildPermissions(guildId, userId);
        }

        req.perms = perms;

        if (!hasPermission(perms, flagBit)) {
            return reply.code(403).send({ code: 50013, message: 'Missing Permissions' });
        }
    };
}

module.exports = { requirePermission };
