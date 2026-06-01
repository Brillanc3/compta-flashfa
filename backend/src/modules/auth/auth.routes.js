// /backend/src/modules/auth/auth.routes.js

const { authenticate } = require('../../middleware/auth');
const {
    login,
    refreshToken,
    logout,
    me,
    register,
    permissions,
    verifyResetToken,
    confirmResetPassword,
    forgotPassword,
} = require('./auth.controller');


async function routes(fastify, options) {

    // ROUTES PUBLIQUES
    fastify.post('/login', login);
    fastify.post('/refresh', refreshToken);
    fastify.post('/register', register);
    fastify.post('/reset/verify', verifyResetToken);
    fastify.post('/reset/confirm', confirmResetPassword);
    fastify.post('/forgot-password', forgotPassword);
    fastify.post('/logout', logout);


    fastify.get('/permissions', { preHandler: [authenticate] }, permissions);
    fastify.get('/me', { preHandler: [authenticate] }, me);
}

module.exports = {
    name: 'auth',
    routes,
};
