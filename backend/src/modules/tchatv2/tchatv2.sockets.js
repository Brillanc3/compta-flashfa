'use strict';

/**
 * Point d'entrée Socket.io V2 — appelé depuis server.js après app.listen().
 * Délègue à sockets/socket.handler.js.
 *
 * @param {{ fastify: import('fastify').FastifyInstance }} opts
 * @returns {import('socket.io').Server}
 */
function setupV2Sockets({ fastify }) {
    const { initV2Sockets } = require('./sockets/socket.handler');
    const io = initV2Sockets(fastify);
    console.log('[tchatv2] ✅ Socket.io V2 — namespace /v2 sur path /socket.io/v2');
    return io;
}

module.exports = { setupV2Sockets };
