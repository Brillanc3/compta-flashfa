/**
 * Global WebSocket Gateway
 * - Connexions persistantes
 * - Auth JWT accessToken
 * - Sessions / Rooms
 * - Heartbeat / Resume
 */

'use strict';

require('dotenv').config();
const Fastify = require('fastify');
const websocket = require('@fastify/websocket');
const { redis } = require('../shards/redisClient');
const setupGateway = require('../core/gateway/gateway.server');
const WEBSOCKET_PORT = Number(process.env.WEBSOCKET_PORT || 9091);

async function buildApp() {
    const app = Fastify({
        logger: false,
        trustProxy: true,
    });

    // IMPORTANT: await = le plugin websocket DOIT être prêt AVANT d'enregistrer la route
    await app.register(websocket);

    // Monter le Gateway (routes WS)
    setupGateway(app, { path: '/ws/gateway' });

    // Vérifier que la route existe bien
    await app.ready();

    const routes = app.printRoutes();

    return app;
}

async function start() {
    const app = await buildApp();

    try {
        await redis.set('gateway:status', 'booting');

        await app.listen({ port: WEBSOCKET_PORT, host: '0.0.0.0' });

        await redis.set('gateway:status', 'ok');
        await redis.set('gateway:port', WEBSOCKET_PORT);
        await redis.set('gateway:pid', process.pid);

        console.log(`[GATEWAY] ✅ Listening on 0.0.0.0:${WEBSOCKET_PORT}`);
    } catch (err) {
        console.error('[GATEWAY] 💥 Startup error:', err);
        try { await redis.set('gateway:status', 'error'); } catch { }
        process.exit(1);
    }

    const shutdown = async (signal) => {
        console.log(`[GATEWAY] 🧹 Shutdown via ${signal}`);
        try {
            await redis.set('gateway:status', 'stopped');
            await redis.del('gateway:pid');
            await app.close().catch(() => { });
            await redis.quit().catch(() => { });
        } catch (e) {
            console.error('[GATEWAY] ❌ Shutdown error:', e);
        } finally {
            process.exit(0);
        }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
