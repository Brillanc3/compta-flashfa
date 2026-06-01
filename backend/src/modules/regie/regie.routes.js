// /backend/src/modules/regie/regie.routes.js
'use strict';

const controller = require('./regie.controller');
const { PERMISSIONS, HIERARCHY } = require('./regie.permissions');

module.exports = {
    name: 'regie',
    routes: async (fastify, options) => {
        const { authenticate, checkPermission, checkModuleAccess } = options.authMiddleware;

        // Route publique pour OBS (Source Navigateur)
        // Permet de vérifier l'état d'urgence sans être authentifié (identifié par la clé secrète)
        fastify.get('/key-status/:key', controller.getKeyStatusHandler);

        // Groupe de routes protégées
        fastify.register(async (sub) => {
            sub.addHook('preHandler', authenticate);

            // Routes d'état et contrôle du serveur
            sub.get('/:companyId/status', {
                preHandler: [checkPermission(PERMISSIONS.REGIE_VIEW, HIERARCHY)]
            }, controller.getStatusHandler);

            sub.post('/:companyId/start', {
                preHandler: [checkPermission(PERMISSIONS.REGIE_CONTROL, HIERARCHY)]
            }, controller.startServerHandler);

            sub.post('/:companyId/stop', {
                preHandler: [checkPermission(PERMISSIONS.REGIE_CONTROL, HIERARCHY)]
            }, controller.stopServerHandler);

            // Routes de gestion des clés par entreprise
            sub.get('/:companyId/keys', {
                preHandler: [
                    checkModuleAccess('regie'),
                    checkPermission(PERMISSIONS.REGIE_VIEW, HIERARCHY)
                ]
            }, controller.listKeysHandler);

            sub.post('/:companyId/keys', {
                preHandler: [
                    checkModuleAccess('regie'),
                    checkPermission(PERMISSIONS.REGIE_MANAGE_KEYS, HIERARCHY)
                ]
            }, controller.generateKeyHandler);

            sub.delete('/:companyId/keys/:keyId', {
                preHandler: [
                    checkModuleAccess('regie'),
                    checkPermission(PERMISSIONS.REGIE_MANAGE_KEYS, HIERARCHY)
                ]
            }, controller.deleteKeyHandler);

            sub.put('/:companyId/keys/:keyId/emergency', {
                preHandler: [
                    checkModuleAccess('regie'),
                    checkPermission(PERMISSIONS.REGIE_CONTROL, HIERARCHY)
                ]
            }, controller.toggleEmergencyHandler);
        });
    }
};
