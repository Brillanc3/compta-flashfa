// frontend/src/services/notificationService.js

import api from './api'; // On importe l'instance Axios pré-configurée

/**
 * Récupère les notifications pour l'utilisateur actuellement connecté.
 * @returns {Promise<Array>} La liste des enregistrements NotificationRecipient.
 */
export const getUserNotifications = async () => {
    try {
        const { data } = await api.get('/notifications');
        return data;
    } catch (error) {
        console.error("Erreur lors de la récupération des notifications:", error);
        throw error;
    }
};

/**
 * Marque une notification comme "acceptée" (pour les modales bloquantes).
 * @param {number} recipientId - L'ID de l'enregistrement NotificationRecipient.
 * @returns {Promise<Object>} L'enregistrement mis à jour.
 */
export const acknowledgeNotification = async (recipientId) => {
    try {
        const { data } = await api.post(`/notifications/${recipientId}/acknowledge`);
        return data;
    } catch (error) {
        console.error(`Erreur lors de l'acceptation de la notification ${recipientId}:`, error);
        throw error;
    }
};

/**
 * Supprime une notification pour l'utilisateur.
 * @param {number} recipientId - L'ID de l'enregistrement NotificationRecipient.
 * @returns {Promise<void>}
 */
export const deleteNotification = async (recipientId) => {
    try {
        await api.delete(`/notifications/${recipientId}`);
    } catch (error) {
        console.error(`Erreur lors de la suppression de la notification ${recipientId}:`, error);
        throw error;
    }
};

/**
 * Envoie une nouvelle notification depuis le widget.
 * @param {object} payload - Les données de la notification à envoyer.
 * @param {object} payload.targets - La cible de la notification (ex: { type: 'RANK', value: 1 }).
 * @param {object} payload.content - Le contenu de la notification (ex: { title: 'Titre', body: 'Message' }).
 * @param {string} payload.behavior - Le comportement de la notification ('PERMANENT', 'TEMPORARY', 'BLOCKING').
 * @returns {Promise<Object>} La réponse de l'API.
 */
export const sendNotification = async ({ targets, content, behavior }) => {
    if (!Array.isArray(targets) || targets.length === 0) {
        throw new Error("Aucune cible définie pour la notification.");
    }

    if (!content?.title || !content?.body) {
        throw new Error("Le titre et le contenu sont requis.");
    }

    try {
        const { data } = await api.post("/notifications/send", {
            targets,
            content,
            behavior,
        });

        return data;
    } catch (error) {
        console.error("[sendNotification] error:", error);
        throw error;
    }
};