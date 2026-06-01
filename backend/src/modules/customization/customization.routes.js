// /backend/src/modules/customization/customization.routes.js

const controller = require('./customization.controller');

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function customizationRoutes(fastify, options) {
    // === Routes publiques ===
    // Renvoie le CSS dynamique (avec type text/css)
    fastify.get('/:companyId/theme.css', controller.getThemeCss);

    // === Routes protégées ===
    fastify.register(async (protectedRoutes) => {
        protectedRoutes.addHook('preHandler', fastify.authenticate);

        // Obtenir la configuration courante (retourne du JSON)
        protectedRoutes.get('/:companyId', controller.getThemeConfig);

        // Mettre à jour la conf
        protectedRoutes.put('/:companyId', controller.updateThemeConfig);

        // Uploader une image de thème (loading, banner, icon) — SVG ou PNG → WebP
        protectedRoutes.post('/:companyId/image/:imageType', controller.uploadThemeImage);
    });
}

module.exports = {
    name: 'customization',
    routes: customizationRoutes
};
