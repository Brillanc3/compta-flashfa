// /backend/src/modules/tickets/tickets.routes.js
'use strict';

const controller = require('./tickets.controller');

/**
 * Routes du module Tickets.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {{ authMiddleware: { authenticate: Function, checkPermission: Function } }} options
 */
async function ticketsRoutes(fastify, options) {
    const { authenticate } = options.authMiddleware;

    // Toutes les routes tickets sont réservées aux utilisateurs connectés
    fastify.addHook('preHandler', authenticate);

    /* ===========================
     * Admin routes
     * Prefix global du module: /tickets
     * =========================== */
    fastify.get('/admin', controller.listAdminTickets);
    fastify.get('/admin/:ticketId', controller.getAdminTicket);
    fastify.get('/admin/:ticketId/messages', controller.listAdminTicketMessages);

    fastify.post('/admin/:ticketId/take', controller.takeTicket);
    fastify.post('/admin/:ticketId/join', controller.joinTicket);

    fastify.post('/admin/:ticketId/messages', controller.postAdminTicketMessage);

    // Force assign / reassign / unassign
    fastify.post('/admin/:ticketId/assign', controller.forceAssignTicket);

    // Demande de clôture (auto-close +24h dans lot BullMQ)
    fastify.post('/admin/:ticketId/closure-request', controller.requestClosure);

    // Fermeture manuelle par l'agent
    fastify.post('/admin/:ticketId/close', controller.closeAdminTicket);

    // Profil du demandeur (assignee OU ADMIN.*)
    fastify.get('/admin/:ticketId/requester-profile', controller.getRequesterProfile);

    /* ===========================
     * User routes (créateur)
     * =========================== */
    fastify.get('/', controller.listMyTickets);
    fastify.post('/', controller.createMyTicket);

    fastify.get('/:ticketId', controller.getMyTicket);

    fastify.get('/:ticketId/messages', controller.listMyTicketMessages);
    fastify.post('/:ticketId/messages', controller.postMyTicketMessage);

    fastify.post('/:ticketId/close', controller.closeMyTicket);
    fastify.post('/:ticketId/reopen', controller.reopenMyTicket);
}

module.exports = { name: 'tickets', routes: ticketsRoutes };
