/**
 * Master Orchestrator (stable long-terme)
 *
 * Objectifs :
 * - Proxy HTTP/WS vers shards
 * - Spawn/respawn shards si crash, stuck, port occupé
 * - Stockage Redis 48h des requêtes "rejouables" (JSON bufferable) + worker de replay
 *
 * Correctifs majeurs :
 * - Forward via fetch : gestion correcte de Set-Cookie (pas de concat)
 * - Réponse non vide : on bufferise le body fetch pour envoi fiable
 * - Replay : disable sur routes auth & drop sur 401/403 (+ autres 4xx non retryables)
 */

require('dotenv').config();
const Fastify = require('fastify');
const replyFrom = require('@fastify/reply-from');
const { spawn, execSync } = require('child_process');
const process = require('process');
const net = require('net');
const { randomUUID } = require('crypto');
const { Readable } = require('stream');

// Redis / DB
const { redis, checkRedisConnection } = require('./redisClient');
const prisma = require('../db');
const { generateSnowflake } = require('../utils/snowflake');

// Sync
const syncModules = require("../lib/syncModules");
const syncPermissionTemplates = require("../lib/syncPermissionTemplates");
const { loadPermissions } = require("../lib/permissionsLoader");
const { syncWidgets } = require("../lib/syncWidgets");

// Fidelity images
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { UPLOADS_DIR } = require('../modules/image/image.service');

// Discord
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// -------------------- CONFIG --------------------
const MASTER_PORT = Number(process.env.MASTER_PORT || 2500);
const BASE_PORT = Number(process.env.BASE_SHARD_PORT || 4000);
const WEBSOCKET_PORT = Number(process.env.WEBSOCKET_PORT || 9091);

const MASTER_BODY_LIMIT_BYTES = Number(process.env.MASTER_BODY_LIMIT_BYTES || (12 * 1024 * 1024));


// -------------------- DEBUG REQUEST LOGGING --------------------
// Active en dev via:
//   MASTER_DEBUG_LOG_REQUESTS=1 MASTER_DEBUG_LOG_BODIES=1 npm run dev
// Flags:
// - MASTER_DEBUG_LOG_REQUESTS=1 : log method/url/ip/UA (+ headers si MASTER_DEBUG_LOG_HEADERS=1)
// - MASTER_DEBUG_LOG_HEADERS=1  : log headers (avec masquage)
// - MASTER_DEBUG_LOG_BODIES=1   : log body JSON (avec limite MASTER_DEBUG_LOG_BODY_MAX)
// - MASTER_DEBUG_LOG_BODY_MAX   : taille max en chars (défaut 65536)
const MASTER_DEBUG_LOG_REQUESTS = String(process.env.MASTER_DEBUG_LOG_REQUESTS || '') === '1';
const MASTER_DEBUG_LOG_HEADERS = String(process.env.MASTER_DEBUG_LOG_HEADERS || '') === '1';
const MASTER_DEBUG_LOG_BODIES = String(process.env.MASTER_DEBUG_LOG_BODIES || '') === '1';
const MASTER_DEBUG_LOG_BODY_MAX = Number(process.env.MASTER_DEBUG_LOG_BODY_MAX || 65536);

const GATEWAY_ENTRY = process.env.GATEWAY_ENTRY || 'src/gateway/server.js';
const SHARD_ENTRY = process.env.SHARD_ENTRY || 'src/shards/server.js';

const GLOBAL_MODULES = ['auth', 'status', 'ws', 'healthz', 'chat', 'fidelity', 'automation', 'mycalendar', 'tchatv2'];

// Cache company
const COMPANY_CACHE_TTL_SECONDS = 24 * 60 * 60;

// Résilience shards
const SHARD_BOOT_STUCK_MS = Number(process.env.SHARD_BOOT_STUCK_MS || 30_000);
const SHARD_SPAWN_LOCK_TTL_MS = Number(process.env.SHARD_SPAWN_LOCK_TTL_MS || 15_000);
const IDLE_TTL_MS = Number(process.env.SHARD_IDLE_TTL_MS || 3600000);

// Replay
const REPLAY_TTL_SECONDS = Number(process.env.REPLAY_TTL_SECONDS || (48 * 60 * 60));
const REPLAY_MAX_BODY_BYTES = Number(process.env.REPLAY_MAX_BODY_BYTES || (1024 * 1024)); // 1MB
const REPLAY_WORKER_INTERVAL_MS = Number(process.env.REPLAY_WORKER_INTERVAL_MS || 2_000);
const REPLAY_BATCH_SIZE = Number(process.env.REPLAY_BATCH_SIZE || 100);
const REPLAY_MAX_ATTEMPTS = Number(process.env.REPLAY_MAX_ATTEMPTS || 25);

// Ingest Queue (serial, no delay)
const INGEST_QUEUE_KEY = 'ingest:queue';
const INGEST_MAX_RETRIES = Number(process.env.INGEST_MAX_RETRIES || 3);
const INGEST_WORKER_INTERVAL_MS = Number(process.env.INGEST_WORKER_INTERVAL_MS || 100);

// Discord
let discordClient = null;
let discordReady = false;

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';
const DISCORD_STATUS_CHANNEL_ID = process.env.DISCORD_STATUS_CHANNEL_ID || '';
const DISCORD_REPORT_CHANNEL_ID = process.env.DISCORD_REPORT_CHANNEL_ID || '';
const DISCORD_REPORT_SECRET = process.env.DISCORD_REPORT_SECRET || '';

// -------------------- FASTIFY APP --------------------
const app = Fastify({
    trustProxy: true,
    logger: false,
    bodyLimit: MASTER_BODY_LIMIT_BYTES,
});

/**
 * IMPORTANT :
 * - On supprime tous les parsers.
 * - On garde un parser JSON (bufferable).
 * - Parser catch-all : ne consomme pas le flux.
 * - reply-from : disableContentTypeParser => multipart intact.
 */
app.removeAllContentTypeParsers();

app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
    try {
        // debug: conserve la chaine JSON brute si activé
        if (MASTER_DEBUG_LOG_BODIES) req._rawJsonBody = body;
        const obj = JSON.parse(body);
        done(null, obj);
    } catch (err) {
        done(err, undefined);
    }
});

app.addContentTypeParser('*', (req, body, done) => {
    // Ne pas consommer, ne pas parser.
    return done(null, body);
});

app.register(replyFrom, {
    httpMethods: ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT', 'OPTIONS'],
    disableContentTypeParser: true,
    rewriteRequestHeaders: (req, headers) => headers,
});


// -------------------- DEBUG HELPERS --------------------
function maskUrlForLogs(url) {
    try {
        // masque apiKey : /ingest/:companyId/:apiKey (avec ou sans prefix /api)
        return String(url || '').replace(/\/(api\/)?ingest\/(\d+)\/([^\/\?]+)/i, (m0, apiPrefix, companyId, apiKey) => {
            const prefix = apiPrefix ? '/api' : '';
            const masked = apiKey ? `${String(apiKey).slice(0, 6)}…${String(apiKey).slice(-4)}` : '***';
            return `${prefix}/ingest/${companyId}/${masked}`;
        });
    } catch {
        return String(url || '');
    }
}

function maskHeadersForLogs(headers) {
    const h = { ...(headers || {}) };
    const redactKeys = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];
    for (const k of Object.keys(h)) {
        if (redactKeys.includes(String(k).toLowerCase())) {
            h[k] = '[REDACTED]';
        }
    }
    return h;
}

function safeJsonStringify(value) {
    try {
        return JSON.stringify(value);
    } catch {
        try {
            return String(value);
        } catch {
            return '[Unstringifiable]';
        }
    }
}

function truncate(str, maxChars) {
    const s = String(str ?? '');
    if (!maxChars || maxChars <= 0) return s;
    if (s.length <= maxChars) return s;
    return s.slice(0, maxChars) + `…[truncated ${s.length - maxChars} chars]`;
}

function shouldLogUrl(url) {
    const u = String(url || '');
    // évite le spam (surtout en dev)
    if (u.startsWith('/healthz') || u.startsWith('/api/healthz')) return false;
    return true;
}


