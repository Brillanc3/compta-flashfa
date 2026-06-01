// backend/src/services/chatService.js

const prisma = require('../db');
const { createNotification } = require('./notificationService');
const { subMinutes } = require('date-fns');
const { sendMessageToUsers } = require('./webSocket.service');

const MESSAGE_LIMIT = 100;

// Fonction centralisée pour envoyer un message système
async function _sendSystemMessage(conversationId, content) {
    const message = await prisma.message.create({
        data: {
            conversationId,
            content,
            type: 'SYSTEM', // On utilise notre nouveau type
        },
    });
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { participants: { select: { id: true } } },
    });
    if (conversation) {
        sendMessageToUsers(conversation.participants.map(p => p.id), {
            event: 'NEW_MESSAGE',
            payload: message,
        });
    }
    return message;
}

// Pour centraliser la logique de vérification des permissions de tickets
async function _getUserTicketPermissions(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { permissions: true, roles: { include: { permissions: true } } }
    });

    if (!user) return { canManageAnyTicket: false, managedCategories: [] };

    const userPermissions = new Set();
    user.permissions.forEach(p => userPermissions.add(p.action));
    user.roles.forEach(role => role.permissions.forEach(p => userPermissions.add(p.action)));

    const hasGlobalTicketPermission = userPermissions.has('ADMIN.PANEL.TICKETS.*') || userPermissions.has('ADMIN.PANEL.*') || userPermissions.has('ADMIN.*');

    let managedCategories = [];
    if (hasGlobalTicketPermission) {
        managedCategories = ['BILLING', 'TECHNICAL', 'GENERAL', 'CONTACT', 'OTHER'];
    } else {
        userPermissions.forEach(perm => {
            const prefix = 'ADMIN.PANEL.TICKETS.';
            if (perm.startsWith(prefix)) {
                const permCategory = perm.substring(prefix.length);
                const categoryMap = {
                    'BILLING_SUPPORT': 'BILLING',
                    'TECH_SUPPORT': 'TECHNICAL',
                    'OTHERS': 'OTHER',
                };
                if (categoryMap[permCategory]) {
                    managedCategories.push(categoryMap[permCategory]);
                }
            }
        });
    }

    return {
        canManageAnyTicket: managedCategories.length > 0,
        managedCategories,
    };
}

/**
 * Crée une nouvelle conversation (tchat ou ticket).
 * @param {object} data
 * @param {'DIRECT'|'GROUP'|'TICKET'} data.type - Le type de conversation.
 * @param {number[]} data.participantIds - IDs des utilisateurs participant à la conversation.
 * @param {number} data.creatorId - ID de l'utilisateur qui crée la conversation.
 * @param {string} [data.subject] - Sujet (pour les tickets).
 * @param {'BILLING'|'TECHNICAL'|'GENERAL'|'CONTACT'|'OTHER'} [data.category] - Catégorie (pour les tickets).
 * @returns {Promise<object>} La nouvelle conversation.
 */
async function createConversation({ type, participantIds, creatorId, subject, category }) {
    const allParticipantIds = [...new Set([...participantIds, creatorId])];

    const conversation = await prisma.conversation.create({
        data: {
            type,
            subject,
            category,
            status: type === 'TICKET' ? 'OPEN' : null,
            participants: {
                connect: allParticipantIds.map(id => ({ id })),
            },
        },
        include: {
            participants: { select: { id: true, name: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
    });

    const recipientIds = participantIds.filter(id => id !== creatorId);


    if (recipientIds.length > 0) {
        sendMessageToUsers(recipientIds, {
            event: 'NEW_CONVERSATION',
            payload: conversation,
        });
    }

    return conversation;
}


/**
 * Ajoute un message à une conversation et applique les règles de gestion.
 * @param {object} data
 * @param {number} data.conversationId - ID de la conversation.
 * @param {number} data.senderId - ID de l'expéditeur.
 * @param {string} data.content - Contenu du message.
 * @returns {Promise<object>} Le nouveau message.
 */
async function addMessage({ conversationId, senderId, content }) {

    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { type: true, status: true, participants: { select: { id: true } } },
    });

    if (!conversation) {
        throw new Error("Conversation non trouvée.");
    }

    // CRITIQUE : VÉRIFICATION DU STATUT DU TICKET
    if (conversation.type === 'TICKET' &&
        (conversation.status === 'RESOLVED' || conversation.status === 'CLOSED')) {
        throw new Error("Impossible d'envoyer un message : ce ticket est fermé.");
    }


    // Utilise une transaction pour garantir l'intégrité des données
    const newMessage = await prisma.$transaction(async (tx) => {
        // 1. Crée le nouveau message
        const createdMessage = await tx.message.create({
            data: {
                conversationId,
                senderId,
                content,
            },
            include: {
                sender: { select: { id: true, name: true } },
            },
        });

        // 2. Met à jour la date 'updatedAt' de la conversation
        await tx.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
        });

        // 3. Logique de limitation à 100 messages
        const messageCount = await tx.message.count({ where: { conversationId } });
        if (messageCount > MESSAGE_LIMIT) {
            const oldestMessage = await tx.message.findFirst({
                where: { conversationId },
                orderBy: { createdAt: 'asc' },
                select: { id: true },
            });
            if (oldestMessage) {
                await tx.message.delete({ where: { id: oldestMessage.id } });
            }
        }

        return createdMessage;
    });

    // 4. Logique de notification non-dupliquée et envoi WebSocket
    if (conversation) {
        const recipientIds = conversation.participants.map(p => p.id);

        // Envoie l'événement de nouveau message à tous les participants
        sendMessageToUsers(recipientIds, {
            event: 'NEW_MESSAGE',
            payload: newMessage,
        });
    }

    return newMessage;
}


