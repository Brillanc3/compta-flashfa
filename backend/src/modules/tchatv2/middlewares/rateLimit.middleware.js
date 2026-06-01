'use strict';

const { checkRateLimit } = require('../lib/rateLimit');

/**
 * Factory retournant un preHandler Fastify pour le rate limiting.
 *
 * @param {{ key: string | ((req: import('fastify').FastifyRequest) => string), windowMs: number, limit: number }} opts
 * @returns {import('fastify').preHandlerAsyncHookHandler}
 */
function rateLimit({ key: keyFn, windowMs, limit }) {
    return async function rateLimitHandler(req, reply) {
        const k   = typeof keyFn === 'function' ? keyFn(req) : keyFn;
        const now = Date.now();

        const [allowed, count, resetInMs] = await checkRateLimit(k, now, windowMs, limit);

        reply.header('X-RateLimit-Limit',     limit);
        reply.header('X-RateLimit-Remaining', Math.max(0, limit - count));
        reply.header('X-RateLimit-Reset',     Math.ceil((now + (resetInMs > 0 ? resetInMs : windowMs)) / 1000));

        if (!allowed) {
            return reply.code(429).send({
                code:        20029,
                message:     'You are being rate limited',
                retry_after: Math.ceil(resetInMs / 1000),
            });
        }
    };
}

module.exports = { rateLimit };