// -------------------- DEBUG HOOKS --------------------
app.addHook('onRequest', async (request, reply) => {
    if (!MASTER_DEBUG_LOG_REQUESTS) return;
    if (!shouldLogUrl(request.url)) return;

    request._masterDebugStartNs = process.hrtime.bigint();

    const url = maskUrlForLogs(request.url);
    const ip = request.ip || request.socket?.remoteAddress || request.raw?.socket?.remoteAddress || '';
    const ua = String(request.headers['user-agent'] || '');
    const msg = `[MASTER] ${new Date().toISOString()} -> ${request.method} ${url} ip=${ip} ua="${ua}"`;

    if (MASTER_DEBUG_LOG_HEADERS) {
        const masked = maskHeadersForLogs(request.headers);
        console.log(msg, 'headers=', masked);
    } else {
        console.log(msg);
    }
});

app.addHook('preHandler', async (request, reply) => {
    if (!MASTER_DEBUG_LOG_BODIES) return;
    if (!shouldLogUrl(request.url)) return;

    const method = String(request.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

    const ct = String(request.headers['content-type'] || '').toLowerCase();
    if (!ct.includes('application/json')) {
        // ne pas toucher aux streams/multipart/etc
        console.log(`[MASTER] ${new Date().toISOString()} BODY ${method} ${maskUrlForLogs(request.url)} <non-json content-type="${ct || 'n/a'}">`);
        return;
    }

    const raw = request.raw?._rawJsonBody ?? request._rawJsonBody;
    const bodyStr = truncate(raw != null ? String(raw) : safeJsonStringify(request.body ?? null), MASTER_DEBUG_LOG_BODY_MAX);
    console.log(`[MASTER] ${new Date().toISOString()} BODY ${method} ${maskUrlForLogs(request.url)} ${bodyStr}`);
});

app.addHook('onResponse', async (request, reply) => {
    if (!MASTER_DEBUG_LOG_REQUESTS) return;
    if (!shouldLogUrl(request.url)) return;

    const start = request._masterDebugStartNs;
    let durMs = null;
    if (start) {
        durMs = Number(process.hrtime.bigint() - start) / 1e6;
    }

    const url = maskUrlForLogs(request.url);
    const suffix = durMs != null ? ` ${durMs.toFixed(1)}ms` : '';
    console.log(`[MASTER] ${new Date().toISOString()} <- ${reply.statusCode} ${request.method} ${url}${suffix}`);
});

app.addHook('onError', async (request, reply, error) => {
    if (!MASTER_DEBUG_LOG_REQUESTS) return;
    if (!shouldLogUrl(request.url)) return;

    const url = maskUrlForLogs(request.url);
    console.log(`[MASTER] ${new Date().toISOString()} !! ERROR ${request.method} ${url} message="${error?.message || error}"`);

    if (MASTER_DEBUG_LOG_BODIES) {
        const ct = String(request.headers['content-type'] || '').toLowerCase();
        if (ct.includes('application/json')) {
            const raw = request.raw?._rawJsonBody ?? request._rawJsonBody;
            if (raw != null) {
                console.log(`[MASTER] ${new Date().toISOString()} ERROR_BODY ${request.method} ${url} ${truncate(String(raw), MASTER_DEBUG_LOG_BODY_MAX)}`);
            }
        }
    }
});



// -------------------- HELPERS --------------------
function shardNameFor(companyId) {
    const isDev = process.env.ENV === 'dev';
    if (companyId === 'webhook') {
        return isDev ? 'shard-webhook-dev' : 'shard-webhook';
    }
    return isDev ? 'shard-global-dev' : 'shard-global';
}

function resolveCompanyId(req) {
    const parts = (req.url || '/').split('/').filter(Boolean);
    const moduleName = parts[0] || '';

    if (GLOBAL_MODULES.includes(moduleName)) return 'global';
    if (req.headers['x-company-id']) return String(req.headers['x-company-id']);

    const ingestIndex = parts.findIndex((p) => p === 'ingest');
    if (ingestIndex !== -1 && /^\d+$/.test(parts[ingestIndex + 1])) return parts[ingestIndex + 1];

    return 'global';
}

async function ping(port) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/healthz`);
        if (res.ok) return { ok: true };
    } catch { }
    return { ok: false };
}

async function pingWithRetries(port, tries = 5, delayMs = 200) {
    for (let i = 0; i < tries; i++) {
        const { ok } = await ping(port);
        if (ok) return true;
        await new Promise(r => setTimeout(r, delayMs));
    }
    return false;
}

async function waitForShard(port, retries = 240, delayMs = 500) {
    for (let i = 0; i < retries; i++) {
        const { ok } = await ping(port);
        if (ok) return true;
        await new Promise(r => setTimeout(r, delayMs));
    }
    return false;
}

function randomPort() {
    return BASE_PORT + Math.floor(Math.random() * 4000);
}

async function isPortFree(port) {
    return new Promise((resolve) => {
        const srv = net.createServer();
        srv.once('error', () => resolve(false));
        srv.once('listening', () => srv.close(() => resolve(true)));
        srv.listen(port, '127.0.0.1');
    });
}

async function pickFreePort(maxTries = 30) {
    for (let i = 0; i < maxTries; i++) {
        const p = randomPort();
        // eslint-disable-next-line no-await-in-loop
        const ok = await isPortFree(p);
        if (ok) return p;
    }
    return randomPort(); // fallback
}

function sanitizeForwardHeaders(headers) {
    const h = { ...headers };
    // hop-by-hop
    delete h.connection;
    delete h['transfer-encoding'];
    delete h['content-length'];
    delete h.host;
    return h;
}

// -------------------- REPLAY ELIGIBILITY --------------------
function isReplayDeniedRoute(url) {
    // routes sensibles / non-idempotentes / bruit
    return (
        url.startsWith('/auth/') ||
        url.startsWith('/api/auth/') ||
        url.startsWith('/ws/') ||
        url.startsWith('/healthz') ||
        url.startsWith('/status/') ||
        url.startsWith('/api/status/') ||
        url.startsWith('/fidelity/view') // image + pas besoin
    );
}

function isJsonBufferable(req) {
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;

    const url = req.url || '/';
    if (isReplayDeniedRoute(url)) return false;

    const ct = String(req.headers['content-type'] || '').toLowerCase();
    if (!ct.includes('application/json')) return false;

    // Fastify parser JSON => req.body objet
    let bodySize = 0;
    try {
        const s = JSON.stringify(req.body ?? null);
        bodySize = Buffer.byteLength(s, 'utf8');
    } catch {
        return false;
    }
    return bodySize <= REPLAY_MAX_BODY_BYTES;
}

function isRetryableStatus(status) {
    // Retry : 408, 429, 5xx
    if (status === 408) return true;
    if (status === 429) return true;
    if (status >= 500 && status <= 599) return true;
    return false;
}

// -------------------- ANTI-DUP SPAWN --------------------
const spawnsInFlight = new Map();

async function withRedisLock(key, ttlMs, fn) {
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ok = await redis.set(key, token, 'NX', 'PX', ttlMs);
    if (!ok) return fn(false, null);

    try {
        return await fn(true, token);
    } finally {
        try {
            await redis.eval(
                "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
                1, key, token
            );
        } catch { }
    }
}

// -------------------- GATEWAY --------------------
async function spawnGateway() {
    const lock = await redis.set('lock:gateway:spawn', '1', 'NX', 'PX', 10000);
    if (!lock) return;

    try {
        const existingPid = await redis.get('gateway:pid');
        const status = await redis.get('gateway:status');

        if (existingPid && (status === 'ok' || status === 'booting')) {
            try {
                process.kill(Number(existingPid), 0);
                // S'il est vivant, on n'a rien à faire
                return;
            } catch {
                console.log(`[MASTER] Gateway process ${existingPid} est mort. Nettoyage et respawn...`);
            }
        }

        console.log(`Spawn Gateway WebSocket -> port ${WEBSOCKET_PORT}`);

        const child = spawn('node', [GATEWAY_ENTRY], {
            env: { ...process.env, WEBSOCKET_PORT: `${WEBSOCKET_PORT}` },
            stdio: 'inherit',
        });

        await redis.set('gateway:pid', child.pid);
        await redis.set('gateway:status', 'booting');

        child.on('exit', async () => {
            try {
                await redis.set('gateway:status', 'stopped');
                await redis.del('gateway:pid');
            } catch { }
        });
    } finally {
        await redis.del('lock:gateway:spawn');
    }
}

function startGatewayMonitor() {
    setInterval(spawnGateway, 5000);
}

async function shutdownGateway() {
    const pid = await redis.get('gateway:pid');
    if (!pid) return;
    try { process.kill(Number(pid), 'SIGTERM'); } catch { }
    await redis.del('gateway:pid');
    await redis.set('gateway:status', 'stopped');
}

// -------------------- SHARD MANAGEMENT --------------------
async function waitForExistingShard(shardName, maxMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
        const port = await redis.get(`shard:${shardName}:port`);
        if (port) {
            const { ok } = await ping(port);
            if (ok) return Number(port);
        }
        await new Promise(r => setTimeout(r, 200));
    }
    return null;
}

async function purgeShardKeys(shardName) {
    console.log(`[MASTER] Purging keys for ${shardName}`);
    const keys = [
        `shard:${shardName}:port`,
        `shard:${shardName}:status`,
        `shard:${shardName}:pid`,
        `shard:${shardName}:createdAt`,
        `shard:${shardName}:lastError`,
    ];
    for (const k of keys) {
        await redis.del(k).catch(() => { });
    }
}

async function ensureShardNotStuck(shardName) {
    const status = await redis.get(`shard:${shardName}:status`);
    if (status !== 'booting') return;

    const createdAt = Number(await redis.get(`shard:${shardName}:createdAt`) || 0);
    if (!createdAt) return;

    const age = Date.now() - createdAt;
    if (age < SHARD_BOOT_STUCK_MS) return;

    console.error(`Shard ${shardName} bloqué en booting (${age}ms) => purge + respawn`);
    const pid = await redis.get(`shard:${shardName}:pid`);
    if (pid) {
        try { process.kill(pid, 'SIGKILL'); } catch { }
    }
    await purgeShardKeys(shardName);
}

function attachShardExitHandlers(child, shardName) {
    child.on('exit', async (code, signal) => {
        console.error(`${shardName} exit (code=${code}, signal=${signal})`);
        try {
            await redis.set(`shard:${shardName}:status`, 'stopped');
            await redis.del(`shard:${shardName}:pid`);
            await redis.del(`shard:${shardName}:port`); // force respawn propre
        } catch { }
    });

    child.on('error', async (err) => {
        console.error(`${shardName} spawn error:`, err);
        try {
            await redis.set(`shard:${shardName}:status`, 'error');
            await redis.del(`shard:${shardName}:pid`);
            await redis.del(`shard:${shardName}:port`);
        } catch { }
    });
}

async function spawnShard(companyId, shardName) {
    const port = await pickFreePort();

    console.log(`Spawn ${shardName} (company=${companyId}) -> port ${port}`);

    const child = spawn('node', [SHARD_ENTRY, shardName], {
        env: { ...process.env, PORT: `${port}`, COMPANY_ID: `${companyId}`, SHARD_NAME: shardName },
        stdio: 'inherit',
    });

    child.on('spawn', () => {
        console.log(`[MASTER] ✅ Processus enfant ${child.pid} pour ${shardName} créé.`);
    });

    attachShardExitHandlers(child, shardName);

    const now = Date.now();
    await redis.set(`shard:${shardName}:pid`, child.pid);
    await redis.set(`shard:${shardName}:port`, port);
    await redis.set(`shard:${shardName}:status`, 'booting');
    await redis.set(`shard:${shardName}:createdAt`, now);
    await redis.set(`company:route:${companyId}`, shardName);

    return { shardName, port, pid: child.pid };
}

async function getOrCreateShard(companyId) {
    if (spawnsInFlight.has(companyId)) return spawnsInFlight.get(companyId);

    const p = (async () => {
        const shardName = shardNameFor(companyId);

        await ensureShardNotStuck(shardName);

        const existingPort = await redis.get(`shard:${shardName}:port`);
        const existingStatus = await redis.get(`shard:${shardName}:status`);

        if (existingPort) {
            const portNum = Number(existingPort);

            // 1) Si booting : NE PAS PURGE sur ping KO.
            //    On renvoie le port et on laisse waitForShard() gérer la readiness.
            if (existingStatus === 'booting') {
                return { shardName, port: portNum };
            }

            // 2) Si ok : ping robuste avant de décider purge
            if (existingStatus === 'ok') {
                const ok = await pingWithRetries(portNum, 5, 200);
                if (ok) return { shardName, port: portNum };

                console.warn(`⚠️ ${shardName} port=${portNum} status=ok mais ping KO (5 tries) => kill + purge`);

                // Kill PID avant purge pour éviter les shards orphelins
                const pid = await redis.get(`shard:${shardName}:pid`);
                if (pid) {
                    try { process.kill(Number(pid), 'SIGKILL'); } catch { }
                }

                await purgeShardKeys(shardName);
            }

            // 3) Si status inconnu/stopped/error : on kill + purge pour repartir propre
            if (existingStatus !== 'ok' && existingStatus !== 'booting') {
                const pid = await redis.get(`shard:${shardName}:pid`);
                if (pid) {
                    try { process.kill(Number(pid), 'SIGKILL'); } catch { }
                }
                await purgeShardKeys(shardName);
            }
        }

        const lockKey = `lock:shard:create:${shardName}`;

        return withRedisLock(lockKey, SHARD_SPAWN_LOCK_TTL_MS, async (weOwn) => {
            if (!weOwn) {
                const reused = await waitForExistingShard(shardName, 15000);
                if (reused) return { shardName, port: reused };

                return withRedisLock(lockKey, SHARD_SPAWN_LOCK_TTL_MS, async (weOwn2) => {
                    if (!weOwn2) throw new Error(`Lock contention on ${shardName}`);
                    const p2 = await redis.get(`shard:${shardName}:port`);
                    if (p2) return { shardName, port: Number(p2) };
                    return spawnShard(companyId, shardName);
                });
            }

            const p3 = await redis.get(`shard:${shardName}:port`);
            if (p3) return { shardName, port: Number(p3) };

            return spawnShard(companyId, shardName);
        });
    })();

    spawnsInFlight.set(companyId, p);
    try { return await p; }
    finally { spawnsInFlight.delete(companyId); }
}

// -------------------- COMPANY ACTIVE CACHE --------------------
async function isCompanyKnownActive(companyId) {
    if (!companyId || isNaN(Number(companyId))) return false;
    const id = Number(companyId);
    const cacheKey = `company:active:${id}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached === '1') return true;
        if (cached === '0') return false;

        const company = await prisma.company.findUnique({
            where: { id },
            select: { id: true, isApiActive: true }
        });

        const isActive = !!(company && company.isApiActive);
        await redis.set(cacheKey, isActive ? '1' : '0', 'EX', COMPANY_CACHE_TTL_SECONDS);
        return isActive;
    } catch (err) {
        console.error("isCompanyKnownActive error:", err);
        try {
            const company = await prisma.company.findUnique({
                where: { id },
                select: { id: true, isApiActive: true }
            });
            return !!(company && company.isApiActive);
        } catch {
            return false;
        }
    }
}

