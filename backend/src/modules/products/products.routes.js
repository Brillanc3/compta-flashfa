// /backend/src/modules/products/products.routes.js

/**
 * Module Products — Routes et configuration
 * ------------------------------------------------------------
 * Fournit :
 *  - API CRUD produits et déclarations
 *  - Définition dynamique du schéma de rémunération (matrix fixe + %)
 *  - Intégration avec paymentSchemasLoader pour le front
 */

const controller = require('./products.controller');
const { PERMISSIONS, HIERARCHY } = require('./products.permissions');
const { hasPermission, buildEffectiveCompanyPermissions } = require('../../middleware/auth');

function parseCompanyId(request) {
    const rawCompanyId = request.headers['x-company-id'];
    const companyId = Number(rawCompanyId);
    return rawCompanyId && Number.isFinite(companyId) && companyId > 0 ? companyId : null;
}

/**
 * Vérification ALL/SELF calquée sur comptabilite.routes.js (canViewBills) :
 * - ALL : PRODUCTS.{companyId}.DECLARATIONS.VIEW  (ou PRODUCTS.{companyId}.MANAGE)
 * - SELF: (fallback) PRODUCTS.{companyId}.DECLARE
 *
 * Set:
 * - request.companyId
 * - request.declarationViewMode = 'ALL' | 'SELF'
 */

const canViewDeclarations = async (request, reply) => {
    const companyId = parseCompanyId(request);

    if (!companyId) {
        return reply.code(400).send({ message: "Header 'x-company-id' manquant ou invalide." });
    }

    request.companyId = companyId;

    const userId = request.user?.userId;
    if (!userId) {
        return reply.code(401).send({ message: 'Non authentifié.' });
    }

    const userPermissions = await buildEffectiveCompanyPermissions(userId, companyId);

    const permViewAll = PERMISSIONS.PRODUCTS_DECLARATION_VIEW.replace('{companyId}', String(companyId));
    const permManage = PERMISSIONS.PRODUCTS_MANAGE.replace('{companyId}', String(companyId));

    // SELF: permission dédiée si elle existe, sinon fallback sur DECLARE (compat avec tes perms actuelles)
    const permViewSelf = (PERMISSIONS.PRODUCTS_DECLARATION_VIEW_SELF || PERMISSIONS.PRODUCTS_DECLARE)
        .replace('{companyId}', String(companyId));
    const permDeclare = PERMISSIONS.PRODUCTS_DECLARE.replace('{companyId}', String(companyId));

    const canAll =
        hasPermission(userPermissions, permViewAll, HIERARCHY) ||
        hasPermission(userPermissions, permManage, HIERARCHY);

    if (canAll) {
        request.declarationViewMode = 'ALL';
        return;
    }

    const canSelf =
        hasPermission(userPermissions, permViewSelf, HIERARCHY) ||
        hasPermission(userPermissions, permDeclare, HIERARCHY);

    if (canSelf) {
        request.declarationViewMode = 'SELF';
        return;
    }

    return reply.code(403).send({
        message: "Accès interdit : Vous n'avez pas la permission de voir les déclarations produits."
    });
};

