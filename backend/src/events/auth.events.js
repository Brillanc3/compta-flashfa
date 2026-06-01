// backend/src/events/auth.events.js

const jwt = require('jsonwebtoken');
const eventBus = require('../lib/eventBusRedis');

// ⚠️ Unification avec le service d'auth
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_par_defaut';

/**
 * Route SSE : /api/auth/events?token=<JWT>
 */
async function authEventsRoute(fastify) {
    fastify.get('/auth/events', async (request, reply) => {
        const token = request.query.token;

        if (!token) {
            reply.code(401).send({ message: 'Token manquant.' });
            return;
        }

        let user;
        try {
            user = jwt.verify(token, JWT_SECRET);
        } catch (e) {
            fastify.log.warn({ err: e }, '[SSE] JWT invalide');
            reply.code(401).send({ message: 'Token invalide.' });
            return;
        }

        const userId = user?.userId ?? user?.id;
        if (!userId) {
            reply.code(401).send({ message: 'Utilisateur non valide.' });
            return;
        }

        // Prépare la réponse SSE
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            // X-Accel-Buffering pour NGINX ; pour Apache c’est sans effet mais inoffensif
            'X-Accel-Buffering': 'no',
            'Vary': 'Origin',
        });
        if (typeof reply.raw.flushHeaders === 'function') {
            try { reply.raw.flushHeaders(); } catch {}
        }

        const eventName = `permissions:${userId}`;
        const handler = (payload = {}) => {
            reply.raw.write(`event: permission-change\ndata: ${JSON.stringify(payload)}\n\n`);
        };
        eventBus.on(eventName, handler);

        // Envoi d’un “ready” immédiat pour stabiliser certains proxies
        try { reply.raw.write(`event: ready\ndata: {}\n\n`); } catch {}

        // Ping keepalive
        const keepAlive = setInterval(() => {
            try { reply.raw.write(`event: ping\ndata: {}\n\n`); } catch {}
        }, 30000);

        const cleanup = () => {
            try { eventBus.off(eventName, handler); } catch {}
            clearInterval(keepAlive);
        };
        request.raw.on('close', cleanup);
        request.raw.on('aborted', cleanup);
    });
}

module.exports = authEventsRoute;