// -------------------- REPLAY STORAGE --------------------
function replayReqKey(id) { return `replay:req:${id}`; }
function replayPendingZset() { return `replay:pending`; }
function replayShardPendingSet(shardName) { return `replay:shard:${shardName}:pending`; }

async function storeReplayRequest({ companyId, shardName, url, method, headers, bodyString }) {
    const id = randomUUID();
    const now = Date.now();

    const payload = {
        id,
        companyId,
        shardName,
        url,
        method,
        headers,
        bodyString,
        createdAt: now,
        attempts: 0,
        lastError: null,
    };

    await redis.set(replayReqKey(id), JSON.stringify(payload), 'EX', REPLAY_TTL_SECONDS);
    // Délai initial de 60s pour éviter que le worker ne rejoue la requête pendant son traitement normal
    await redis.zadd(replayPendingZset(), now + 60000, id);
    await redis.sadd(replayShardPendingSet(shardName), id);
    await redis.expire(replayShardPendingSet(shardName), REPLAY_TTL_SECONDS);

    return id;
}

async function deleteReplay(id, shardName) {
    try {
        await redis.zrem(replayPendingZset(), id);
        await redis.del(replayReqKey(id));
        if (shardName) await redis.srem(replayShardPendingSet(shardName), id);
    } catch { }
}

