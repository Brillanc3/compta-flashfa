// backend/src/modules/pawnshop/pawnshop.public.routes.js
// Routes publiques pawnshop — aucune authentification requise

const controller = require("./pawnshop.controller");

async function pawnshopPublicRoutes(fastify) {
    fastify.get("/pawnshop/public/:slug/config", controller.getPublicConfig);
    fastify.post("/pawnshop/public/:slug/estimation", controller.submitPublicEstimation);
    fastify.post("/pawnshop/public/:slug/client/:clientId/cni", controller.uploadPublicClientCni);
}

module.exports = pawnshopPublicRoutes;
