// /backend/src/modules/partenariat/partenariat.routes.js

/**
 * Module Partenariat — Routes & configuration
 * ------------------------------------------------------------
 * Fournit :
 *  - API CRUD partenaires
 *  - API CRUD services liés aux partenaires
 *  - API services rendus (prestations)
 *  - Résumé hebdomadaire (avec includeEmployees)
 *  - Schémas de rémunération dynamiques (matrix)
 *
 * ⚠️ companyId est récupéré via le header `x-company-id`
 */

const controller = require('./partenariat.controller');
const { PERMISSIONS, HIERARCHY } = require('./partenariat.permissions');

async function partenariatRoutes(fastify, options) {
    const auth = options?.authMiddleware || {};
    const authenticate = auth.authenticate || (req => Promise.resolve());
    const checkPermission = auth.checkPermission || (() => () => (req, reply, done) => done());
    const checkModuleAccess = auth.checkModuleAccess || (() => (req, reply, done) => done());

    // Auth global pour toutes les routes
    fastify.addHook('preHandler', authenticate);

    /* ====================================================================== */
    /* 🧩 PARTENAIRES                                                         */
    /* ====================================================================== */

    fastify.get(
        '/',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.PARTNER_LIST, HIERARCHY)
            ]
        },
        controller.listPartnersHandler
    );

    fastify.get(
        '/wdg_list',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.SERVICE_RENDERED_LIST, HIERARCHY)
            ]
        },
        controller.listPartnersHandler
    );

    fastify.post(
        '/',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.PARTNER_CREATE, HIERARCHY)
            ]
        },
        controller.createPartnerHandler
    );

    fastify.put(
        '/:partnerId',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.PARTNER_UPDATE, HIERARCHY)
            ]
        },
        controller.updatePartnerHandler
    );

    fastify.post(
        '/:partnerId/deactivate',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.PARTNER_DEACTIVATE, HIERARCHY)
            ]
        },
        controller.deactivatePartnerHandler
    );

    fastify.post(
        '/:partnerId/activate',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.PARTNER_ACTIVATE, HIERARCHY)
            ]
        },
        controller.activatePartnerHandler
    );




    fastify.get(
        '/:partnerId',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.PARTNER_LIST, HIERARCHY)
            ]
        },
        controller.getPartnerByIdHandler
    );

    /* ====================================================================== */
    /* 🧩 SERVICES PAR PARTENAIRE                                             */
    /* ====================================================================== */

    fastify.post(
        '/:partnerId/services',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.SERVICE_TYPE_CREATE, HIERARCHY)
            ]
        },
        controller.createPartnerServiceTypeHandler
    );

    fastify.put(
        '/:partnerId/services/:serviceTypeId',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.SERVICE_TYPE_UPDATE, HIERARCHY)
            ]
        },
        controller.updatePartnerServiceTypeHandler
    );

    fastify.post(
        '/:partnerId/services/:serviceTypeId/deactivate',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.SERVICE_TYPE_DEACTIVATE, HIERARCHY)
            ]
        },
        controller.deactivatePartnerServiceTypeHandler
    );

    fastify.post(
        '/:partnerId/services/:serviceTypeId/activate',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.SERVICE_TYPE_DEACTIVATE, HIERARCHY)
            ]
        },
        controller.activatePartnerServiceTypeHandler
    );

    fastify.get(
        '/:partnerId/services',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.SERVICE_TYPE_LIST, HIERARCHY)
            ]
        },
        controller.listPartnerServiceTypesHandler
    );

    fastify.get(
        '/:partnerId/services_widgets',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.SERVICE_RENDERED_CREATE, HIERARCHY)
            ]
        },
        controller.listPartnerServiceTypesForWidgetHandler
    );

    // Liste globale des services actifs (pour rémunération)
    fastify.get(
        '/services',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.SERVICE_TYPE_LIST, HIERARCHY)
            ]
        },
        controller.listAllActiveServicesForCompanyHandler
    );

    /* ====================================================================== */
    /* 🧩 SERVICES RENDUS                                                     */
    /* ====================================================================== */

    fastify.post(
        '/services-rendered',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.SERVICE_RENDERED_CREATE, HIERARCHY)
            ]
        },
        controller.createServiceRenderedHandler
    );

    fastify.put(
        '/services-rendered/:serviceRenderedId',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.SERVICE_RENDERED_UPDATE, HIERARCHY)
            ]
        },
        controller.updateServiceRenderedHandler
    );

    fastify.get(
        '/services-rendered',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.SERVICE_RENDERED_CREATE, HIERARCHY)
            ]
        },
        controller.listServicesRenderedHandler
    );

    fastify.get(
        '/full-services-rendered',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.PARTNER_LIST, HIERARCHY)
            ]
        },
        controller.listAllServicesRenderedHandler
    );

    /* ====================================================================== */
    /* 🧮 RÉCAPITULATIF HEBDOMADAIRE                                          */
    /* ====================================================================== */

    fastify.get(
        '/summary/weekly',
        {
            preHandler: [
                checkModuleAccess('Partenariat'),
                checkPermission(PERMISSIONS.WEEKLY_TOTAL_VIEW, HIERARCHY)
            ]
        },
        controller.getWeeklySummaryHandler
    );

    /* ====================================================================== */
    /* 🧩 WIDGETS                                                             */
    /* ====================================================================== */

    // Mes services rendus (widget)
    fastify.get(
        '/widgets/my_services',
        {
            preHandler: [
                checkModuleAccess('Partenariat')
            ]
        },
        controller.getWidget_MyServices
    );

}

/* ========================================================================== */
/* 🧮 CONFIGURATION POUR paymentSchemasLoader                                */
/* ========================================================================== */

module.exports = {
    name: 'partenariat',
    routes: partenariatRoutes,

    /**
     * 💰 Rémunération dynamique des services partenaires
     */
    payments: [
        {
            key: 'partnerServiceRemunerations',
            label: 'Rémunération des services partenaires',
            type: 'matrix',
            description:
                "Rémunération dynamique basée sur les services actifs de chaque partenaire.",
            source: {
                type: 'api',
                url: '/partenariat/services',
                labelField: 'name',
                valueField: 'id'
            },
            columns: [
                {
                    key: 'visible',
                    label: 'Visible',
                    type: 'boolean',
                    default: true
                },
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
     * 🔢 Salary calculators
     * Utilisé par le moteur de paie pour rémunérer les employés.
     */
    salaryCalculators: [
        {
            key: 'partnerServiceRemunerations',
            serviceFunction: 'calculatePartnerServiceRemuneration',
            drawingDetails: {
                label: 'Commissions partenaires',
                template: '{calculatedValue} $'
            }
        }
    ],

    /**
     * 📊 Colonnes personnalisées pour la liste des employés
     */
    employeeListPageColumns: [
        { key: 'pdsTotalAmount', label: 'Total PDS ($)', serviceFunction: 'getPdsStatsForEmployeeList' },
        { key: 'pdsTotalCount', label: 'Total PDS (Nb)', serviceFunction: 'getPdsStatsForEmployeeList' }
    ]
};
