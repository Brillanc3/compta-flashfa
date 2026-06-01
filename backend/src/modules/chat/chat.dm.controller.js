'use strict';

const dmService = require('./chat.dm.service');

exports.listConversations = async (req, reply) => {
    const userId = req.user.userId;
    const convs = await dmService.listConversations(userId);
    return reply.send(convs);
};

exports.getOrCreateConversation = async (req, reply) => {
    const userId = req.user.userId;
    const targetUserId = req.params.targetUserId;
    if (!targetUserId) return reply.code(400).send({ error: 'targetUserId required' });

    const conv = await dmService.getOrCreateConversation(userId, targetUserId);
    return reply.send(conv);
};

exports.getMessages = async (req, reply) => {
    const userId = req.user.userId;
    const conversationId = req.params.conversationId;

    try {
        const msgs = await dmService.getConversationMessages(userId, conversationId);
        return reply.send(msgs);
    } catch (err) {
        return reply.code(403).send({ error: err.message });
    }
};

exports.postMessage = async (req, reply) => {
    const userId = req.user.userId;
    const conversationId = req.params.conversationId;
    const { content } = req.body;

    if (!content || !content.trim()) {
        return reply.code(400).send({ error: 'Content required' });
    }

    try {
        const msg = await dmService.postMessage(userId, conversationId, content);
        return reply.send(msg);
    } catch (err) {
        return reply.code(403).send({ error: err.message });
    }
};
