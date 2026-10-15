// backend/src/modules/pawnshop/pawnshop.public.routes.js
// Routes publiques pawnshop — aucune authentification requise

const controller = require("./pawnshop.controller");

async function pawnshopPublicRoutes(fastify) {
    // Limitation par IP (partagée entre shards via Redis quand il est disponible)
    await fastify.register(require("@fastify/rate-limit"), {
        global: false,
        ...(fastify.redis ? { redis: fastify.redis, nameSpace: "pawnshop-public-rl:" } : {}),
    });

    const limit = (max, timeWindow) => ({ config: { rateLimit: { max, timeWindow } } });

    fastify.get("/pawnshop/public/:slug/config", limit(60, "1 minute"), controller.getPublicConfig);
    fastify.post("/pawnshop/public/:slug/estimation", limit(10, "10 minutes"), controller.submitPublicEstimation);
    fastify.post("/pawnshop/public/:slug/client/:clientId/cni", limit(10, "10 minutes"), controller.uploadPublicClientCni);
}

module.exports = pawnshopPublicRoutes;
