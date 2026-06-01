'use strict';

const service = require('./search.service');

async function search(req, reply) {
    const { guildId } = req.params;
    const { q, in: channelId, from, before, after, limit = 25, cursor } = req.query;

    const result = await service.searchMessages({
        guildId,
        userId: req.user.id,
        q,
        channelId: channelId || null,
        fromUserId: from || null,
        before: before || null,
        after: after || null,
        limit: Math.min(Number(limit), 25),
        cursor: cursor || null,
    });

    return reply.send(result);
}

module.exports = { search };