async function productsRoutes(fastify, options) {
    const auth = options && options.authMiddleware ? options.authMiddleware : {};
    const authenticate = auth.authenticate || (req => Promise.resolve());
    const checkModuleAccess = auth.checkModuleAccess || (() => (req, reply, done) => done());
    const checkPermission = auth.checkPermission || (() => () => (req, reply, done) => done());

    fastify.addHook('preHandler', authenticate);

    /** ----------------- ROUTES CRUD PRODUITS ----------------- **/

    fastify.post(
        '',
        {
            preHandler: [
                checkModuleAccess('Products'),
                checkPermission(PERMISSIONS.PRODUCTS_MANAGE, HIERARCHY)
            ].filter(Boolean)
        },
        controller.createProductHandler
    );

    fastify.put(
        '/:productId',
        {
            preHandler: [
                checkModuleAccess('Products'),
                checkPermission(PERMISSIONS.PRODUCTS_MANAGE, HIERARCHY)
            ].filter(Boolean)
        },
        controller.updateProductHandler
    );

    fastify.post(
        '/:productId/deactivate',
        {
            preHandler: [
                checkModuleAccess('Products'),
                checkPermission(PERMISSIONS.PRODUCTS_MANAGE, HIERARCHY)
            ].filter(Boolean)
        },
        controller.deactivateProductHandler
    );

    fastify.get(
        '',
        { preHandler: [checkModuleAccess('Products')].filter(Boolean) },
        controller.listProductsHandler
    );

    /** ----------------- DÉCLARATIONS PRODUITS ----------------- **/

    fastify.post(
        '/:productId/declare',
        {
            preHandler: [
                checkModuleAccess('Products'),
                checkPermission(PERMISSIONS.PRODUCTS_DECLARE, HIERARCHY)
            ].filter(Boolean)
        },
        controller.declareProductHandler
    );

    // ALL / SELF (comme compta)
    fastify.get(
        '/declarations',
        {
            preHandler: [checkModuleAccess('Products'), canViewDeclarations].filter(Boolean)
        },
        controller.listDeclarationsHandler
    );

    fastify.get(
        '/declarations/employees',
        {
            preHandler: [checkModuleAccess('Products'), canViewDeclarations].filter(Boolean),
        },
        controller.listDeclarationEmployeesHandler
    );

    fastify.get(
        '/declarations/weekly-summary',
        {
            preHandler: [checkModuleAccess('Products'), canViewDeclarations].filter(Boolean),
        },
        controller.weeklyDeclarationsSummaryHandler
    );

    fastify.patch(
        '/declarations/:declarationId',
        {
            preHandler: [
                checkModuleAccess('Products'),
                checkPermission(PERMISSIONS.PRODUCTS_DECLARATION_EDIT, HIERARCHY),
            ].filter(Boolean),
        },
        controller.updateDeclarationHandler
    );

    /** ----------------- WIDGET ----------------- **/
    fastify.get(
        '/widgets/declare_product_widget',
        { preHandler: [checkModuleAccess('Products')].filter(Boolean) },
        controller.getWidgetData_DeclareProductWidget
    );
}

/** ------------------------------------------------------------------
 *  Configuration du module pour paymentSchemasLoader
 * ------------------------------------------------------------------ */
module.exports = {
    name: 'products',
    routes: productsRoutes,

    /**
     * 💰 Schéma de rémunération dynamique
     * type: "matrix" → affichage en tableau dynamique côté front
     * Chaque ligne = un produit retourné par /products/:companyId/products
     */
    payments: [
        {
            key: 'productRemunerations',
            label: 'Rémunération par produit',
            type: 'matrix',
            description:
                'Configure les produits visibles et leur rémunération (montant fixe + pourcentage).',
            source: {
                type: 'api',
                url: '/products',
                labelField: 'name',
                valueField: 'id'
            },
            columns: [
                { key: 'visible', label: 'Visible', type: 'boolean', default: true },
                {
                    key: 'fixed',
                    label: 'Montant fixe ($)',
                    type: 'number',
                    min: 0,
                    max: 100000,
                    step: 0.01,
                    default: 0
                },
                {
                    key: 'percent',
                    label: 'Commission (%)',
                    type: 'number',
                    min: 0,
                    max: 100,
                    step: 0.1,
                    default: 0
                }
            ]
        }
    ],

    /**
     * 🔢 Salary calculators utilisés dans les calculs automatiques de paie
     */
    salaryCalculators: [
        {
            key: 'productRemunerations',
            serviceFunction: 'calculateProductRemuneration',
            drawingDetails: {
                label: 'Commissions Produits',
                template: '{calculatedValue} $'
            }
        }
    ]
};
