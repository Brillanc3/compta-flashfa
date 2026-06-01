/**
 * SHARD SERVER - Version CommonJS stable
 * Chaque shard est une instance isolée du backend complet.
 *
 * AJOUTS (résilience master/shard):
 * - Exit codes distincts si port déjà pris (EADDRINUSE) pour diagnostics.
 * - Marquage Redis "error" sur crash (uncaughtException / unhandledRejection).
 * - Nettoyage Redis minimal avant exit, sans bloquer si Redis est KO.
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const fastify = require('fastify');
const cors = require('@fastify/cors');
const multipart = require('@fastify/multipart');
const helmet = require('@fastify/helmet');
const fastifyCookie = require('@fastify/cookie');
const fastifySession = require('@fastify/session');
const process = require('process');
const { redis } = require('./redisClient');

// --- Imports internes identiques à ton backend principal ---
const prisma = require('../../src/db');
const ingestQueueRedis = require('../../src/lib/ingestQueueRedis');
const authMiddleware = require('../../src/middleware/auth');
const { checkSuspension } = authMiddleware;
const { serveCardImage } = require('../../src/controllers/fidelityController');
const { loadPaymentSchemas } = require('../../src/lib/paymentSchemasLoader');
const { loadColumnConfigs } = require('../../src/lib/columnConfigLoader');
const { loadChatCommands } = require('../../src/lib/chatCommandHandler');
const { registryWidgetsRoute } = require("../lib/syncWidgets");

// -----------------------------------------------------------------------------
// Variables du shard
// -----------------------------------------------------------------------------
const SHARD_NAME = process.env.SHARD_NAME || 'default-shard';
const COMPANY_ID = process.env.COMPANY_ID || 'global';
const PORT = Number(process.env.PORT || 3000);

// Exit codes (diagnostics)
const EXIT_PORT_IN_USE = 98; // convention Unix-like
const EXIT_BOOT_ERROR = 1;
const EXIT_CRASH = 2;

// -----------------------------------------------------------------------------
// Création du serveur Fastify
// -----------------------------------------------------------------------------
const app = fastify({
    logger: false,
    trustProxy: true,
});

// Parser JSON qui accepte les bodies vides (DELETE sans body)
app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
    if (!body || body.trim() === '') {
        done(null, {});
        return;
    }
    try {
        done(null, JSON.parse(body));
    } catch (err) {
        err.statusCode = 400;
        done(err, undefined);
    }
});

function cleanBigInt(obj) {
    return JSON.parse(
        JSON.stringify(obj, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value
        )
    );
}

const isStream = (v) =>
    v &&
    typeof v === "object" &&
    (typeof v.pipe === "function" || v instanceof require("stream").Readable);

app.addHook('onRoute', (routeOptions) => {
    const oldHandler = routeOptions.handler;

    routeOptions.handler = async function patchedHandler(req, reply) {
        const originalSend = reply.send;

        reply.send = function patchedSend(payload) {
            if (payload instanceof Error) {
                return originalSend.call(this, payload);
            }

            if (
                typeof payload === "string" ||
                Buffer.isBuffer(payload) ||
                isStream(payload)
            ) {
                return originalSend.call(this, payload);
            }

            if (typeof payload === "object" && payload !== null) {
                return originalSend.call(this, cleanBigInt(payload));
            }

            return originalSend.call(this, payload);
        };

        return oldHandler.call(this, req, reply);
    };
});

console.log(`🧩 [${SHARD_NAME}] Initialisation pour la company ${COMPANY_ID} (port ${PORT})`);

// -----------------------------------------------------------------------------
// Utilitaires de statut (Redis)
// -----------------------------------------------------------------------------
async function safeRedisSet(key, value) {
    try { await redis.set(key, value); } catch {}
}
async function safeRedisDel(key) {
    try { await redis.del(key); } catch {}
}

/**
 * Marque l’état du shard. Ne doit jamais throw.
 */