async function bumpReplayFailure(id, shardName, errMsg) {
    const key = replayReqKey(id);
    const raw = await redis.get(key);
    if (!raw) {
        await deleteReplay(id, shardName);
        return;
    }

    let obj;
    try { obj = JSON.parse(raw); } catch { obj = null; }
    if (!obj) {
        await deleteReplay(id, shardName);
        return;
    }

    obj.attempts = Number(obj.attempts || 0) + 1;
    obj.lastError = String(errMsg || 'unknown');

    if (obj.attempts >= REPLAY_MAX_ATTEMPTS) {
        console.error(`Replay drop (max attempts) id=${id}`);
        await deleteReplay(id, shardName);
        return;
    }

    // Backoff exponentiel cap 5 min
    const delay = Math.min(300_000, 1000 * Math.pow(2, Math.min(10, obj.attempts)));
    const next = Date.now() + delay;

    await redis.set(key, JSON.stringify(obj), 'EX', REPLAY_TTL_SECONDS);
    await redis.zadd(replayPendingZset(), next, id);
}

async function forwardBufferedToShard({ port, url, method, headers, bodyString }) {
    const target = `http://127.0.0.1:${port}${url}`;
    const fwdHeaders = sanitizeForwardHeaders(headers);

    // content-type garanti
    if (!fwdHeaders['content-type'] && !fwdHeaders['Content-Type']) {
        fwdHeaders['content-type'] = 'application/json';
    }

    const res = await fetch(target, {
        method,
        headers: fwdHeaders,
        body: bodyString,
    });

    return res;
}

/**
 * Correctif durable :
 * - Set-Cookie multiple : ne pas concaténer
 * - Body : bufferiser pour envoi fiable (notamment login)
 */
async function applyFetchResponseToFastifyReply(fetchRes, reply) {
    reply.code(fetchRes.status);

    const headersObj = fetchRes.headers;

    // Gestion Set-Cookie propre (undici)
    const setCookies = typeof headersObj.getSetCookie === 'function'
        ? headersObj.getSetCookie()
        : null;

    headersObj.forEach((v, k) => {
        const lk = k.toLowerCase();
        if (lk === 'transfer-encoding') return;
        if (lk === 'content-length') return;
        if (lk === 'set-cookie') return; // traité séparément
        reply.header(k, v);
    });

    if (Array.isArray(setCookies) && setCookies.length > 0) {
        for (const c of setCookies) reply.header('set-cookie', c);
    } else {
        // fallback (moins fiable si multi cookies, mais mieux que rien)
        const single = headersObj.get('set-cookie');
        if (single) reply.header('set-cookie', single);
    }

    const ab = await fetchRes.arrayBuffer();
    const buf = Buffer.from(ab);
    reply.send(buf);
}

// -------------------- REPLAY WORKER --------------------
let replayWorkerTimer = null;
let isReplayWorkerRunning = false;

function startReplayWorker() {
    if (replayWorkerTimer) return;

    replayWorkerTimer = setInterval(async () => {
        if (isReplayWorkerRunning) return;

        // En cluster PM2, un seul worker traite la queue à la fois
        const clusterLock = await redis.set('cluster:lock:replay-worker', process.pid, 'NX', 'PX', REPLAY_WORKER_INTERVAL_MS * 3).catch(() => null);
        if (!clusterLock) return;

        isReplayWorkerRunning = true;

        try {
            const now = Date.now();
            const ids = await redis.zrangebyscore(replayPendingZset(), 0, now, 'LIMIT', 0, REPLAY_BATCH_SIZE);
            if (!ids || ids.length === 0) return;

            // FIX: Décale immédiatement le score dans le futur (lock de 5 minutes)
            // pour éviter qu'un traitement long ne fasse re-sélectionner le même ID au prochain tick.
            const pipeline = redis.pipeline();
            for (const id of ids) {
                pipeline.zadd(replayPendingZset(), now + 300_000, id);
            }
            await pipeline.exec();

            await Promise.all(ids.map(async (id) => {
                const raw = await redis.get(replayReqKey(id));
                if (!raw) {
                    await redis.zrem(replayPendingZset(), id);
                    return;
                }

                let reqObj;
                try { reqObj = JSON.parse(raw); } catch { reqObj = null; }
                if (!reqObj) {
                    await redis.zrem(replayPendingZset(), id);
                    return;
                }

                const { companyId, shardName, url, method, headers, bodyString } = reqObj;

                if (isReplayDeniedRoute(url)) {
                    await deleteReplay(id, shardName);
                    return;
                }

                if (typeof bodyString !== 'string') {
                    await bumpReplayFailure(id, shardName, 'no_body_stored');
                    return;
                }

                try {
                    const { port } = await getOrCreateShard(companyId);
                    const ready = await waitForShard(port, 30, 500); // 15s max pour worker
                    if (!ready) throw new Error('shard_not_ready');

                    const res = await forwardBufferedToShard({ port, url, method, headers, bodyString });

                    if (res.ok) {
                        await deleteReplay(id, shardName);
                    } else {
                        if (res.status === 401 || res.status === 403) {
                            await deleteReplay(id, shardName);
                            return;
                        }

                        if (res.status >= 400 && res.status <= 499 && !isRetryableStatus(res.status)) {
                            await deleteReplay(id, shardName);
                            return;
                        }

                        await bumpReplayFailure(id, shardName, `http_${res.status}`);
                    }
                } catch (e) {
                    await bumpReplayFailure(id, shardName, e?.message || 'replay_error');
                }
            }));
        } catch (e) {
            console.error("Replay worker error:", e);
        } finally {
            isReplayWorkerRunning = false;
        }
    }, REPLAY_WORKER_INTERVAL_MS);
}

// -------------------- INGEST FALLBACK DB --------------------
async function saveIngestFallbackToDB(item, errorMsg) {
    try {
        await prisma.ingestFallback.create({
            data: {
                id: item.id,
                companyId: String(item.companyId),
                url: item.url,
                method: item.method,
                headers: item.headers,
                bodyString: item.bodyString,
                enqueuedAt: new Date(item.enqueuedAt),
                lastError: String(errorMsg || 'redis_unavailable'),
            }
        });
        console.error(`[INGEST FALLBACK] Item ${item.id} sauvegardé en DB (Redis KO)`);

        // Alerte Discord non-bloquante
        if (discordReady) {
            sendDiscordReport({
                title: 'Ingest — Redis KO, fallback DB activé',
                category: 'ALERT',
                description: `Item \`${item.id}\` redirigé vers DB.\nErreur : \`${String(errorMsg).slice(0, 300)}\``,
                color: 0xff6b00,
            }).catch(() => {});
        }
    } catch (dbErr) {
        console.error(`[INGEST FALLBACK] DB KO aussi (${dbErr.message}) — payload loggé en stderr`);
        // Last resort : stderr contient la donnée complète pour recovery manuelle
        console.error(`[INGEST LOST] ${JSON.stringify(item)}`);
    }
}

// -------------------- INGEST SERIAL QUEUE --------------------
async function enqueueIngest({ companyId, url, method, headers, bodyString }) {
    const id = randomUUID();
    const payload = { id, companyId, url, method, headers, bodyString, enqueuedAt: Date.now() };

    try {
        await redis.lpush(INGEST_QUEUE_KEY, JSON.stringify(payload));
        return id;
    } catch (redisErr) {
        console.error(`[INGEST] Redis lpush KO: ${redisErr.message}`);
        saveIngestFallbackToDB(payload, redisErr.message).catch(() => {});
        return id;
    }
}

let ingestWorkerRunning = false;

