// backend/src/modules/employees-hr/employees-hr.routes.js
'use strict';

const controller = require('./employees-hr.controller');
const { PERMISSIONS, HIERARCHY } = require('./employees-hr.permissions');

async function employeesHrRoutes(fastify, options) {
    const { authenticate, checkPermission } = options.authMiddleware;

    fastify.addHook('preHandler', authenticate);

    const viewOpts   = { preHandler: [checkPermission(PERMISSIONS.HR_VIEW, HIERARCHY)] };
    const manageOpts = { preHandler: [checkPermission(PERMISSIONS.HR_MANAGE, HIERARCHY)] };

    fastify.get('/employee/:employeeId/events',              viewOpts,   controller.listEvents);
    fastify.get('/employee/:employeeId/primes',              viewOpts,   controller.listPrimes);
    fastify.post('/employee/:employeeId/events',             manageOpts, controller.createEvent);
    fastify.patch('/employee/:employeeId/events/:eventId',   manageOpts, controller.updateEvent);
    fastify.delete('/employee/:employeeId/events/:eventId',  manageOpts, controller.deleteEvent);
    fastify.post(
        '/employee/:employeeId/events/:eventId/attachments',
        manageOpts,
        controller.uploadAttachment
    );
    fastify.get('/attachments/:publicId', viewOpts, controller.serveAttachment);
}

module.exports = {
    name: 'employees-hr',
    isDefault: true,
    routes: employeesHrRoutes,
};
