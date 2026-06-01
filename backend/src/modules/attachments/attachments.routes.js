// backend/src/modules/attachments/attachments.routes.js
'use strict';

/**
 * Attachments Module
 * - Public GET for viewing by (salonId, publicId)
 * - No upload here (upload stays in chat module later)
 *
 * Full path (behind reverse-proxy /api if applicable):
 *   GET /attachments/:salonId/:publicId
 */

const controller = require('./attachments.controller');

async function attachmentsRoutes(fastify, options) {
    // PUBLIC: pas d'auth ici

    fastify.get('/:salonId/:publicId', controller.serveAttachment);
}

module.exports = {
    name: 'attachments',
    routes: attachmentsRoutes,
};