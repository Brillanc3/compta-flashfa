'use strict';

const { redis } = require('../../../shards/redisClient');

// Sliding window via sorted set — chaque entrée = timestamp de la requête
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window_ms)
local count = redis.call('ZCARD', key)

if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldest_ts = oldest[2] and tonumber(oldest[2]) or now
  local reset_in = oldest_ts + window_ms - now
  return {0, count, reset_in}
end

redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))
redis.call('PEXPIRE', key, window_ms)
return {1, count + 1, 0}
`;

/**
 * @param {string} key  clé Redis
 * @param {number} now  Date.now()
 * @param {number} windowMs  durée de la fenêtre en ms
 * @param {number} limit  nb max de requêtes
 * @returns {Promise<[allowed: boolean, count: number, resetInMs: number]>}
 */
async function checkRateLimit(key, now, windowMs, limit) {
    const result = await redis.eval(SLIDING_WINDOW_SCRIPT, 1, key, now, windowMs, limit);
    return [result[0] === 1, Number(result[1]), Number(result[2])];
}

module.exports = { checkRateLimit };
