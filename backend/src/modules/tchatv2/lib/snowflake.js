'use strict';

const {
    configureSnowflake,
    generateSnowflake,
    decomposeSnowflake,
    toBigInt,
    asString,
    isValidSnowflake,
} = require('../../../utils/snowflake');

// Epoch V2 figée : 2025-01-01T00:00:00Z
const V2_EPOCH_MS = BigInt(Date.UTC(2025, 0, 1, 0, 0, 0, 0));

// Instance singleton V2 — workerId dédié
const V2_WORKER_ID = Number(process.env.SHARD_ID || process.env.SNOWFLAKE_NODE_ID || process.pid) % 1024;

// Contexte privé V2 : état seq + lastTs propre à ce module
let _lastTs = -1n;
let _seq    = 0n;

const NODE_SHIFT  = 12n;
const TIME_SHIFT  = 22n;
const MAX_SEQ     = 4095n;
const NODE_BIG    = BigInt(V2_WORKER_ID);

function _currentTs() {
    const raw = BigInt(Date.now()) - V2_EPOCH_MS;
    return raw < 0n ? 0n : raw;
}

function _waitNext(ts) {
    let now = _currentTs();
    while (now <= ts) now = _currentTs();
    return now;
}

/**
 * Génère un Snowflake V2.
 * @param {number|null} [forceMs] - timestamp absolu en ms (pour migration)
 * @returns {bigint}
 */
function nextV2(forceMs) {
    let ts;
    if (forceMs != null) {
        ts = BigInt(forceMs) - V2_EPOCH_MS;
        if (ts < 0n) ts = 0n;
        // En mode forceMs, séquence auto-incrémentée si même ms
        if (ts === _lastTs) {
            _seq = (_seq + 1n) & MAX_SEQ;
            if (_seq === 0n) ts = ts + 1n;
        } else {
            _seq = 0n;
        }
    } else {
        ts = _currentTs();
        if (ts < _lastTs) ts = _lastTs;
        if (ts === _lastTs) {
            _seq = (_seq + 1n) & MAX_SEQ;
            if (_seq === 0n) ts = _waitNext(ts);
        } else {
            _seq = 0n;
        }
    }
    _lastTs = ts;
    return (ts << TIME_SHIFT) | (NODE_BIG << NODE_SHIFT) | _seq;
}

/**
 * Parse un Snowflake V2 (avec epoch V2).
 * @param {bigint|string|number} id
 * @returns {{ timestamp: number, date: Date, nodeId: number, sequence: number }}
 */
function parseV2(id) {
    const bid = toBigInt(id, 'id');
    const ts  = bid >> TIME_SHIFT;
    const node = (bid >> NODE_SHIFT) & 1023n;
    const seq  = bid & MAX_SEQ;
    const unixMs = Number(ts + V2_EPOCH_MS);
    return { timestamp: unixMs, date: new Date(unixMs), nodeId: Number(node), sequence: Number(seq) };
}

module.exports = {
    // V2 API
    nextV2,
    parseV2,
    V2_EPOCH_MS,
    V2_WORKER_ID,
    // Ré-exports utils partagés
    generateSnowflake,
    decomposeSnowflake,
    toBigInt,
    asString,
    isValidSnowflake,
};
