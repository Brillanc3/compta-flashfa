'use strict';

const repo = require('./channel.repository');
const { createChannel, updateChannel, deleteChannel, reorderChannels } = require('./channel.service');
const audit = require('../moderation/audit.service');
const { AuditLogActionType } = require('../tchatv2.constants');

async function list(req, reply) {
    const channels = await repo.findByGuild(req.params.guildId);
    return reply.send(channels);
}

async function getOne(req, reply) {
    const channel = await repo.findById(req.params.channelId);
    if (!channel) return reply.code(404).send({ code: 10003, message: 'Unknown Channel' });
    return reply.send(channel);
}

async function create(req, reply) {
    try {
        const channel = await createChannel(req.params.guildId, req.body);
        audit.log({ guildId: req.params.guildId, actorId: req.user.id, targetId: channel.id, actionType: AuditLogActionType.CHANNEL_CREATE });
        return reply.code(201).send(channel);
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function update(req, reply) {
    try {
        const existing = await repo.findById(req.params.channelId);
        if (!existing) return reply.code(404).send({ code: 10003, message: 'Unknown Channel' });
        const channel = await updateChannel(req.params.channelId, req.body);
        audit.log({ guildId: req.params.guildId, actorId: req.user.id, targetId: req.params.channelId, actionType: AuditLogActionType.CHANNEL_UPDATE, changes: req.body });
        return reply.send(channel);
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function destroy(req, reply) {
    try {
        const existing = await repo.findById(req.params.channelId);
        if (!existing) return reply.code(404).send({ code: 10003, message: 'Unknown Channel' });
        await deleteChannel(req.params.channelId);
        audit.log({ guildId: req.params.guildId, actorId: req.user.id, targetId: req.params.channelId, actionType: AuditLogActionType.CHANNEL_DELETE });
        return reply.code(204).send();
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function reorder(req, reply) {
    try {
        await reorderChannels(req.params.guildId, req.body);
        return reply.code(204).send();
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

module.exports = { list, getOne, create, update, destroy, reorder };