async function processIngestQueue() {
    if (ingestWorkerRunning) return;

    // En cluster PM2, un seul worker traite la queue à la fois
    const clusterLock = await redis.set('cluster:lock:ingest-worker', process.pid, 'NX', 'PX', 30000).catch(() => null);
    if (!clusterLock) return;

    ingestWorkerRunning = true;

    try {
        while (true) {
            const raw = await redis.rpop(INGEST_QUEUE_KEY);
            if (!raw) break;

            let item;
            try { item = JSON.parse(raw); } catch { continue; }

            const { id, companyId, url, method, headers, bodyString } = item;
            // Le shard enregistre /ingest/... (sans /api/), master intercepte /api/ingest/...
            const shardUrl = url.replace(/^\/api\/ingest\//, '/ingest/');
            let success = false;

            for (let attempt = 1; attempt <= INGEST_MAX_RETRIES; attempt++) {
                try {
                    const { port } = await getOrCreateShard('webhook');
                    const ready = await waitForShard(port, 30, 500);
                    if (!ready) throw new Error('shard_not_ready');

                    const res = await forwardBufferedToShard({ port, url: shardUrl, method, headers, bodyString });

                    if (res.status >= 200 && res.status < 300) {
                        success = true;
                        break;
                    }

                    console.warn(`[INGEST] ${id} attempt ${attempt}/${INGEST_MAX_RETRIES} http_${res.status} shardUrl=${shardUrl}`);
                } catch (e) {
                    console.warn(`[INGEST] ${id} attempt ${attempt}/${INGEST_MAX_RETRIES} error: ${e.message}`);
                }

                if (attempt < INGEST_MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, 500 * attempt));
                }
            }

            if (!success) {
                console.error(`[INGEST] Failed after ${INGEST_MAX_RETRIES} retries: id=${id} url=${url}`);
            }
        }
    } catch (e) {
        console.error('[INGEST] Worker error:', e);
    } finally {
        ingestWorkerRunning = false;
    }
}

let ingestWorkerTimer = null;
function startIngestWorker() {
    if (ingestWorkerTimer) return;
    ingestWorkerTimer = setInterval(processIngestQueue, INGEST_WORKER_INTERVAL_MS);
}

// -------------------- INGEST FALLBACK RECOVERY --------------------
let ingestFallbackWorkerTimer = null;

async function processIngestFallback() {
    // En cluster PM2, un seul worker traite le fallback à la fois
    const clusterLock = await redis.set('cluster:lock:ingest-fallback', process.pid, 'NX', 'PX', 60000).catch(() => null);
    if (!clusterLock) return;

    let items;
    try {
        items = await prisma.ingestFallback.findMany({
            where: { resolved: false, attempts: { lt: INGEST_MAX_RETRIES } },
            orderBy: { enqueuedAt: 'asc' },
            take: 50,
        });
    } catch { return; }

    if (!items || items.length === 0) return;

    // Vérifie que Redis est de retour avant de tenter
    try { await redis.ping(); } catch { return; }

    let restored = 0;
    for (const item of items) {
        try {
            await redis.lpush(INGEST_QUEUE_KEY, JSON.stringify({
                id: item.id,
                companyId: item.companyId,
                url: item.url,
                method: item.method,
                headers: item.headers,
                bodyString: item.bodyString,
                enqueuedAt: item.enqueuedAt.getTime(),
            }));
            await prisma.ingestFallback.update({
                where: { id: item.id },
                data: { resolved: true, resolvedAt: new Date() }
            });
            restored++;
        } catch (err) {
            await prisma.ingestFallback.update({
                where: { id: item.id },
                data: { attempts: { increment: 1 }, lastError: String(err.message).slice(0, 500) }
            }).catch(() => {});
        }
    }

    if (restored > 0) {
        console.log(`[INGEST RECOVERY] ${restored} item(s) restauré(s) depuis DB fallback`);
    }
}

function startIngestFallbackWorker() {
    if (ingestFallbackWorkerTimer) return;
    // Vérifie toutes les 30s si des items DB sont à rejouer
    ingestFallbackWorkerTimer = setInterval(processIngestFallback, 30_000);
}

// -------------------- CLEANUP ON BOOT --------------------
async function cleanupShardsOnBoot() {
    const lockKey = 'lock:shards:bootCleanup';

    await withRedisLock(lockKey, 30000, async (own) => {
        if (!own) return;

        console.log("[MASTER] Skipping aggressive cleanup (ZDD mode)");
    });
}

