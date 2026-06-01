// /backend/src/modules/notifications/notifications.routes.js

const controller = require('./notifications.controller');
const { PERMISSIONS } = require('./notifications.permissions');

/**
 * Enregistre les routes pour le module notifications.
 * @param {object} fastify - L'instance de Fastify.
 * @param {object} options - Les options passées à l'enregistrement, incluant le middleware.
 */
async function notificationRoutes(fastify, options) {
    const { authenticate, checkPermission } = options.authMiddleware;

    // Applique l'authentification à toutes les routes de ce module.
    fastify.addHook('preHandler', authenticate);

    // --- Routes de base (ne nécessitent PAS de permission spécifique) ---
    fastify.get('/', controller.getUserNotifications);
    fastify.post('/:id/acknowledge', controller.acknowledgeNotification);
    fastify.delete('/:id', controller.deleteNotification);

    // --- Route d'envoi (protégée par une permission spécifique) ---
    // Note: Le `checkPermission` ne gère pas nativement les placeholders dans le corps de la route.
    // La vérification de la compagnie se fait dans le contrôleur/service.
    // La permission ici est une protection générale.
    fastify.post('/send', {
        preHandler: [checkPermission(PERMISSIONS.SEND)]
    }, controller.sendNotification);
}

// Export conforme à la structure attendue par server.js
module.exports = {
    name: 'notifications',
    isDefault: true,
    routes: notificationRoutes
};