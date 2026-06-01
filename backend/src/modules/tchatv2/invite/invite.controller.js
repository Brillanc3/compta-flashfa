'use strict';

const repo = require('./invite.repository');
const { createInvite, createGuildInvite, useInvite } = require('./invite.service');

async function create(req, reply) {
    try {
        const invite = await createInvite(req.params.channelId, req.user.id, req.body);
        return reply.code(201).send(invite);
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function getByCode(req, reply) {
    const invite = await repo.findByCode(req.params.code, { includeRelations: true });
    if (!invite) return reply.code(404).send({ code: 10006, message: 'Unknown Invite' });
    if (invite.expiresAt && invite.expiresAt < new Date()) {
        return reply.code(410).send({ code: 10006, message: 'Invite Expired' });
    }
    return reply.send(invite);
}

async function join(req, reply) {
    try {
        const guild = await useInvite(req.params.code, req.user.id);
        return reply.send(guild);
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function listByChannel(req, reply) {
    const invites = await repo.findByChannel(req.params.channelId);
    return reply.send(invites);
}

async function createForGuild(req, reply) {
    try {
        const invite = await createGuildInvite(req.params.guildId, req.user.id, req.body);
        return reply.code(201).send(invite);
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function listByGuild(req, reply) {
    const invites = await repo.findByGuild(req.params.guildId);
    return reply.send(invites);
}

async function destroy(req, reply) {
    const invite = await repo.findByCode(req.params.code);
    if (!invite) return reply.code(404).send({ code: 10006, message: 'Unknown Invite' });
    await repo.remove(req.params.code);
    return reply.code(204).send();
}

module.exports = { create, getByCode, join, listByChannel, destroy, createForGuild, listByGuild };