// -------------------- FIDELITY IMAGE ROUTES --------------------
async function buildFidelityImage(publicLink) {
    const card = await prisma.fidelityCard.findUnique({
        where: { publicLink },
        include: {
            client: {
                include: {
                    company: {
                        include: {
                            fidelityCardTemplates: {
                                where: { isActive: true },
                                include: { stampZones: { orderBy: { order: 'asc' } } }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!card) return null;

    const template = card.client.company.fidelityCardTemplates[0];
    if (!template) throw new Error("No active template");

    const baseImg = await prisma.image.findUnique({ where: { publicId: template.baseImageId } });
    const stampImg = await prisma.image.findUnique({ where: { publicId: template.stampImageId } });

    const basePath = path.join(UPLOADS_DIR, baseImg.filename);
    const stampPath = path.join(UPLOADS_DIR, stampImg.filename);

    const STAMP_SIZE = 50;
    const stampBuf = await sharp(stampPath).resize(STAMP_SIZE, STAMP_SIZE).toBuffer();

    const zones = template.stampZones.slice(0, card.stampCount).map(z => ({
        input: stampBuf,
        top: z.y - STAMP_SIZE / 2,
        left: z.x - STAMP_SIZE / 2
    }));

    const finalBuffer = await sharp(basePath).composite(zones).png().toBuffer();
    return finalBuffer;
}

app.get('/fidelity/view/:publicLink', async (req, reply) => {
    try {
        const buf = await buildFidelityImage(req.params.publicLink);
        if (!buf) return reply.code(404).send("Not found");

        reply
            .header("Content-Type", "image/png")
            .header("Content-Length", buf.length)
            .header("Cache-Control", "no-store")
            .send(buf);
    } catch (err) {
        console.error("FIDELITY ERROR:", err);
        reply.code(500).send("Error generating image");
    }
});

app.get('/fidelity/view/:publicLink.png', async (req, reply) => {
    try {
        const buf = await buildFidelityImage(req.params.publicLink);
        if (!buf) return reply.code(404).send("Not found");

        reply
            .header("Content-Type", "image/png")
            .header("Content-Length", buf.length)
            .header("Cache-Control", "no-store")
            .send(buf);
    } catch (err) {
        console.error("FIDELITY ERROR:", err);
        reply.code(500).send("Error generating image");
    }
});

// -------------------- HEALTH SNAPSHOT --------------------
function statusEmoji(s) {
    switch ((s || '').toLowerCase()) {
        case 'ok': return '🟢';
        case 'booting': return '🟡';
        case 'stopped': return '🔴';
        case 'unknown': return '⚪';
        default: return '🔘';
    }
}

function formatUptime(mins) {
    if (!isFinite(mins)) return '?';
    if (mins < 60) return `${mins.toFixed(1)} min`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
}

async function collectShardSnapshot() {
    const keys = await redis.keys('shard:shard-*:*');
    const shards = {};

    for (const key of keys) {
        const [, shardName, field] = key.split(':');
        if (!shards[shardName]) shards[shardName] = {};
        shards[shardName][field] = await redis.get(key);
    }

    const now = Date.now();
    const result = {};

    for (const [name, info] of Object.entries(shards)) {
        const portStr = info.port || '';
        const port = portStr ? Number(portStr) : null;

        let latencyMs = '?';
        if (port) {
            const start = Date.now();
            try {
                const res = await fetch(`http://127.0.0.1:${port}/healthz`);
                if (res.ok) latencyMs = Date.now() - start;
            } catch { }
        }

        result[name] = {
            status: info.status || 'unknown',
            port: portStr || '?',
            createdAt: info.createdAt ? new Date(Number(info.createdAt)).toISOString() : '?',
            lastActivity: info.lastActivity ? new Date(Number(info.lastActivity)).toISOString() : '?',
            uptime: info.createdAt ? formatUptime((now - Number(info.createdAt)) / 60000) : '?',
            latencyMs,
        };
    }

    return { status: 'ok', totalShards: Object.keys(result).length, shards: result };
}

app.get('/healthz', async () => collectShardSnapshot());

// Optionnel : relancer un replayId manuellement (admin)
app.post('/status/replay/:replayId', async (req, reply) => {
    const secret = req.headers['x-report-secret'];
    if (DISCORD_REPORT_SECRET && secret !== DISCORD_REPORT_SECRET) {
        return reply.code(403).send({ error: 'Forbidden' });
    }

    const { replayId } = req.params;
    const raw = await redis.get(replayReqKey(replayId));
    if (!raw) return reply.code(404).send({ error: 'Not found' });

    await redis.zadd(replayPendingZset(), Date.now(), replayId);
    return reply.send({ ok: true, replayId });
});

// Redémarrage d'une shard sans couper le master (admin)
app.post('/admin/restart-shard', async (req, reply) => {
    const secret = req.headers['x-report-secret'];
    if (DISCORD_REPORT_SECRET && secret !== DISCORD_REPORT_SECRET) {
        return reply.code(403).send({ error: 'Forbidden' });
    }

    const { companyId = 'global' } = req.body || {};
    if (companyId !== 'global' && companyId !== 'webhook') {
        return reply.code(400).send({ error: 'companyId must be "global" or "webhook"' });
    }

    const shardName = shardNameFor(companyId);

    const pid = await redis.get(`shard:${shardName}:pid`);
    if (pid) {
        try { process.kill(Number(pid), 'SIGTERM'); } catch { }
        await new Promise(r => setTimeout(r, 1000));
    }
    await purgeShardKeys(shardName);

    const { port } = await getOrCreateShard(companyId);
    const ready = await waitForShard(port, 60, 500);

    console.log(`[MASTER] Shard ${shardName} restarted → port=${port} ready=${ready}`);
    return reply.send({ ok: true, shardName, port, ready });
});

// -------------------- DISCORD --------------------
async function sendDiscordReport({ title = 'Report', category = 'INFO', description, fields = [], color = 0xdb2777 }) {
    if (!discordReady) throw new Error('Discord not ready');

    const channelId = DISCORD_REPORT_CHANNEL_ID || DISCORD_STATUS_CHANNEL_ID;
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel) throw new Error('Report channel not found');

    const embed = new EmbedBuilder()
        .setTitle(`[${category}] ${title}`)
        .setTimestamp(new Date())
        .setColor(color);

    if (description) embed.setDescription(description);
    if (fields?.length) embed.addFields(fields);

    const sent = await channel.send({ embeds: [embed] });
    return { messageId: sent.id, channelId };
}

app.post('/status/discord/report', async (req, reply) => {
    try {
        if (!DISCORD_TOKEN || !DISCORD_STATUS_CHANNEL_ID) {
            return reply.code(503).send({ error: 'Discord disabled' });
        }

        const secret = req.headers['x-report-secret'];
        if (!secret || secret !== DISCORD_REPORT_SECRET) {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        const { title, category, description, fields } = req.body || {};
        const res = await sendDiscordReport({
            title: title || 'Report',
            category: category || 'INFO',
            description,
            fields: Array.isArray(fields) ? fields : [],
        });

        return { ok: true, ...res };
    } catch (e) {
        console.error('discord report error:', e);
        return reply.code(500).send({ error: 'Report failed' });
    }
});

app.post('/status/discord/report-chat', async (req, reply) => {
    try {
        if (!DISCORD_TOKEN || !DISCORD_STATUS_CHANNEL_ID) {
            return reply.code(503).send({ error: 'Discord disabled' });
        }

        if (!discordClient) {
            return reply.code(503).send({ error: 'Discord bot not connected' });
        }

        const secret = req.headers['x-report-secret'];
        if (!secret || secret !== DISCORD_REPORT_SECRET) {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        const { title, description, fields, userId, channelId, messageId } = req.body || {};

        const channel = await discordClient.channels.fetch(DISCORD_REPORT_CHANNEL_ID || DISCORD_STATUS_CHANNEL_ID);
        if (!channel) return reply.code(404).send({ error: 'Channel not found' });

        const embed = new EmbedBuilder()
            .setTitle(title || '[MODERATION] Mot interdit détecté')
            .setColor(0xff0000)
            .setTimestamp(new Date());

        if (description) embed.setDescription(description);
        if (Array.isArray(fields) && fields.length) embed.addFields(fields);

        // Buttons
        const baseUrl = process.env.BACKEND_URL || 'https://react.jipeg-corporation.eu';
        const profileUrl = `${baseUrl}/admin/users/${userId}`;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`chat_user_profile_${userId}`)
                .setLabel('Voir le profil')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`chat_context_${channelId}_${messageId}`)
                .setLabel('Voir contexte')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`chat_staff_${userId}`)
                .setLabel('Agir staff')
                .setStyle(ButtonStyle.Danger)
        );

        const sent = await channel.send({ embeds: [embed], components: [row] });

        return { ok: true, messageId: sent.id };
    } catch (e) {
        console.error('discord report-chat error:', e);
        return reply.code(500).send({ error: 'Report-chat failed' });
    }
});

app.post('/status/discord/forgot-password', async (req, reply) => {
    try {
        const secret = req.headers['x-report-secret'];
        const DISCORD_REPORT_SECRET = process.env.DISCORD_REPORT_SECRET || '';
        if (!secret || secret !== DISCORD_REPORT_SECRET) {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        const { username } = req.body || {};
        if (!username) return reply.code(400).send({ error: 'Username required' });

        const user = await prisma.user.findUnique({
            where: { username },
            select: { id: true, discordId: true, username: true, name: true }
        });

        // Fail silencieusement (pour la sécurité) mais on ne fait rien si pas de discordId
        if (!user || !user.discordId) {
            return { ok: true, message: 'Process initiated' };
        }

        // Générer un token à 6 chiffres
        const token = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        await prisma.user.update({
            where: { id: user.id },
            data: {
                tempPasswordToken: token,
                tempPasswordExpiresAt: expiresAt
            }
        });

        if (discordReady && discordClient) {
            try {
                const discordUser = await discordClient.users.fetch(user.discordId);
                if (discordUser) {
                    const frontendUrl = "https://react.jipeg-corporation.eu";
                    const resetUrl = `${frontendUrl}/reset-password?username=${encodeURIComponent(user.username)}&token=${token}`;
                    await discordUser.send(
                        `Bonjour **${user.name}**,\n\n` +
                        `Vous avez demandé la réinitialisation de votre mot de passe pour **Caillou's Clarity Accounting**.\n\n` +
                        `Votre code de réinitialisation est : **${token}**\n` +
                        `Ce code est valable pendant 15 minutes.\n\n` +
                        `Vous pouvez réinitialiser votre mot de passe en cliquant sur ce lien :\n${resetUrl}\n\n` +
                        `Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.`
                    );
                }
            } catch (discordErr) {
                console.error('Failed to send DM to user:', user.discordId, discordErr);
            }
        }

        return { ok: true };
    } catch (e) {
        console.error('discord forgot-password error:', e);
        return reply.code(500).send({ error: 'Failed' });
    }
});


async function updateDiscordStatusMessage() {
    if (!discordReady) return;

    try {
        const snapshot = await collectShardSnapshot();
        const channel = await discordClient.channels.fetch(DISCORD_STATUS_CHANNEL_ID);
        const msgId = await redis.get("discord:statusMessageId");
        const msg = msgId ? await channel.messages.fetch(msgId).catch(() => null) : null;
        if (!msg) return;

        const lines = [];
        for (const [name, info] of Object.entries(snapshot.shards)) {
            lines.push(
                `**${name}** — ${statusEmoji(info.status)}\n` +
                `• Uptime: ${info.uptime}\n` +
                `• Latence: ${info.latencyMs}ms\n`
            );
        }

        await msg.edit({
            content:
                `Statut des shards (maj <t:${Math.floor(Date.now() / 1000)}:R>)\n\n` +
                lines.join("\n")
        });
    } catch (err) {
        console.error("discord status update error:", err);
        setTimeout(updateDiscordStatusMessage, 2 * 60 * 1000);
    }
}

async function ensureStatusMessage() {
    const channel = await discordClient.channels.fetch(DISCORD_STATUS_CHANNEL_ID);
    if (!channel) throw new Error("Discord channel not found");

    let msgId = await redis.get("discord:statusMessageId");
    if (msgId) {
        const msg = await channel.messages.fetch(msgId).catch(() => null);
        if (msg) return msg;
    }

    const newMsg = await channel.send("Initialisation statut shards...");
    await redis.set("discord:statusMessageId", newMsg.id);
    return newMsg;
}

function scheduleStatusUpdater() {
    updateDiscordStatusMessage();
    setInterval(updateDiscordStatusMessage, 5 * 60 * 1000);
}

async function initDiscord() {
    if (!DISCORD_TOKEN || !DISCORD_STATUS_CHANNEL_ID) {
        console.log("Discord disabled (token/channel missing)");
        return;
    }

    // En cluster PM2, un seul worker gère le client Discord (un seul login par token)
    const canOwnDiscord = await redis.set('cluster:owner:discord', process.pid, 'NX', 'PX', 60000).catch(() => null);
    if (!canOwnDiscord) {
        console.log(`[MASTER] Discord géré par un autre worker cluster (pid=${process.pid} skipped)`);
        return;
    }
    // Renouvelle le lock tant que ce worker est vivant
    setInterval(() => redis.set('cluster:owner:discord', process.pid, 'XX', 'PX', 60000).catch(() => {}), 30000);

    discordClient = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    });

    discordClient.once('ready', async () => {
        discordReady = true;
        try {
            await ensureStatusMessage();
            scheduleStatusUpdater();
        } catch (err) {
            console.error("discord init error:", err);
        }
    });

    discordClient.on('interactionCreate', async interaction => {
        try {
            if (interaction.isButton()) {
                const { customId } = interaction;

                if (customId.startsWith('chat_context_')) {
                    const [, , channelId, messageId] = customId.split('_');

                    const messages = await prisma.chatMessage.findMany({
                        where: { channelId: BigInt(channelId), deletedAt: null },
                        orderBy: { createdAt: 'desc' },
                        take: 10,
                        include: { author: { select: { username: true, name: true } } }
                    });

                    const contextText = messages.reverse().map(m => {
                        const time = '(' + new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ')';
                        return `${time} **${m.author?.name || m.author?.username || 'Inconnu'}:** ${m.content}`;
                    }).join('\n');

                    await interaction.reply({
                        content: `**Contexte des 10 derniers messages :**\n\n${contextText || 'Aucun contexte trouvé'}`,
                        ephemeral: true
                    });
                }
                if (customId.startsWith('chat_user_profile_')) {
                    const [, , , userId] = customId.split('_');

                    const targetUser = await prisma.user.findUnique({
                        where: { id: Number(userId) },
                        include: {
                            employments: {
                                where: { status: 'ACTIVE' },
                                include: {
                                    company: { select: { name: true } },
                                    rank: { select: { name: true } }
                                }
                            }
                        }
                    });

                    if (!targetUser) {
                        return interaction.reply({ content: "Utilisateur non trouvé.", ephemeral: true });
                    }

                    const statusColor = targetUser.status === 'ACTIVE' ? 0x27ae60 : 0xc0392b;
                    const employmentsText = targetUser.employments.length > 0
                        ? targetUser.employments.map(e => `• **${e.company.name}** - ${e.rank.name}`).join('\n')
                        : "_Aucun emploi actif_";

                    const baseUrl = process.env.BACKEND_URL || 'https://react.jipeg-corporation.eu';
                    const thumbnailUrl = targetUser.imageUrl && targetUser.imageUrl.startsWith('/')
                        ? `${baseUrl}${targetUser.imageUrl}`
                        : targetUser.imageUrl;

                    const profileEmbed = new EmbedBuilder()
                        .setTitle(`Profil de ${targetUser.name}`)
                        .setThumbnail(thumbnailUrl)
                        .setColor(statusColor)
                        .addFields(
                            { name: 'Username', value: targetUser.username, inline: true },
                            { name: 'ID / CharID', value: `${targetUser.id} / ${targetUser.characterId || 'N/A'}`, inline: true },
                            { name: 'Statut', value: targetUser.status, inline: true },
                            { name: 'Discord ID', value: targetUser.discordId || 'N/A', inline: true },
                            { name: 'Téléphone', value: targetUser.phoneNumber || 'N/A', inline: true },
                            { name: 'Date d\'inscription', value: new Date(targetUser.createdAt).toLocaleDateString('fr-FR'), inline: true },
                            { name: 'Emplois Actifs', value: employmentsText }
                        )
                        .setTimestamp();

                    await interaction.reply({
                        embeds: [profileEmbed],
                        ephemeral: true
                    });
                }

                if (customId.startsWith('chat_staff_')) {
                    const [, , userId] = customId.split('_');

                    const modal = new ModalBuilder()
                        .setCustomId(`modal_staff_${userId}`)
                        .setTitle('Action Modération');

                    const textInput = new TextInputBuilder()
                        .setCustomId('staff_message_content')
                        .setLabel("Message privé à envoyer")
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(1024);

                    const actionRow = new ActionRowBuilder().addComponents(textInput);
                    modal.addComponents(actionRow);

                    await interaction.showModal(modal);
                }
            } else if (interaction.isModalSubmit()) {
                const { customId } = interaction;

                if (customId.startsWith('modal_staff_')) {
                    const [, , userId] = customId.split('_');
                    const messageContent = interaction.fields.getTextInputValue('staff_message_content');

                    // Récupérer le system staff user
                    const staffUser = await prisma.user.findFirst({ where: { username: 'system' } })
                        || await prisma.user.findFirst({
                            where: {
                                employments: {
                                    some: {
                                        rank: { position: { lte: 2 } }
                                    }
                                }
                            }
                        });

                    if (!staffUser) {
                        return interaction.reply({ content: "Impossible de trouver un compte staff pour envoyer le message.", ephemeral: true });
                    }

                    // Chercher ou créer un DM Conversation
                    let dmConv = await prisma.chatDmConversation.findFirst({
                        where: {
                            OR: [
                                { userAId: Number(userId), userBId: staffUser.id },
                                { userAId: staffUser.id, userBId: Number(userId) }
                            ]
                        }
                    });

                    if (!dmConv) {
                        dmConv = await prisma.chatDmConversation.create({
                            data: {
                                id: BigInt(generateSnowflake()),
                                userAId: Math.min(Number(userId), staffUser.id),
                                userBId: Math.max(Number(userId), staffUser.id)
                            }
                        });
                    }

                    // Insérer le message
                    const msgId = BigInt(generateSnowflake());
                    const msg = await prisma.chatDmMessage.create({
                        data: {
                            id: msgId,
                            content: "[Message de la modération] : " + messageContent,
                            authorId: staffUser.id,
                            conversationId: dmConv.id
                        },
                        include: { author: { select: { id: true, name: true, username: true } } }
                    });

                    // Convertir en DTO pour le frontend
                    const dto = {
                        id: msg.id.toString(),
                        conversationId: msg.conversationId.toString(),
                        authorId: msg.authorId,
                        content: msg.content,
                        createdAt: msg.createdAt,
                        authorName: msg.author?.name || msg.author?.username,
                        authorAvatar: null,
                    };

                    // Notifier via la gateway
                    await redis.publish('gateway:channel:CHAT_DM_BROADCAST', JSON.stringify({
                        event: 'DM_MESSAGE_CREATED',
                        payload: { message: dto, authorId: staffUser.id },
                        targets: [`user:${userId}`, `user:${staffUser.id}`]
                    }));

                    await interaction.reply({ content: `Le message a été envoyé à l'utilisateur ID ${userId} en DM.`, ephemeral: true });
                }
            }
        } catch (err) {
            console.error('[Discord Interaction Chat] Error:', err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: "Une erreur interne est survenue.", ephemeral: true }).catch(() => { });
            }
        }
    });

    try {
        await discordClient.login(DISCORD_TOKEN);
    } catch (err) {
        console.error("discord login failed:", err);
    }
}


// -------------------- INGEST OPTIMIZATION --------------------

// Converts req.body to a JSON string safely.
// The '*' catch-all parser (no parseAs) sets req.body = IncomingMessage (stream),
// which causes JSON.stringify to hit the Socket→HTTPParser→Socket circular reference.
function safeBodyString(body) {
    if (body == null) return null;
    if (typeof body === 'string') return body;
    if (Buffer.isBuffer(body)) return body.toString('utf8');
    if (typeof body === 'object' && typeof body.pipe !== 'function') {
        try { return JSON.stringify(body); } catch { return null; }
    }
    return null;
}

const ingestHandler = (req, reply) => {
    enqueueIngest({
        companyId: resolveCompanyId(req),
        url: req.url,
        method: req.method,
        headers: req.headers,
        bodyString: safeBodyString(req.body),
    }).catch(err => req.log.error({ err }, 'enqueueIngest failed'));

    return reply.code(200).send({ ok: true, queued: true });
};

app.post('/api/ingest/*', ingestHandler);
app.post('/ingest/*', ingestHandler);

// -------------------- SOCKET.IO PROXY (sans interception WS) --------------------
// @fastify/websocket intercepte les WS sur la route catch-all → reply.from() jamais appelé.
// Cette route dédiée évite l'interception et laisse reply-from gérer le tunnel WS.
app.all('/socket.io/*', async (req, reply) => {
    const { port } = await getOrCreateShard('global');
    const target = `http://127.0.0.1:${port}${req.url}`;
    return reply.from(target);
});

// -------------------- PROXY MAIN --------------------
app.all('/*', { websocket: true }, async (req, reply) => {
    // Websocket handled elsewhere (gateway)
    if (req.url.startsWith('/ws/')) {
        reply.code(404).send();
        return;
    }

    const companyId = resolveCompanyId(req);
    const url = req.url || '/';

    // Company validation
    try {
        if (companyId !== 'global') {
            const isActive = await isCompanyKnownActive(companyId);
            if (!isActive) return reply.code(200).send({ error: 'Unknown company' });
        }
    } catch (err) {
        console.error("company lookup failed:", err);
        return reply.code(500).send({ error: 'Company lookup failed' });
    }

    const { shardName, port } = await getOrCreateShard('global');
    const ready = await waitForShard(port);

    if (!ready) {
        // shard not ready : si bufferable => stocker pour replay
        if (isJsonBufferable(req)) {
            const bodyString = JSON.stringify(req.body ?? null);
            const id = await storeReplayRequest({
                companyId,
                shardName,
                url,
                method: req.method,
                headers: req.headers,
                bodyString,
            });
            
            return reply.code(503).send({ error: `Shard ${shardName} not ready`, replayId: id });
        }
        
        return reply.code(504).send({ error: `Shard ${shardName} not ready` });
    }

    await redis.set(`shard:${shardName}:status`, 'ok').catch(() => { });

    // Cas JSON bufferable : forward via fetch (cookies corrects + body fiable)
    if (isJsonBufferable(req)) {
        const bodyString = JSON.stringify(req.body ?? null);

        // On stocke avant forward => replay si crash/timeout/erreur
        const replayId = await storeReplayRequest({
            companyId,
            shardName,
            url,
            method: req.method,
            headers: req.headers,
            bodyString,
        });

        try {
            const res = await forwardBufferedToShard({
                port,
                url,
                method: req.method,
                headers: req.headers,
                bodyString,
            });

            // Gestion replay selon résultat
            if (res.ok) {
                await deleteReplay(replayId, shardName);
            } else {
                // auth/permanent => delete
                if (res.status === 401 || res.status === 403) {
                    await deleteReplay(replayId, shardName);
                } else if (res.status >= 400 && res.status <= 499 && !isRetryableStatus(res.status)) {
                    // autres 4xx non retryables
                    await deleteReplay(replayId, shardName);
                } else {
                    await bumpReplayFailure(replayId, shardName, `http_${res.status}`);
                }
            }

            await applyFetchResponseToFastifyReply(res, reply);
            return;
        } catch (e) {
            await bumpReplayFailure(replayId, shardName, e?.message || 'fetch_error');
            return reply.code(503).send({ error: 'Upstream fetch failed', replayId });
        }
    }

    // Cas flux/multipart/non-bufferable : proxy streaming (pas de replay)
    const target = `http://127.0.0.1:${port}${url}`;
    return reply.from(target);
});

// -------------------- SHARD CLEANUP ON EXIT --------------------
async function shutdown(sig) {
    console.log(`[MASTER] shutdown via ${sig}`);

    try {
        if (replayWorkerTimer) clearInterval(replayWorkerTimer);
        if (ingestWorkerTimer) clearInterval(ingestWorkerTimer);
        if (ingestFallbackWorkerTimer) clearInterval(ingestFallbackWorkerTimer);
        await shutdownGateway();

        console.log('[MASTER] Closing Fastify server...');
        await app.close();
        console.log('[MASTER] Fastify server closed.');

        // (Les clés Redis sont préservées pour le takeover ZDD par le nouveau master)
    } catch (e) {
        console.error('[MASTER] cleanup error:', e);
    } finally {
        try { await redis.quit(); } catch { }
        try { if (discordClient) await discordClient.destroy(); } catch { }
        process.exit(0);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// -------------------- BOOT --------------------
(async function start() {
    // Ouvre le port EN PREMIER pour minimiser le gap Apache lors d'un reload PM2.
    // Les syncs et l'attente des shards se font ensuite — le master peut déjà proxifier
    // (les shards existants restent vivants entre deux déploiements).
    try {
        await app.listen({ port: MASTER_PORT, host: '0.0.0.0' });
        console.log(`Master listening on ${MASTER_PORT}`);

        // reply.from() ne supporte pas les WS upgrades — on tunnelise au niveau TCP.
        app.server.on('upgrade', async (req, socket, head) => {
            const url = req.url || '';
            if (!url.startsWith('/socket.io/')) { socket.destroy(); return; }
            try {
                const { port } = await getOrCreateShard('global');
                const ready = await waitForShard(port, 30, 500);
                if (!ready) { socket.destroy(); return; }

                const dst = net.createConnection({ port, host: '127.0.0.1' });
                dst.once('connect', () => {
                    let hdr = `${req.method} ${url} HTTP/1.1\r\n`;
                    for (let i = 0; i < req.rawHeaders.length; i += 2) {
                        hdr += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
                    }
                    hdr += '\r\n';
                    dst.write(hdr);
                    if (head && head.length > 0) dst.write(head);
                    socket.pipe(dst);
                    dst.pipe(socket);
                });
                dst.on('error', () => { try { socket.destroy(); } catch {} });
                socket.on('error', () => { try { dst.destroy(); } catch {} });
            } catch (err) {
                console.error('[MASTER] WS upgrade error:', err.message);
                try { socket.destroy(); } catch {}
            }
        });

    } catch (err) {
        if (err.code === 'EADDRINUSE') {
            console.error(`[MASTER] ❌ Port ${MASTER_PORT} déjà utilisé. Arrêt.`);
            process.exit(1);
        }
        throw err;
    }

    await spawnGateway();

    // Les shards survivent entre deux reloads master (clés Redis préservées).
    // getOrCreateShard détecte le shard vivant via ping → pas de respawn inutile.
    console.log("[MASTER] Initializing core shards...");
    await getOrCreateShard('global');
    await getOrCreateShard('webhook');

    // Syncs non-bloquants pour le trafic : on les lance en parallèle
    await Promise.all([
        syncModules(),
        syncPermissionTemplates(),
        loadPermissions(),
        syncWidgets(),
    ]);

    await cleanupShardsOnBoot();
    await initDiscord();

    startReplayWorker();
    startIngestWorker();
    startIngestFallbackWorker();
    startGatewayMonitor();

    // Attend que les shards soient pingables avant de signaler PM2 "ready"
    const { port: gPort } = await getOrCreateShard('global');
    const { port: wPort } = await getOrCreateShard('webhook');
    console.log("[MASTER] Waiting for core shards to be pingable...");
    await Promise.all([
        waitForShard(gPort),
        waitForShard(wPort)
    ]);

    console.log("[MASTER] Shards ready.");
    if (process.send) process.send('ready');

    await checkRedisConnection();
})();
