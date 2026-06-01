'use strict';

const { Server }        = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt               = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_par_defaut';
const metrics    = require('../monitoring/metrics');

/**
 * Initialise le serveur Socket.io V2 sur le même httpServer que Fastify.
 * Namespace /v2 avec Redis adapter pour le cross-shard.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @returns {import('socket.io').Server}
 */
function initV2Sockets(fastify) {
    const { redis } = require('../../../shards/redisClient');

    // Subscriber Redis dédié — un subscriber ne peut pas émettre d'autres commandes
    const pubClient = redis;
    const subClient = redis.duplicate();

    const io = new Server(fastify.server, {
        path: '/socket.io/v2',
        cors: {
            origin:      process.env.CORS_ORIGIN || 'https://react.jipeg-corporation.eu',
            credentials: true,
        },
        transports: ['websocket'],
    });

    io.adapter(createAdapter(pubClient, subClient));

    const v2 = io.of('/v2');

    // ── Auth middleware JWT ────────────────────────────────────────────────────
    v2.use((socket, next) => {
        const raw = socket.handshake.auth?.token ||
            (socket.handshake.headers.authorization || '').replace('Bearer ', '');
        if (!raw) return next(new Error('AUTH_FAILED'));
        try {
            const decoded = jwt.verify(raw, JWT_SECRET);
            if (decoded.type !== 'access') return next(new Error('AUTH_FAILED'));
            socket.userId = decoded.userId;
            next();
        } catch {
            next(new Error('AUTH_FAILED'));
        }
    });

    // Initialiser le singleton emitter avec le namespace
    const emitter = require('./socket.emitter');
    emitter.init(v2);

    const { registerSubscriptionHandlers } = require('./handlers/subscription.handler');
    const { registerTypingHandlers }       = require('./handlers/typing.handler');
    const { registerPresenceHandlers }     = require('./handlers/presence.handler');
    const presenceService                  = require('./presence.service');

    v2.on('connection', async (socket) => {
        metrics.incWsConns();
        await presenceService.setOnline(socket.userId, socket.id);

        registerSubscriptionHandlers(socket, v2);
        registerTypingHandlers(socket, v2);
        registerPresenceHandlers(socket, v2);

        socket.on('disconnect', async () => {
            metrics.decWsConns();
            await presenceService.setOffline(socket.userId, socket.id, v2);
        });
    });

    return io;
}

module.exports = { initV2Sockets };
