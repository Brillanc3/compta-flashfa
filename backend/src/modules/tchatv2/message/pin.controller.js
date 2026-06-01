'use strict';

const svc = require('./pin.service');

async function list(req, reply) {
    const pins = await svc.getPins(req.params.channelId);
    return reply.send(pins);
}

async function pin(req, reply) {
    const { channelId, messageId } = req.params;
    await svc.pinMessage(channelId, messageId, req.user.id);
    return reply.code(204).send();
}

async function unpin(req, reply) {
    const { channelId, messageId } = req.params;
    await svc.unpinMessage(channelId, messageId);
    return reply.code(204).send();
}

module.exports = { list, pin, unpin };
