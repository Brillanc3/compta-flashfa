'use strict';

const { metricsText, metricsJson } = require('./metrics');

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;

    fastify.addHook('preHandler', authenticate);

    // GET /v2/monitoring/metrics — format Prometheus (scraping Grafana/Prometheus)
    fastify.get('/monitoring/metrics', async (req, reply) => {
        reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        return metricsText();
    });

    // GET /v2/monitoring/metrics/json — résumé JSON pour panel admin React
    fastify.get('/monitoring/metrics/json', async () => {
        return metricsJson();
    });
}

module.exports = { routes };
