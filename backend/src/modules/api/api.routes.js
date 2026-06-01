const authMiddleware = require('../../middleware/auth');
const controller = require('./api.controller');
const { PERMISSIONS, HIERARCHY } = require('./api.permissions');

const MODULE_NAME = 'api';

async function apiRoutes(fastify) {
  const { authenticate, checkPermission, checkModuleAccess } = authMiddleware;
  const moduleGuard = checkModuleAccess(MODULE_NAME);

  const VIEW = [authenticate, moduleGuard, checkPermission(PERMISSIONS.VIEW, HIERARCHY)];
  const MANAGE = [authenticate, moduleGuard, checkPermission(PERMISSIONS.MANAGE, HIERARCHY)];

  fastify.get('/', { preHandler: VIEW }, controller.listKeys);
  fastify.post('/', { preHandler: MANAGE }, controller.createKey);
  fastify.patch('/:keyId/status', { preHandler: MANAGE }, controller.setStatus);
  fastify.delete('/:keyId', { preHandler: MANAGE }, controller.deleteKey);
}

module.exports = {
  name: MODULE_NAME,
  isDefault: false,
  routes: apiRoutes,
};
