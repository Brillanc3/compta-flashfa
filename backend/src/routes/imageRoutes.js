// backend/src/routes/imageRoutes.js

const {
    serveImage,
    uploadProfilePicture,
    uploadCompanyImage,
} = require('../controllers/imageController');

const { authenticate, checkPermission } = require('../middleware/auth');

async function imageRoutes(fastify, options) {

    // --- Route Publique pour Afficher une Image ---
    // Cette route est accessible sans authentification.
    // L'URL permanente de l'image (ex: /api/images/cky...) pointera ici.
    fastify.get('/:publicId', serveImage);

    // --- Routes Protégées pour l'Upload ---

    // Route pour que l'utilisateur connecté change sa propre image de profil.
    // Note: la route a été déplacée de userRoutes.js à ici pour la centralisation.
    fastify.post('/user/profile-picture', {
        preHandler: [authenticate]
    }, uploadProfilePicture);


    // Route pour qu'un gérant upload une image pour son entreprise
    fastify.post('/company/:id/picture', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.IMAGES.EDIT')]
    }, uploadCompanyImage);

}

module.exports = imageRoutes;