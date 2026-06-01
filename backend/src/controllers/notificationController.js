// backend/src/controllers/notificationController.js

const prisma = require('../db');
const { createNotification } = require('../services/notificationService');


/**
 * Récupère toutes les notifications non-acceptées (pour les modales) et récentes
 * pour l'utilisateur actuellement authentifié.
 */
const getUserNotifications = async (request, reply) => {
    try {
        const userId = request.user.userId;

        const notifications = await prisma.notificationRecipient.findMany({
            where: {
                userId: userId,
            },
            include: {
                // On inclut le contenu de la notification parente
                notification: true,
            },
            orderBy: {
                notification: {
                    createdAt: 'desc',
                },
            },
            take: 50, // On limite à 50 pour ne pas surcharger
        });

        reply.send(notifications);
    } catch (error) {
        console.error("[NotificationController] Erreur dans getUserNotifications:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération des notifications." });
    }
};

/**
 * Marque une notification "BLOCKING" comme acceptée.
 * Envoie un accusé de réception à l'expéditeur si la notification était bloquante.
 */
const acknowledgeNotification = async (request, reply) => {
    try {
        const acknowledgingUserId = request.user.userId;
        const recipientId = parseInt(request.params.id, 10);

        // On vérifie que la notification appartient bien à l'utilisateur et on inclut les détails
        // de la notification parente pour la logique d'accusé de réception.
        const recipientRecord = await prisma.notificationRecipient.findFirst({
            where: { id: recipientId, userId: acknowledgingUserId },
            include: {
                notification: true, // Inclure les détails de la notif (comportement, senderId)
            },
        });

        if (!recipientRecord) {
            return reply.code(404).send({ message: "Notification non trouvée ou non autorisée." });
        }

        // On met à jour la notification pour la marquer comme lue
        const updatedRecord = await prisma.notificationRecipient.update({
            where: { id: recipientId },
            data: { isAcknowledged: true },
        });

        // --- NOUVELLE LOGIQUE : Accusé de réception ---
        const originalNotification = recipientRecord.notification;
        // On envoie un accusé de réception seulement si la notif était bloquante ET avait un expéditeur
        if (originalNotification.behavior === 'BLOCKING' && originalNotification.senderId) {

            // 1. Trouver l'entreprise commune entre l'expéditeur et celui qui accepte
            const [senderCompanies, acknowledgerCompanies] = await Promise.all([
                prisma.companyEmployee.findMany({ where: { userId: originalNotification.senderId }, select: { companyId: true } }),
                prisma.companyEmployee.findMany({ where: { userId: acknowledgingUserId }, select: { companyId: true } })
            ]);

            const senderCompanyIds = new Set(senderCompanies.map(c => c.companyId));
            const commonCompany = acknowledgerCompanies.find(c => senderCompanyIds.has(c.companyId));

            // 2. Si une entreprise commune est trouvée, on envoie la notification de confirmation
            if (commonCompany) {
                const acknowledgingUser = await prisma.user.findUnique({ where: { id: acknowledgingUserId }, select: { name: true } });

                await createNotification({
                    recipientUserIds: [originalNotification.senderId],
                    content: {
                        title: "Accusé de réception",
                        body: `L'utilisateur **${acknowledgingUser.name}** a lu et accepté votre notification : "${originalNotification.content.title}".`
                    },
                    behavior: 'PERMANENT',
                    type: 'SYSTEM',
                    companyId: commonCompany.companyId, // On passe l'ID pour la diffusion WebSocket
                });
            }
        }

        reply.send(updatedRecord);

    } catch (error) {
        console.error("[NotificationController] Erreur dans acknowledgeNotification:", error);
        reply.code(500).send({ message: "Erreur lors de l'acceptation de la notification." });
    }
};

/**
 * Supprime une notification pour un utilisateur.
 * (Utilisé pour "marquer comme lu" une notif temporaire, ou supprimer une notif permanente).
 */
const deleteNotification = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const recipientId = parseInt(request.params.id, 10);

        // Prisma garantit ici que l'utilisateur ne peut supprimer que ses propres
        // notifications grâce à une recherche sur un identifiant unique combiné.
        const result = await prisma.notificationRecipient.deleteMany({
            where: {
                id: recipientId,
                userId: userId, // Condition de sécurité cruciale
            }
        });

        // deleteMany ne renvoie pas d'erreur si rien n'est trouvé, il renvoie un 'count'.
        if (result.count === 0) {
            return reply.code(404).send({ message: "Notification non trouvée ou non autorisée." });
        }

        reply.code(204).send(); // 204 No Content = Succès sans rien renvoyer
    } catch (error) {
        console.error("[NotificationController] Erreur dans deleteNotification:", error);
        reply.code(500).send({ message: "Erreur lors de la suppression de la notification." });
    }
};

/**
 * Envoie une notification à une cible spécifique (utilisateur, rang, ou tous).
 */
const sendNotification = async (request, reply) => {
    try {
        const senderId = request.user.userId;
        const companyId = parseInt(request.params.id, 10);
        const { target, content, behavior } = request.body;
        // target = { type: 'RANK' | 'USER' | 'ALL', value: ID_DU_RANG_OU_USER }

        if (!target || !content || !behavior) {
            return reply.code(400).send({ message: "Les champs 'target', 'content', et 'behavior' sont requis." });
        }

        let recipientUserIds = [];

        // 1. Déterminer la liste des destinataires en fonction de la cible
        switch (target.type) {
            case 'USER':
                // Cible : un utilisateur unique
                recipientUserIds.push(parseInt(target.value, 10));
                break;
            case 'RANK':
                // Cible : tous les employés ayant un certain rang
                const rankId = parseInt(target.value, 10);
                const employeesInRank = await prisma.companyEmployee.findMany({
                    where: { companyId, rankId },
                    select: { userId: true }
                });
                recipientUserIds = employeesInRank.map(emp => emp.userId);
                break;
            case 'ALL':
                // Cible : tous les employés de l'entreprise
                const allEmployees = await prisma.companyEmployee.findMany({
                    where: { companyId },
                    select: { userId: true }
                });
                recipientUserIds = allEmployees.map(emp => emp.userId);
                break;
            default:
                return reply.code(400).send({ message: `Type de cible '${target.type}' non valide.` });
        }

        if (recipientUserIds.length === 0) {
            return reply.code(404).send({ message: "Aucun destinataire trouvé pour la cible spécifiée." });
        }

        // 2. Appeler le service pour créer et diffuser la notification
        await createNotification({
            recipientUserIds,
            content,
            behavior,
            type: 'USER_SPECIFIC', // Envoyé manuellement par un utilisateur
            senderId,
            companyId,
        });

        reply.code(202).send({ message: `Notification envoyée à ${recipientUserIds.length} utilisateur(s).` });

    } catch (error) {
        console.error("[NotificationController] Erreur dans sendNotification:", error);
        reply.code(500).send({ message: "Erreur lors de l'envoi de la notification." });
    }
};

module.exports = {
    getUserNotifications,
    acknowledgeNotification,
    deleteNotification,
    sendNotification
};