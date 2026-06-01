// /backend/src/modules/garage/garage.routes.js

'use strict';

const controller = require('./garage.controller');
const { PERMISSIONS, HIERARCHY } = require('./garage.permissions');

/**
 * Routes du module GARAGE
 * - Nécessitent l'entreprise active via header: x-company-id
 * - Permissions dynamiques par entreprise
 */
async function garageRoutes(fastify, options) {
    const { authenticate, checkPermission } = options.authMiddleware;

    fastify.addHook('preHandler', authenticate);

    // VIEW : accès lecture
    const canView = {
        preHandler: [checkPermission(PERMISSIONS.VIEW, HIERARCHY)]
    };

    // MANAGE : gestion véhicules
    const canManage = {
        preHandler: [checkPermission(PERMISSIONS.MANAGE, HIERARCHY)]
    };

    /* --------------------------------------------------------
       VEHICLES (CRUD)
    --------------------------------------------------------- */

    // Liste véhicules enregistrés
    fastify.get('/vehicles', canView, controller.getVehicles);

    // Créer un véhicule (nom + plaque)
    fastify.post('/vehicles', canManage, controller.createVehicle);

    // Modifier un véhicule
    fastify.patch('/vehicles/:id', canManage, controller.updateVehicle);

    // Supprimer un véhicule
    fastify.delete('/vehicles/:id', canManage, controller.deleteVehicle);

    /* --------------------------------------------------------
       MOVEMENTS (Entrées / Sorties)
    --------------------------------------------------------- */

    fastify.get('/movements', canView, controller.getMovements);
}

module.exports = {
    name: 'garage',
    isDefault: true,
    routes: garageRoutes,
};