/**
 * Récupère les conversations d'un utilisateur, avec les nouvelles règles de visibilité.
 */
async function getUserConversations(userId) {
    const { managedCategories } = await _getUserTicketPermissions(userId);

    // Simplification de la logique de visibilité
    const whereClause = {
        OR: [
            // 1. Je suis participant direct (inclut tickets dont je suis l'auteur/destinataire)
            { participants: { some: { id: userId } } },
        ],
    };

    // 2. Si j'ai des droits de gestion, j'ajoute les tickets correspondants
    if (managedCategories.length > 0) {
        whereClause.OR.push({
            type: 'TICKET',
            OR: [
                // a) Le ticket m'est assigné
                { assigneeId: userId },
                // b) J'ai le droit de gérer cette catégorie (tickets non assignés)
                { assigneeId: null, category: { in: managedCategories } },
            ]
        });
    }


    return prisma.conversation.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        include: {
            participants: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } }, // On inclut l'assigné
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
            // Ajout du statut mute pour l'utilisateur connecté
            mutedByUsers: { where: { userId } }
        },
    });
}

/**
 * Récupère les messages d'une conversation spécifique, avec vérification des droits.
 */
async function getConversationMessages(conversationId, userId) {
    // On réutilise la logique de permission
    const { managedCategories } = await _getUserTicketPermissions(userId);

    // On vérifie que l'utilisateur a le droit de voir cette conversation
    const conversation = await prisma.conversation.findFirst({
        where: {
            id: conversationId,
            OR: [
                // Soit il est participant
                { participants: { some: { id: userId } } },
                // Soit c'est un ticket qu'il a le droit de voir
                { type: 'TICKET', category: { in: managedCategories } }
            ]
        }
    });

    if (!conversation) {
        throw new Error("Conversation non trouvée ou accès non autorisé.");
    }

    // Si la vérification passe, on ajoute l'admin comme participant pour qu'il reçoive les futurs messages
    // (uniquement s'il n'est pas déjà participant)
    const isAlreadyParticipant = await prisma.user.count({
        where: { id: userId, conversations: { some: { id: conversationId } } }
    });

    if (!isAlreadyParticipant) {
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { participants: { connect: { id: userId } } }
        });
    }

    // On retourne les messages
    return prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: { id: true, name: true } } },
    });
}

/**
 * Un admin prend en charge un ticket.
 */
async function takeTicket(ticketId, adminId) {
    const updatedTicket = await prisma.conversation.update({
        where: { id: ticketId },
        data: { assigneeId: adminId, status: 'IN_PROGRESS' },
        include: { participants: true, assignee: true }, // On inclut les relations pour la notif
    });

    // Envoie un événement de mise à jour à tous les participants
    const participantIds = updatedTicket.participants.map(p => p.id);
    sendMessageToUsers(participantIds, {
        event: 'CONVERSATION_UPDATED',
        payload: updatedTicket,
    });

    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    await _sendSystemMessage(ticketId, `${admin.name} a pris en charge le ticket.`);

    return updatedTicket;
}

/**
 * Un admin ferme un ticket.
 */
async function closeTicket(ticketId, adminId) {
    const updatedTicket = await prisma.conversation.update({
        where: { id: ticketId },
        data: { status: 'CLOSED' },
        include: { participants: true, assignee: true },
    });

    const participantIds = updatedTicket.participants.map(p => p.id);
    sendMessageToUsers(participantIds, {
        event: 'CONVERSATION_UPDATED',
        payload: updatedTicket,
    });

    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    await _sendSystemMessage(ticketId, `${admin.name} a fermé le ticket.`);

    return updatedTicket;
}

/**
 * Un admin migre un ticket vers une autre catégorie.
 */
async function migrateTicket(ticketId, newCategory, adminId) {
    const updatedTicket = await prisma.conversation.update({
        where: { id: ticketId },
        data: {
            category: newCategory,
            assigneeId: null,
            status: 'OPEN',
        },
        include: { participants: true, assignee: true },
    });

    const participantIds = updatedTicket.participants.map(p => p.id);
    // On notifie tout le monde (les anciens et les nouveaux admins potentiels) de la mise à jour
    sendMessageToUsers(participantIds, {
        event: 'CONVERSATION_UPDATED',
        payload: updatedTicket,
    });

    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    await _sendSystemMessage(ticketId, `${admin.name} a migré le ticket vers la catégorie "${newCategory}". Un autre agent va prendre le relais.`);

    return updatedTicket;
}

/**
 * Un utilisateur quitte une conversation de groupe.
 */
async function leaveConversation(conversationId, userId, isSilent = false) {
    if (!isSilent) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        await _sendSystemMessage(conversationId, `${user.name} a quitté la conversation.`);
    }
    return prisma.conversation.update({
        where: { id: conversationId },
        data: {
            participants: {
                disconnect: { id: userId },
            },
        },
    });
}

/**
 * Met une conversation en sourdine (ou réactive les notifications).
 * @param {number} userId
 * @param {number} conversationId
 */
async function toggleMuteConversation(userId, conversationId) {
    const existingMute = await prisma.mutedConversation.findUnique({
        where: { userId_conversationId: { userId, conversationId } },
    });

    if (existingMute) {
        // Si la sourdine existe, on la supprime (unmute)
        await prisma.mutedConversation.delete({
            where: { userId_conversationId: { userId, conversationId } },
        });
        return { isMuted: false };
    } else {
        // Sinon, on la crée (mute)
        await prisma.mutedConversation.create({
            data: { userId, conversationId },
        });
        return { isMuted: true };
    }
}


module.exports = {
    createConversation,
    addMessage,
    getConversationMessages,
    getUserConversations,
    takeTicket,
    closeTicket,
    migrateTicket,
    leaveConversation,
    toggleMuteConversation
};