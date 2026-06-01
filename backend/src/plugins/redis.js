// backend/src/plugins/redis.js
'use strict';
const fp = require('fastify-plugin');
const IORedis = require('ioredis');

module.exports = fp(async function redisPlugin(fastify) {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    const redis = new IORedis(url, { 
        lazyConnect: true,
        keyPrefix: process.env.ENV === 'dev' ? 'dev:' : 'prod:',
    });
    redis.on('error', (e) => fastify.log.error({ e }, 'Redis error'));
    await redis.connect();

    fastify.decorate('redis', redis);

    fastify.addHook('onClose', async () => {
        try { await redis.quit(); } catch {}
    });
});
