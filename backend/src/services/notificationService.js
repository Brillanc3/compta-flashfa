// backend/src/services/notificationService.js

const prisma = require('../db');
// MODIFIÉ : On importe sendMessageToUsers pour un envoi ciblé
const { sendMessageToUsers } = require('./webSocket.service');

/**
 * Service central pour la création de notifications.
 * @param {object} notificationData - Les données de la notification à créer.
 * @param {number[]} notificationData.recipientUserIds - Un tableau des ID des utilisateurs destinataires.
 * @param {object} notificationData.content - L'objet JSON du contenu (ex: { title, body }).
 * @param {string} notificationData.type - Le type de notif (SYSTEM, USER_SPECIFIC, etc.).
 * @param {string} notificationData.behavior - Le comportement (PERMANENT, BLOCKING, etc.).
 * @param {number|null} [notificationData.senderId] - L'ID de l'utilisateur qui envoie (optionnel).
 */
async function createNotification(notificationData) {
    const {
        recipientUserIds,
        content,
        type,
        behavior,
        senderId = null,
    } = notificationData;

    if (!recipientUserIds || recipientUserIds.length === 0) {
        console.warn("[NotificationService] Tentative de création d'une notification sans destinataire.");
        return;
    }

    try {
        const newNotification = await prisma.$transaction(async (tx) => {
            const notification = await tx.notification.create({
                data: {
                    content: JSON.stringify(content), // On convertit l'objet en chaîne JSON
                    type,
                    behavior,
                    senderId,
                }
            });

            const recipientsData = recipientUserIds.map(userId => ({
                notificationId: notification.id,
                userId: userId,
            }));

            await tx.notificationRecipient.createMany({
                data: recipientsData,
            });

            return notification;
        });

        // --- BLOC MODIFIÉ : Envoi WebSocket ciblé ---
        // On envoie un message direct aux utilisateurs concernés.
        sendMessageToUsers(recipientUserIds, {
            event: 'NOTIFICATION_CREATED',
            payload: {
                notification: { ...newNotification, content: content },
                recipientUserIds: recipientUserIds,
            }
        });
        // --- FIN DU BLOC MODIFIÉ ---

        console.log(`[NotificationService] Notification ID ${newNotification.id} créée pour ${recipientUserIds.length} utilisateur(s).`);
        return newNotification;

    } catch (error) {
        console.error("[NotificationService] Erreur lors de la création de la notification :", error);
    }
}

module.exports = {
    createNotification,
};