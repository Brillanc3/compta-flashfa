// backend/src/routes/auth.js

const { register, login, getMe, refreshToken, unlockSession, lockSession } = require('../controllers/authController');

// On importe notre garde du corps "authenticate" depuis le fichier central.
const { authenticate } = require('../middleware/auth');

async function authRoutes(fastify, options) {
    // Routes publiques
    fastify.post('/register', register);
    fastify.post('/login', login);
    fastify.post('/refresh-token', refreshToken);
    fastify.post('/unlock', unlockSession);
    fastify.post('/lock-session', { preHandler: [authenticate] }, lockSession);


    // Route protégée
    fastify.get('/me', { preHandler: [authenticate] }, getMe);
}

module.exports = authRoutes;