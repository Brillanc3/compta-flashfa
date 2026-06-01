const authMiddleware = require('../../middleware/auth');
const controller = require('./hosting.controller');
const formsCtrl = require('./hosting.forms.controller');
const variablesCtrl = require('./hosting.variables.controller');
const customRoutesCtrl = require('./hosting.customroutes.controller');
const { PERMISSIONS, HIERARCHY } = require('./hosting.permissions');

const MODULE_NAME = 'hosting';

async function hostingRoutes(fastify) {
  const { authenticate, checkPermission, checkModuleAccess } = authMiddleware;
  const moduleGuard = checkModuleAccess(MODULE_NAME);

  const VIEW = [authenticate, moduleGuard, checkPermission(PERMISSIONS.VIEW, HIERARCHY)];
  const MANAGE = [authenticate, moduleGuard, checkPermission(PERMISSIONS.MANAGE, HIERARCHY)];
  const PUBLISH = [authenticate, moduleGuard, checkPermission(PERMISSIONS.PUBLISH, HIERARCHY)];
  const DELETE = [authenticate, moduleGuard, checkPermission(PERMISSIONS.DELETE, HIERARCHY)];

  // ─── Public (sans authenticate) ──────────────────────────
  fastify.get('/public/:slug', controller.getPublicPage);
  fastify.get('/public/:slug/*', controller.getPublicPage);
  fastify.get('/public/:slug/variables', variablesCtrl.getPublicVariables);
  fastify.get('/public/:slug/forms/:formId', formsCtrl.getPublicFormSchema);
  fastify.post('/public/:slug/forms/:formId/submit', formsCtrl.submitResponse);
  fastify.get('/public/:slug/api/:key', customRoutesCtrl.getPublicRoute);

  // ─── Sites ───────────────────────────────────────────────
  fastify.get('', { preHandler: VIEW }, controller.listSites);
  fastify.post('', { preHandler: MANAGE }, controller.createSite);
  fastify.get('/:siteId', { preHandler: VIEW }, controller.getSite);
  fastify.patch('/:siteId', { preHandler: MANAGE }, controller.updateSite);
  fastify.post('/:siteId/publish', { preHandler: PUBLISH }, controller.publishSite);
  fastify.post('/:siteId/unpublish', { preHandler: PUBLISH }, controller.unpublishSite);
  fastify.delete('/:siteId', { preHandler: DELETE }, controller.deleteSite);
  fastify.patch('/:siteId/bill', { preHandler: MANAGE }, controller.linkBill);

  // ─── Pages ───────────────────────────────────────────────
  fastify.get('/:siteId/pages', { preHandler: VIEW }, controller.listPages);
  fastify.post('/:siteId/pages', { preHandler: MANAGE }, controller.createPage);
  fastify.get('/:siteId/pages/:pageId', { preHandler: VIEW }, controller.getPage);
  fastify.patch('/:siteId/pages/:pageId', { preHandler: MANAGE }, controller.updatePage);
  fastify.delete('/:siteId/pages/:pageId', { preHandler: DELETE }, controller.deletePage);

  // ─── Assets ──────────────────────────────────────────────
  fastify.get('/:siteId/assets', { preHandler: VIEW }, controller.listAssets);
  fastify.put('/:siteId/assets', { preHandler: MANAGE }, controller.upsertAsset);
  fastify.get('/:siteId/assets/:assetId', { preHandler: VIEW }, controller.getAsset);
  fastify.delete('/:siteId/assets/:assetId', { preHandler: DELETE }, controller.deleteAsset);

  // ─── Formulaires ─────────────────────────────────────────
  fastify.get('/:siteId/forms', { preHandler: VIEW }, formsCtrl.listForms);
  fastify.post('/:siteId/forms', { preHandler: MANAGE }, formsCtrl.createForm);
  fastify.get('/:siteId/forms/:formId', { preHandler: VIEW }, formsCtrl.getForm);
  fastify.patch('/:siteId/forms/:formId', { preHandler: MANAGE }, formsCtrl.updateForm);
  fastify.delete('/:siteId/forms/:formId', { preHandler: DELETE }, formsCtrl.deleteForm);

  // Champs
  fastify.post('/:siteId/forms/:formId/fields', { preHandler: MANAGE }, formsCtrl.addField);
  fastify.patch('/:siteId/forms/:formId/fields/:fieldId', { preHandler: MANAGE }, formsCtrl.updateField);
  fastify.delete('/:siteId/forms/:formId/fields/:fieldId', { preHandler: DELETE }, formsCtrl.deleteField);
  fastify.post('/:siteId/forms/:formId/fields/reorder', { preHandler: MANAGE }, formsCtrl.reorderFields);

  // Réponses
  fastify.get('/:siteId/forms/:formId/responses', { preHandler: VIEW }, formsCtrl.listResponses);
  fastify.patch('/:siteId/forms/:formId/responses/:responseId', { preHandler: MANAGE }, formsCtrl.markResponseRead);
  fastify.delete('/:siteId/forms/:formId/responses/:responseId', { preHandler: DELETE }, formsCtrl.deleteResponse);

  // ─── Variables ───────────────────────────────────────────
  fastify.get('/:siteId/variables', { preHandler: VIEW }, variablesCtrl.listVariables);
  fastify.put('/:siteId/variables/:key', { preHandler: MANAGE }, variablesCtrl.upsertVariable);
  fastify.delete('/:siteId/variables/:key', { preHandler: DELETE }, variablesCtrl.deleteVariable);

  // ─── Routes custom ───────────────────────────────────────
  fastify.get('/:siteId/custom-routes', { preHandler: VIEW }, customRoutesCtrl.listRoutes);
  fastify.get('/:siteId/custom-routes/:key', { preHandler: VIEW }, customRoutesCtrl.getRoute);
  fastify.put('/:siteId/custom-routes/:key', { preHandler: MANAGE }, customRoutesCtrl.upsertRoute);
  fastify.delete('/:siteId/custom-routes/:key', { preHandler: DELETE }, customRoutesCtrl.deleteRoute);
}

module.exports = {
  name: MODULE_NAME,
  isDefault: false,
  routes: hostingRoutes,
};
