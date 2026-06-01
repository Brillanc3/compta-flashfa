'use strict';

const { redis } = require('../../../shards/redisClient');
const metrics   = require('../monitoring/metrics');

const PREFIX = 'v2';

/**
 * Construit une clé Redis namespaced.
 * @param {...string} parts
 * @returns {string}
 */
function key(...parts) {
    return [PREFIX, ...parts].join(':');
}

/**
 * @param {string} k
 * @returns {Promise<any|null>}
 */
async function get(k) {
    const raw = await redis.get(k);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return raw; }
}

/**
 * @param {string} k
 * @param {any} value
 * @param {number} ttlSec
 */
async function set(k, value, ttlSec) {
    const str = JSON.stringify(value);
    await redis.set(k, str, 'EX', ttlSec);
}

/**
 * @param {string} k
 */
async function del(k) {
    await redis.del(k);
}

/**
 * Supprime toutes les clés matching un pattern via SCAN + UNLINK (non-bloquant).
 * @param {string} pattern
 */
async function delPattern(pattern) {
    let cursor = '0';
    do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = nextCursor;
        if (keys.length > 0) {
            await redis.unlink(...keys);
        }
    } while (cursor !== '0');
}

/**
 * Cache-aside : retourne la valeur en cache ou calcule et stocke.
 * @param {string} k
 * @param {number} ttlSec
 * @param {() => Promise<any>} asyncFn
 * @returns {Promise<any>}
 */
async function getOrCompute(k, ttlSec, asyncFn) {
    const cached = await get(k);
    if (cached !== null) {
        metrics.incCacheHit();
        return cached;
    }
    metrics.incCacheMiss();
    const value = await asyncFn();
    await set(k, value, ttlSec);
    return value;
}

module.exports = { key, get, set, del, delPattern, getOrCompute };
