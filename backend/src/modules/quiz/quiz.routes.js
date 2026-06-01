// /backend/src/modules/quiz/quiz.routes.js

const { sendQuiz, getQuiz, submitQuiz, listQuizzes, getQuizUsers, resendQuiz, deleteQuiz, extendQuiz, terminateQuiz } = require('./quiz.controller');

async function routes(fastify, options) {
    const { authenticate, checkPermission } = options.authMiddleware;

    // Admin routes
    fastify.get('/', { preHandler: [authenticate, checkPermission('ADMIN.QUIZ.SEND')] }, listQuizzes);
    fastify.get('/users', { preHandler: [authenticate, checkPermission('ADMIN.QUIZ.SEND')] }, getQuizUsers);
    fastify.post('/send', { preHandler: [authenticate, checkPermission('ADMIN.QUIZ.SEND')] }, sendQuiz);
    fastify.post('/:id/resend', { preHandler: [authenticate, checkPermission('ADMIN.QUIZ.SEND')] }, resendQuiz);
    fastify.delete('/:id', { preHandler: [authenticate, checkPermission('ADMIN.QUIZ.SEND')] }, deleteQuiz);
    fastify.patch('/:id/extend', { preHandler: [authenticate, checkPermission('ADMIN.QUIZ.SEND')] }, extendQuiz);
    fastify.patch('/:id/terminate', { preHandler: [authenticate, checkPermission('ADMIN.QUIZ.SEND')] }, terminateQuiz);

    // User routes
    fastify.get('/:token', { preHandler: [authenticate] }, getQuiz);
    fastify.post('/:token/submit', { preHandler: [authenticate] }, submitQuiz);
}

module.exports = {
    name: 'quiz',
    isDefault: true,
    routes,
};
