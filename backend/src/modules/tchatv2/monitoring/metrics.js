'use strict';

const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'tchatv2_node_' });

// ── Compteurs / jauges exposés ────────────────────────────────────────────────

const messagesTotal = new client.Counter({
    name: 'tchatv2_messages_created_total',
    help: 'Nombre total de messages créés',
    registers: [register],
});

const wsConnections = new client.Gauge({
    name: 'tchatv2_ws_connections',
    help: 'Connexions WebSocket /v2 actives',
    registers: [register],
});

const presignTotal = new client.Counter({
    name: 'tchatv2_presign_requests_total',
    help: 'Nombre total de presigned URLs générées',
    registers: [register],
});

const cacheHitsTotal = new client.Counter({
    name: 'tchatv2_cache_hits_total',
    help: 'getOrCompute hits Redis',
    registers: [register],
});

const cacheMissesTotal = new client.Counter({
    name: 'tchatv2_cache_misses_total',
    help: 'getOrCompute misses Redis',
    registers: [register],
});

// ── API publique ──────────────────────────────────────────────────────────────

function incMessage()   { messagesTotal.inc(); }
function incPresign()   { presignTotal.inc(); }
function incCacheHit()  { cacheHitsTotal.inc(); }
function incCacheMiss() { cacheMissesTotal.inc(); }
function setWsConns(n)  { wsConnections.set(n); }
function incWsConns()   { wsConnections.inc(); }
function decWsConns()   { wsConnections.dec(); }

async function metricsText() {
    return register.metrics();
}

async function metricsJson() {
    const raw = await register.getMetricsAsJSON();
    // Résumé lisible par le panel admin
    const find = (name) => raw.find(m => m.name === name);

    const msgCounter   = find('tchatv2_messages_created_total');
    const wsGauge      = find('tchatv2_ws_connections');
    const presignCnt   = find('tchatv2_presign_requests_total');
    const hitCnt       = find('tchatv2_cache_hits_total');
    const missCnt      = find('tchatv2_cache_misses_total');

    const hits   = hitCnt?.values?.[0]?.value  ?? 0;
    const misses = missCnt?.values?.[0]?.value ?? 0;
    const total  = hits + misses;

    return {
        messages_created_total:  msgCounter?.values?.[0]?.value ?? 0,
        ws_connections:          wsGauge?.values?.[0]?.value    ?? 0,
        presign_requests_total:  presignCnt?.values?.[0]?.value ?? 0,
        cache_hit_ratio:         total > 0 ? +(hits / total).toFixed(4) : null,
        cache_hits_total:        hits,
        cache_misses_total:      misses,
    };
}

module.exports = {
    incMessage,
    incPresign,
    incCacheHit,
    incCacheMiss,
    setWsConns,
    incWsConns,
    decWsConns,
    metricsText,
    metricsJson,
    register,
};
