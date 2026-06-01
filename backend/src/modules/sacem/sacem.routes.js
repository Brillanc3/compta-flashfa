// /backend/src/modules/sacem/sacem.routes.js
'use strict';

const controller = require('./sacem.controller');
const { PERMISSIONS, HIERARCHY } = require('./sacem.permissions');

async function sacemRoutes(fastify, options) {
    const auth = options?.authMiddleware || {};
    const authenticate = auth.authenticate || (req => Promise.resolve());
    const checkPermission = auth.checkPermission || (() => () => (req, reply, done) => done());
    const checkModuleAccess = auth.checkModuleAccess || (() => (req, reply, done) => done());

    // Auth global pour toutes les routes
    fastify.addHook('preHandler', authenticate);

    /* ====================================================================== */
    /* 🧩 SACEM POSTS                                                         */
    /* ====================================================================== */

    fastify.get(
        '/',
        {
            preHandler: [
                checkModuleAccess('Sacem'),
                checkPermission(PERMISSIONS.SACEM_VIEW, HIERARCHY)
            ]
        },
        controller.listPostsHandler
    );

    fastify.get(
        '/:postId',
        {
            preHandler: [
                checkModuleAccess('Sacem'),
                checkPermission(PERMISSIONS.SACEM_VIEW, HIERARCHY)
            ]
        },
        controller.getPostDetailsHandler
    );

    fastify.post(
        '/preview',
        {
            preHandler: [
                checkModuleAccess('Sacem'),
                checkPermission(PERMISSIONS.SACEM_CREATE, HIERARCHY)
            ]
        },
        controller.previewImportHandler
    );

    fastify.post(
        '/import',
        {
            preHandler: [
                checkModuleAccess('Sacem'),
                checkPermission(PERMISSIONS.SACEM_CREATE, HIERARCHY)
            ]
        },
        controller.importSacemHandler
    );

    fastify.put(
        '/:postId',
        {
            preHandler: [
                checkModuleAccess('Sacem'),
                checkPermission(PERMISSIONS.SACEM_EDIT, HIERARCHY)
            ]
        },
        controller.updatePostHandler
    );

    fastify.get(
        '/stats',
        {
            preHandler: [
                checkModuleAccess('Sacem'),
                checkPermission(PERMISSIONS.SACEM_STATS, HIERARCHY)
            ]
        },
        controller.getStatsHandler
    );

    fastify.get(
        '/categories',
        {
            preHandler: [
                checkModuleAccess('Sacem'),
                checkPermission(PERMISSIONS.SACEM_VIEW, HIERARCHY)
            ]
        },
        controller.getCategoriesHandler
    );
}

module.exports = {
    name: 'sacem',
    isDefault: false,
    routes: sacemRoutes,

    /**
     * 💰 Configuration de la rémunération SACEM pour les Rangs
     */
    payments: [
        {
            key: 'isArtist',
            label: 'Rang Artiste',
            type: 'boolean',
            description: "Active le système de report de surplus SACEM à la semaine suivante (carryover).",
            default: false
        },
        {
            key: 'sacemPercentage',
            label: 'Pourcentage SACEM (%)',
            type: 'number',
            description: "Pourcentage de la part de l'employé reversé en bonus.",
            min: 0,
            max: 100,
            step: 0.1,
            default: 0
        },
        {
            key: 'sacemFixedPerPost',
            label: 'Fixe par poste SACEM ($)',
            type: 'number',
            description: "Montant fixe reçu pour chaque post auquel l'employé a participé.",
            min: 0,
            max: 10000,
            step: 1,
            default: 0
        }
    ],

    salaryCalculators: [
        {
            key: 'sacemPercentage',
            serviceFunction: 'calculateSacemPercentageSalary',
            drawingDetails: {
                label: 'Primes SACEM (%)',
                template: '{postsCount} posts : {percent}% = {calculatedValue}$'
            }
        },
        {
            key: 'sacemFixedPerPost',
            serviceFunction: 'calculateSacemFixedSalary',
            drawingDetails: {
                label: 'Primes SACEM (Fixe)',
                template: '{postsCount} posts * {fixedAmount}$/post = {calculatedValue}$'
            }
        },
        {
            key: 'isArtist',
            serviceFunction: 'calculateSacemArtistCarryover',
            drawingDetails: {
                label: 'Report SACEM (Artiste)',
                template: 'Report S-1 : +{surplus}$ (plafond {fixedSalary}$/semaine)'
            }
        }
    ]
};