async function markStatus(status, extra = {}) {
    await safeRedisSet(`shard:${SHARD_NAME}:status`, status);
    if (extra.pid) await safeRedisSet(`shard:${SHARD_NAME}:pid`, String(extra.pid));
    if (extra.lastError) await safeRedisSet(`shard:${SHARD_NAME}:lastError`, String(extra.lastError));
    if (extra.lastErrorAt) await safeRedisSet(`shard:${SHARD_NAME}:lastErrorAt`, String(extra.lastErrorAt));
}

// -----------------------------------------------------------------------------
// Config standard identique à ton backend
// -----------------------------------------------------------------------------
app.decorate('authenticate', authMiddleware.authenticate);

app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'https://react.jipeg-corporation.eu',
    credentials: true,
});
app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
app.register(helmet);

// Redis
app.register(require('../plugins/redis'));

// SSE (Redis Streams, avec reprise Last-Event-ID)
app.register(require('../plugins/sse-streams'));

app.register(fastifyCookie);
app.register(fastifySession, {
    secret: process.env.SESSION_SECRET || 'replace_with_strong_secret',
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
    },
});

// Hook global : authentification par clé API (x-api-key) — avant JWT
const { authenticateApiKey } = require('../middleware/apiKeyAuth');
app.addHook('preHandler', authenticateApiKey);

// Hook global de vérification de suspension de compta (sauf routes admin et publiques)
app.addHook('preHandler', checkSuspension);

// -----------------------------------------------------------------------------
// Routes publiques (sans authentification)
// -----------------------------------------------------------------------------
app.register(require('../modules/pawnshop/pawnshop.public.routes'));

// -----------------------------------------------------------------------------
// Chargement dynamique des modules
// -----------------------------------------------------------------------------
const modulesDir = path.join(process.cwd(), 'src/modules');
if (fs.existsSync(modulesDir)) {
    fs.readdirSync(modulesDir).forEach((moduleName) => {
        const routeFile = path.join(modulesDir, moduleName, `${moduleName}.routes.js`);
        if (fs.existsSync(routeFile)) {
            try {
                const module = require(routeFile);

                if (module.name && module.routes) {
                    // Enregistrement dans le registre de modules
                    require('../lib/moduleRegistry').register(module.name, {
                        isDefault: !!module.isDefault
                    });

                    app.register(module.routes, {
                        prefix: module.name,
                        authMiddleware,
                    });
                } else {
                    console.warn(`[${SHARD_NAME}] ⚠️ Module ${moduleName} invalide (name/routes manquant).`);
                }
            } catch (err) {
                console.error(`[${SHARD_NAME}] ❌ Erreur module ${moduleName}:`, err);
            }
        }
    });
}

// -----------------------------------------------------------------------------
// Chargement des events SSE
// -----------------------------------------------------------------------------
const eventsDir = path.join(process.cwd(), 'src/events');
if (fs.existsSync(eventsDir)) {
    fs.readdirSync(eventsDir).forEach((file) => {
        if (file.endsWith('.events.js')) {
            try {
                const registerEvent = require(path.join(eventsDir, file));
                if (typeof registerEvent === 'function') {
                    app.register(registerEvent);
                    console.log(`[${SHARD_NAME}] ✅ Event '${file}' chargé.`);
                }
            } catch (err) {
                console.error(`[${SHARD_NAME}] ❌ Erreur event ${file}:`, err);
            }
        }
    });
}

// -----------------------------------------------------------------------------
// Routes publiques (fidélité + santé du shard)
// -----------------------------------------------------------------------------
app.get('/fidelity/view/:publicLink', serveCardImage);
app.get('/fidelity/view/:publicLink.png', serveCardImage);
app.get('/fidelity/view/:publicLink.jpg', serveCardImage);

app.get('/healthz', async () => ({
    shard: SHARD_NAME,
    company: COMPANY_ID,
    status: await redis.get(`shard:${SHARD_NAME}:status`),
}));

// -----------------------------------------------------------------------------
// Gestion crash / erreurs fatales
// -----------------------------------------------------------------------------
let shuttingDown = false;

