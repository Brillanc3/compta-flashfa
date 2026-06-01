// /backend/src/modules/notifications/notifications.controller.js

const prisma = require('../../db');
const { createNotification, sendNotificationService } = require('./notifications.service');

/**
 * Récupère les notifications pour l'utilisateur authentifié.
 * @param {object} request - L'objet de requête Fastify.
 * @param {object} reply - L'objet de réponse Fastify.
 */
const getUserNotifications = async (request, reply) => {
    try {
        const userId = request.user.userId;

        const notifications = await prisma.notificationRecipient.findMany({
            where: { userId: userId },
            include: { notification: true },
            orderBy: { notification: { createdAt: 'desc' } },
            take: 50,
        });

        reply.send(notifications);
    } catch (error) {
        console.error("[NotificationController] Erreur dans getUserNotifications:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération des notifications." });
    }
};

/**
 * Marque une notification comme lue/acceptée.
 * @param {object} request - L'objet de requête Fastify.
 * @param {object} reply - L'objet de réponse Fastify.
 */
const acknowledgeNotification = async (request, reply) => {
    try {
        const acknowledgingUserId = request.user.userId;
        const recipientId = parseInt(request.params.id, 10);

        const recipientRecord = await prisma.notificationRecipient.findFirst({
            where: { id: recipientId, userId: acknowledgingUserId },
            include: { notification: true },
        });

        if (!recipientRecord) {
            return reply.code(404).send({ message: "Notification non trouvée ou non autorisée." });
        }

        const updatedRecord = await prisma.notificationRecipient.update({
            where: { id: recipientId },
            data: { isAcknowledged: true },
        });

        const originalNotification = recipientRecord.notification;
        if (originalNotification.behavior === 'BLOCKING' && originalNotification.senderId) {
            const [senderCompanies, acknowledgerCompanies] = await Promise.all([
                prisma.companyEmployee.findMany({ where: { userId: originalNotification.senderId }, select: { companyId: true } }),
                prisma.companyEmployee.findMany({ where: { userId: acknowledgingUserId }, select: { companyId: true } })
            ]);
            const senderCompanyIds = new Set(senderCompanies.map(c => c.companyId));
            const commonCompany = acknowledgerCompanies.find(c => senderCompanyIds.has(c.companyId));

            if (commonCompany) {
                const acknowledgingUser = await prisma.user.findUnique({ where: { id: acknowledgingUserId }, select: { name: true } });
                await createNotification({
                    recipientUserIds: [originalNotification.senderId],
                    content: {
                        title: "Accusé de réception",
                        body: `L'utilisateur **${acknowledgingUser.name}** a lu et accepté votre notification.`
                    },
                    behavior: 'PERMANENT',
                    type: 'SYSTEM',
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
 * @param {object} request - L'objet de requête Fastify.
 * @param {object} reply - L'objet de réponse Fastify.
 */
const deleteNotification = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const recipientId = parseInt(request.params.id, 10);

        const result = await prisma.notificationRecipient.deleteMany({
            where: { id: recipientId, userId: userId }
        });

        if (result.count === 0) {
            return reply.code(404).send({ message: "Notification non trouvée ou non autorisée." });
        }

        reply.code(204).send();
    } catch (error) {
        console.error("[NotificationController] Erreur dans deleteNotification:", error);
        reply.code(500).send({ message: "Erreur lors de la suppression de la notification." });
    }
};

/**
 * Controller – aucune logique SQL ici
 */
async function sendNotification(request, reply) {
    const rid = `notif_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    try {
        const senderId = Number(request.user.userId);
        const companyId = Number(request.headers['x-company-id']);
        const { targets, content, behavior } = request.body;

        // ------------------ VALIDATION DE BASE ------------------

        if (!companyId || !Array.isArray(targets) || targets.length === 0) {
            return reply.code(400).send({
                message: "companyId et targets sont requis.",
            });
        }

        if (!content?.title || !content?.body) {
            return reply.code(400).send({
                message: "content.title et content.body sont requis.",
            });
        }

        if (!['PERMANENT', 'TEMPORARY', 'BLOCKING'].includes(behavior)) {
            return reply.code(400).send({
                message: "behavior invalide.",
            });
        }

        // Validation des targets
        for (const t of targets) {
            if (!['ALL', 'USERS', 'RANKS'].includes(t.type)) {
                return reply.code(400).send({
                    message: `Type de cible invalide : ${t.type}`,
                });
            }

            if (t.type !== 'ALL') {
                if (!Array.isArray(t.ids) || t.ids.length === 0) {
                    return reply.code(400).send({
                        message: `ids requis pour le type ${t.type}`,
                    });
                }
            }
        }

        // ------------------ APPEL SERVICE ------------------

        const result = await sendNotificationService({
            senderId,
            companyId,
            targets,
            content,
            behavior,
        });

        return reply.code(202).send({
            message: `Notification envoyée.`,
            recipients: result.recipientCount,
        });

    } catch (err) {
        request.log.error({ rid, err }, '[notifications/send] error');

        return reply.code(err.statusCode || 500).send({
            message: err.message || "Erreur lors de l'envoi de la notification.",
        });
    }
}

module.exports = {
    getUserNotifications,
    acknowledgeNotification,
    deleteNotification,
    sendNotification
};