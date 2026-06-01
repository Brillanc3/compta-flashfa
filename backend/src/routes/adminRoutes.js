// backend/src/routes/employeeRoutes.js
const { authenticate } = require('../middleware/auth');
const {getAllUsers} = require("../controllers/userController");

async function employeeRoutes(fastify, options) {
    // Applique l'authentification à toutes les routes de ce fichier
    fastify.addHook('preHandler', authenticate);
    fastify.get('/users', getAllUsers);
}

module.exports = employeeRoutes;