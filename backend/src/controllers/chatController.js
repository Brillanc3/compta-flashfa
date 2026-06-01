// backend/src/controllers/chatController.js

const chatService = require('../services/chatService')

/**
 * Crée une nouvelle conversation (tchat ou ticket).
 */
const postConversation = async (request, reply) => {
    try {
        const { type, participantIds, subject, category } = request.body;
        const creatorId = request.user.userId;

        if (!type || !participantIds) {
            return reply.code(400).send({ message: "Le type et les participants sont requis." });
        }

        const conversation = await chatService.createConversation({
            type,
            participantIds,
            creatorId,
            subject,
            category,
        });
        reply.code(201).send(conversation);
    } catch (error) {
        console.error("[ChatController] Erreur dans postConversation:", error);
        reply.code(500).send({ message: "Erreur lors de la création de la conversation." });
    }
};

/**
 * Récupère toutes les conversations de l'utilisateur connecté.
 */
const getConversations = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const conversations = await chatService.getUserConversations(userId);
        reply.send(conversations);
    } catch (error) {
        console.error("[ChatController] Erreur dans getConversations:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération des conversations." });
    }
};

/**
 * Récupère tous les messages d'une conversation spécifique.
 */
const getMessages = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const { conversationId } = request.params;
        const messages = await chatService.getConversationMessages(parseInt(conversationId, 10), userId);
        reply.send(messages);
    } catch (error) {
        console.error("[ChatController] Erreur dans getMessages:", error);
        // On renvoie le message d'erreur du service (ex: "Accès non autorisé")
        reply.code(403).send({ message: error.message });
    }
};

/**
 * Un admin prend en charge un ticket.
 */
const takeTicket = async (request, reply) => {
    try {
        const { conversationId } = request.params;
        const adminId = request.user.userId;
        const updatedTicket = await chatService.takeTicket(parseInt(conversationId, 10), adminId);
        reply.send(updatedTicket);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la prise en charge du ticket." });
    }
};

/**
 * Un admin ferme un ticket.
 */
const closeTicket = async (request, reply) => {
    try {
        const { conversationId } = request.params;
        const adminId = request.user.userId;
        const updatedTicket = await chatService.closeTicket(parseInt(conversationId, 10), adminId);
        reply.send(updatedTicket);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la fermeture du ticket." });
    }
};

/**
 * Un admin migre un ticket vers une autre catégorie.
 */
const migrateTicket = async (request, reply) => {
    try {
        const { conversationId } = request.params;
        const { newCategory } = request.body;
        const adminId = request.user.userId;

        if (!newCategory) {
            return reply.code(400).send({ message: "La nouvelle catégorie est requise." });
        }

        const updatedTicket = await chatService.migrateTicket(parseInt(conversationId, 10), newCategory, adminId);
        reply.send(updatedTicket);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la migration du ticket." });
    }
};

/**
 * Un utilisateur quitte une conversation.
 */
const leaveConversation = async (request, reply) => {
    try {
        const { conversationId } = request.params;
        const { isSilent } = request.body; // Pour le départ silencieux
        const userId = request.user.userId;
        await chatService.leaveConversation(parseInt(conversationId, 10), userId, isSilent);
        reply.code(204).send();
    } catch (error) {
        reply.code(500).send({ message: "Erreur en quittant la conversation." });
    }
};

/**
 * Met en sourdine (ou non) une conversation pour l'utilisateur.
 */
const toggleMuteConversation = async (request, reply) => {
    try {
        const { conversationId } = request.params;
        const userId = request.user.userId;
        const result = await chatService.toggleMuteConversation(parseInt(conversationId, 10), userId);
        reply.send(result); // Renvoie { isMuted: true/false }
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la mise à jour des notifications." });
    }
};

module.exports = {
    postConversation,
    getConversations,
    getMessages,
    takeTicket,
    closeTicket,
    migrateTicket,
    leaveConversation,
    toggleMuteConversation
};