'use strict';

const service = require('./webhook.service');
const repo = require('./webhook.repository');

async function create(req, reply) {
    const { channelId, guildId } = req.params;
    const { name, avatarHash } = req.body;
    const webhook = await service.createWebhook({
        channelId, guildId,
        userId: req.user.id,
        name, avatarHash,
        perms: req.perms,
    });
    return reply.code(201).send(webhook);
}

async function listByChannel(req, reply) {
    const { channelId } = req.params;
    const webhooks = await repo.findByChannel(channelId);
    return reply.send(webhooks);
}

async function listByGuild(req, reply) {
    const { guildId } = req.params;
    const webhooks = await repo.findByGuild(guildId);
    return reply.send(webhooks);
}

async function execute(req, reply) {
    const { webhookId, token } = req.params;
    const body = req.body || {};
    const { content, username, avatarUrl, avatar_url, tts, embeds, attachmentIds } = body;
    const msg = await service.executeWebhook({
        webhookId, token, content, username,
        avatarUrl: avatarUrl || avatar_url,
        tts, embeds, attachmentIds,
        rawBody:          req.rawBody,
        signatureHeader:  req.headers['x-webhook-signature'],
        timestampHeader:  req.headers['x-webhook-timestamp'],
    });
    return reply.code(200).send(msg);
}

async function destroy(req, reply) {
    const { guildId, webhookId } = req.params;
    await service.deleteWebhook({
        webhookId, guildId,
        userId: req.user.id,
        perms: req.perms,
    });
    return reply.code(204).send();
}

module.exports = { create, listByChannel, listByGuild, execute, destroy };
