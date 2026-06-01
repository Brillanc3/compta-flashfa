const variablesService = require('./hosting.variables.service');

function parseIntParam(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseCompanyId(req) {
  return parseIntParam(req.headers['x-company-id']);
}

function handleError(reply, err) {
  reply.code(err.statusCode ?? 500).send({ message: err.message });
}

async function listVariables(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  if (!companyId || !siteId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await variablesService.listVariables({ companyId, siteId })); }
  catch (e) { handleError(reply, e); }
}

async function upsertVariable(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const { key } = req.params;
  if (!companyId || !siteId || !key) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await variablesService.upsertVariable({ companyId, siteId, key, data: req.body })); }
  catch (e) { handleError(reply, e); }
}

async function deleteVariable(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const { key } = req.params;
  if (!companyId || !siteId || !key) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { await variablesService.deleteVariable({ companyId, siteId, key }); reply.code(204).send(); }
  catch (e) { handleError(reply, e); }
}

async function getPublicVariables(req, reply) {
  const { slug } = req.params;
  try { reply.send(await variablesService.getPublicVariables(slug)); }
  catch (e) { handleError(reply, e); }
}

module.exports = { listVariables, upsertVariable, deleteVariable, getPublicVariables };
