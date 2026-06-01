// /backend/src/modules/inventory/inventory.routes.js

'use strict';

const controller = require('./inventory.controller');
const ownersController = require('./inventoryOwners.controller');
const { PERMISSIONS, HIERARCHY } = require('./inventory.permissions');

/**
 * Middleware dynamique identique à canViewBills, mais pour INVENTAIRE.
 *
 * IMPORTANT :
 *  - companyId = parseInt(request.headers['x-company-id'], 10);
 *  - userId = request.user.userId
 */
const buildCanViewInventory = (checkPermission) => {
    return async (request, reply) => {
        const rawCompanyId = request.headers['x-company-id'];
        const companyId = parseInt(rawCompanyId, 10);

        if (!rawCompanyId || Number.isNaN(companyId)) {
            return reply.code(400).send({
                message: "Header 'x-company-id' manquant ou invalide."
            });
        }

        request.companyId = companyId;

        // Permissions dynamiques
        const permViewAll = PERMISSIONS.VIEW_ALL.replace('{companyId}', companyId);
        const permViewSelf = PERMISSIONS.VIEW_SELF.replace('{companyId}', companyId);

        // Test VIEW_ALL
        const checkAll = checkPermission(permViewAll, HIERARCHY);
        try {
            await checkAll(request, reply);
            request.inventoryViewMode = 'ALL';
            return;
        } catch (_) {
            // continue
        }

        // Test VIEW_SELF
        const checkSelf = checkPermission(permViewSelf, HIERARCHY);
        try {
            await checkSelf(request, reply);
            request.inventoryViewMode = 'SELF';
            return;
        } catch (_) {
            return reply.code(403).send({
                message: "Accès interdit : vous n'avez pas la permission de voir l'inventaire."
            });
        }
    };
};

async function inventoryRoutes(fastify, options) {
    const { authenticate, checkModuleAccess, checkPermission } = options.authMiddleware;

    // Auth globale (comme employees / comptabilite)
    fastify.addHook('preHandler', authenticate);

    const canViewInventory = buildCanViewInventory(checkPermission);

    fastify.get(
        '/',
        {
            preHandler: [
                checkModuleAccess('Inventory'),
                canViewInventory,
            ],
        },
        controller.getInventory
    );

    /* -------------------------------------------------
       OWNERS (Mappings)
    -------------------------------------------------- */
    fastify.get(
        '/owners',
        {
            preHandler: [
                checkModuleAccess('Inventory'),
                // Optionnellement restreindre à ceux qui peuvent voir tout
                // canViewInventory, 
            ],
        },
        ownersController.getOwners
    );

    fastify.post(
        '/owners',
        {
            preHandler: [
                checkModuleAccess('Inventory'),
                // Permission spécifique pour gérer les noms ? 
                // Pour l'instant on check juste l'accès au module
            ],
        },
        ownersController.upsertOwner
    );

    fastify.delete(
        '/owners/:id',
        {
            preHandler: [
                checkModuleAccess('Inventory'),
            ],
        },
        ownersController.deleteOwner
    );
}

module.exports = {
    name: 'inventory',
    isDefault: true,
    routes: inventoryRoutes,
};
