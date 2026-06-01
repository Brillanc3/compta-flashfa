// backend/src/routes/chatRoutes.js

const {
    postConversation,
    getConversations,
    getMessages,
    takeTicket,
    closeTicket,
    migrateTicket,
    leaveConversation,
    toggleMuteConversation
} = require('../controllers/chatController');

const { authenticate } = require('../middleware/auth');

/**
 * Définit les routes pour la gestion du tchat et des tickets.
 * @param {object} fastify - L'instance de Fastify.
 */
async function chatRoutes(fastify, options) {

    // On applique le middleware d'authentification à toutes les routes.
    fastify.addHook('preHandler', authenticate);

    // --- Routes de base ---
    fastify.get('/conversations', getConversations);
    fastify.post('/conversations', postConversation);
    fastify.get('/conversations/:conversationId/messages', getMessages);

    // --- NOUVELLES ROUTES POUR LES ACTIONS DU MENU CONTEXTUEL ---

    // Un utilisateur quitte une conversation
    fastify.post('/conversations/:conversationId/leave', leaveConversation);

    // Un utilisateur met en sourdine / réactive les notifications d'une conversation
    fastify.post('/conversations/:conversationId/mute', toggleMuteConversation);
    // --- Actions réservées aux admins de tickets ---

    // Un admin prend en charge un ticket
    // Note: La permission est vérifiée dans le service qui détermine si l'admin a le droit de voir le ticket
    fastify.post('/conversations/:conversationId/take', takeTicket);

    // Un admin ferme un ticket
    fastify.post('/conversations/:conversationId/close', closeTicket);

    // Un admin migre un ticket
    fastify.patch('/conversations/:conversationId/migrate', migrateTicket);

}

module.exports = chatRoutes;