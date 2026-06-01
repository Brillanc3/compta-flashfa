'use strict';

const repo = require('./ban.repository');
const { banMember, unbanMember } = require('./ban.service');

async function list(req, reply) {
    const { limit, before } = req.query;
    const bans = await repo.findBans(req.params.guildId, {
        limit: limit ? Number(limit) : 100,
        before: before ?? undefined,
    });
    return reply.send(bans);
}

async function create(req, reply) {
    try {
        await banMember(req.params.guildId, req.params.userId, req.user.id, req.body);
        return reply.code(204).send();
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function destroy(req, reply) {
    try {
        await unbanMember(req.params.guildId, req.params.userId, req.user.id);
        return reply.code(204).send();
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

module.exports = { list, create, destroy };
