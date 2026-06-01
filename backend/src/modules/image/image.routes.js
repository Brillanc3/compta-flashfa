// /backend/src/modules/image/image.routes.js

const controller = require('./image.controller.js');

// On peut définir ici les permissions nécessaires pour ce module
const PERMISSIONS = {
    COMPANY_IMAGE_EDIT: 'COMPANY.{companyId}.IMAGES.EDIT', // {companyId} sera remplacé dynamiquement
};

async function routes(fastify, options) {
    const { authenticate, checkPermission } = options.authMiddleware;

    // --- Route Publique pour SERVIR une image ---
    // Pas besoin d'authentification pour voir une image par son lien
    fastify.get('/:publicId', controller.serveImage);

    // --- Routes Protégées pour UPLOAD une image ---

    // Pour que l'utilisateur connecté change sa propre image de profil
    fastify.post('/user/profile-picture', {
        preHandler: [authenticate]
    }, controller.uploadProfilePicture);

    // Pour qu'un gérant upload une image pour une entreprise spécifique
    fastify.post('/company/:companyId/picture', {
        preHandler: [
            authenticate,
            // Le checkPermission remplacera dynamiquement {companyId} par la valeur de l'URL
            checkPermission(PERMISSIONS.COMPANY_IMAGE_EDIT)
        ]
    }, controller.uploadCompanyImage);
}

module.exports = {
    name: 'images', // Le préfixe de l'URL sera /api/images
    routes: routes,
};