async function emergencyExit(reason, err, code = EXIT_CRASH) {
    if (shuttingDown) return;
    shuttingDown = true;

    const msg = err ? (err.stack || err.message || String(err)) : String(reason || 'unknown');
    console.error(`[${SHARD_NAME}] 💥 EmergencyExit: ${msg}`);

    // On marque error + lastError, sans jamais bloquer.
    await markStatus('error', {
        pid: process.pid,
        lastError: msg.slice(0, 2000),
        lastErrorAt: Date.now(),
    });

    // Best effort close (sans attendre trop longtemps)
    try { await app.close().catch(() => {}); } catch {}
    try { if (ingestQueueRedis && ingestQueueRedis.quit) await ingestQueueRedis.quit(); } catch {}
    try { await safeRedisDel(`shard:${SHARD_NAME}:pid`); } catch {}
    try { await redis.quit(); } catch {}

    process.exit(code);
}

process.on('uncaughtException', (err) => {
    emergencyExit('uncaughtException', err, EXIT_CRASH);
});

process.on('unhandledRejection', (reason) => {
    emergencyExit('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)), EXIT_CRASH);
});

// -----------------------------------------------------------------------------
// Initialisation et lancement complet
// -----------------------------------------------------------------------------
async function start() {
    try {
        console.log(`[${SHARD_NAME}] 🚀 Initialisation complète du backend...`);
        await loadPaymentSchemas();
        await loadColumnConfigs();
        await loadChatCommands();
        await registryWidgetsRoute(app);

        // --- INITIALISATION DU MOTEUR D'AUTOMATION (SCRATCH) ---
        try {
            require('../modules/automation/lib/automationEngine');
            console.log(`[${SHARD_NAME}] ✅ Moteur d'Automation démarré.`);
        } catch (e) {
            console.error(`[${SHARD_NAME}] ⚠️ Erreur démarrage Automation:`, e);
        }

        await markStatus('booting', { pid: process.pid });

        // Important: listen peut throw EADDRINUSE
        await app.listen({ port: PORT, host: '0.0.0.0' });

        // Init Socket.io V2 (après listen — httpServer disponible)
        try {
            const { setupV2Sockets } = require('../modules/tchatv2/tchatv2.sockets');
            setupV2Sockets({ fastify: app });
        } catch (e) {
            console.error(`[${SHARD_NAME}] ⚠️  Socket.io V2 init error:`, e.message);
        }

        await markStatus('ok', { pid: process.pid });
        console.log(`[${SHARD_NAME}] ✅ En écoute sur le port ${PORT}`);

        // Heartbeat périodique (toutes les 30s)
        setInterval(async () => {
            await markStatus('ok', { pid: process.pid });
        }, 30000);
    } catch (err) {
        const code = err && err.code ? String(err.code) : '';
        console.error(`[${SHARD_NAME}] 💥 Erreur de démarrage :`, err);

        await markStatus('error', {
            pid: process.pid,
            lastError: (err && (err.stack || err.message)) ? String(err.stack || err.message).slice(0, 2000) : 'boot_error',
            lastErrorAt: Date.now(),
        });

        // Si port déjà pris → exit code distinct (utile logs/diagnostic)
        if (code === 'EADDRINUSE') {
            process.exit(EXIT_PORT_IN_USE);
        }

        process.exit(EXIT_BOOT_ERROR);
    }
}

// -----------------------------------------------------------------------------
// Fermeture propre (signalée au master)
// -----------------------------------------------------------------------------
async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`[${SHARD_NAME}] 🧹 Arrêt via ${signal}`);
    try {
        await markStatus('stopped', { pid: process.pid });
        await app.close().catch(() => {});
        if (ingestQueueRedis && ingestQueueRedis.quit) await ingestQueueRedis.quit();
        await safeRedisDel(`shard:${SHARD_NAME}:pid`);
        await redis.quit();
        console.log(`[${SHARD_NAME}] ✅ Fermeture terminée.`);
    } catch (e) {
        console.error(`[${SHARD_NAME}] ❌ Erreur à la fermeture:`, e);
    } finally {
        process.exit(0);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
