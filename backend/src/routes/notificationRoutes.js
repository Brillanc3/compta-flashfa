// backend/src/routes/notificationRoutes.js

const {
    getUserNotifications,
    acknowledgeNotification,
    deleteNotification,
    sendNotification
} = require('../controllers/notificationController');

const { authenticate, checkPermission } = require('../middleware/auth');

/**
 * Définit les routes pour la gestion des notifications de l'utilisateur.
 * @param {object} fastify - L'instance de Fastify.
 */
async function notificationRoutes(fastify, options) {

    // Toutes les routes de ce fichier nécessitent que l'utilisateur soit authentifié.
    // On applique le middleware 'authenticate' à toutes les routes de ce plugin.
    fastify.addHook('preHandler', authenticate);

    // Récupérer la liste des notifications pour l'utilisateur connecté
    fastify.get('/', getUserNotifications);

    // Marquer une notification "bloquante" comme acceptée
    fastify.post('/:id/acknowledge', acknowledgeNotification);

    // Supprimer une notification (pour les types "permanent" ou "temporaire")
    fastify.delete('/:id', deleteNotification);

    // Envoyer une notification à une cible au sein d'une entreprise
    fastify.post('/company/:id/send', {
        preHandler: [checkPermission('COMPANY.{id}.NOTIFICATIONS.SEND')]
    }, sendNotification);

}

module.exports = notificationRoutes;