// /backend/src/modules/immobilier/immobilier.routes.js
module.exports = {
    name: 'immobilier',
    routes: async function(fastify, options) {}, // Pas de routes
    systemSettings: {
        maxSalaryCap: 50000 // La limite pour les entreprises de ce type
    }
};