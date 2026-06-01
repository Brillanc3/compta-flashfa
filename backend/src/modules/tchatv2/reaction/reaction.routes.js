'use strict';

const ctrl = require('./reaction.controller');
const { requirePermission } = require('../permissions/permission.preHandler');
const { rateLimit } = require('../middlewares/rateLimit.middleware');

const rlReaction = rateLimit({
    key:      (req) => `v2:rl:react:${req.user?.id}`,
    windowMs: 10_000,
    limit:    20,
});

// P0.3 — Whitelist emoji : Unicode pictographique (+ ZWJ sequences) ou custom `<:name:id>`/`<a:name:id>`.
// Refuse toute injection arbitraire (XSS, DoS via payload long, pollution UI).
const EMOJI_REGEX = /^(?:(?:\p{Extended_Pictographic}(?:️)?)(?:‍\p{Extended_Pictographic}(?:️)?)*|<a?:[a-zA-Z0-9_]{2,32}:[0-9]+>)$/u;

async function validateEmojiParam(req, reply) {
    let emoji = req.params?.emoji;
    if (typeof emoji !== 'string' || emoji.length === 0 || emoji.length > 128) {
        return reply.code(400).send({ code: 50035, message: 'Invalid emoji' });
    }
    // Fastify décode déjà les URL params, mais double-décodage parfois nécessaire pour clients buggy
    try { emoji = decodeURIComponent(emoji); } catch { /* déjà décodé */ }
    if (!EMOJI_REGEX.test(emoji)) {
        return reply.code(400).send({ code: 50035, message: 'Invalid emoji format' });
    }
    req.params.emoji = emoji;
}

const reactionParams = {
    type: 'object',
    required: ['guildId', 'channelId', 'messageId', 'emoji'],
    properties: {
        guildId: { type: 'string' },
        channelId: { type: 'string' },
        messageId: { type: 'string' },
        emoji: { type: 'string' },
    },
};

const listQuery = {
    type: 'object',
    properties: {
        after: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
    },
};

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    // PUT /guilds/:guildId/channels/:channelId/messages/:messageId/reactions/:emoji/@me
    fastify.put('/guilds/:guildId/channels/:channelId/messages/:messageId/reactions/:emoji/@me', {
        schema: { params: reactionParams },
        preHandler: [validateEmojiParam, requirePermission('ADD_REACTIONS'), rlReaction],
    }, ctrl.add);

    // DELETE .../@me
    fastify.delete('/guilds/:guildId/channels/:channelId/messages/:messageId/reactions/:emoji/@me', {
        schema: { params: reactionParams },
        preHandler: [validateEmojiParam, requirePermission('VIEW_CHANNEL')],
    }, ctrl.removeSelf);

    // DELETE .../reactions/:emoji/:userId (MANAGE_MESSAGES)
    fastify.delete('/guilds/:guildId/channels/:channelId/messages/:messageId/reactions/:emoji/:userId', {
        preHandler: [validateEmojiParam, requirePermission('MANAGE_MESSAGES')],
    }, ctrl.removeUser);

    // GET .../reactions/:emoji — liste des users
    fastify.get('/guilds/:guildId/channels/:channelId/messages/:messageId/reactions/:emoji', {
        schema: { params: reactionParams, querystring: listQuery },
        preHandler: [validateEmojiParam, requirePermission('READ_MESSAGE_HISTORY')],
    }, ctrl.list);

    // DELETE .../reactions — tout supprimer (MANAGE_MESSAGES)
    fastify.delete('/guilds/:guildId/channels/:channelId/messages/:messageId/reactions', {
        preHandler: [requirePermission('MANAGE_MESSAGES')],
    }, ctrl.removeAll);

    // DELETE .../reactions/:emoji — supprimer un emoji (MANAGE_MESSAGES)
    fastify.delete('/guilds/:guildId/channels/:channelId/messages/:messageId/reactions-emoji/:emoji', {
        schema: { params: reactionParams },
        preHandler: [validateEmojiParam, requirePermission('MANAGE_MESSAGES')],
    }, ctrl.removeEmoji);
}

module.exports = { routes };
