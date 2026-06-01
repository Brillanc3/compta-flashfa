const service = require('./api.service');

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

async function listKeys(req, reply) {
  const companyId = parseCompanyId(req);
  if (!companyId) return reply.code(400).send({ message: 'x-company-id manquant' });
  try { reply.send(await service.list({ companyId })); }
  catch (e) { handleError(reply, e); }
}

async function createKey(req, reply) {
  const companyId = parseCompanyId(req);
  if (!companyId) return reply.code(400).send({ message: 'x-company-id manquant' });
  const { name, scopes } = req.body ?? {};
  try { reply.code(201).send(await service.create({ companyId, name, scopes })); }
  catch (e) { handleError(reply, e); }
}

async function setStatus(req, reply) {
  const companyId = parseCompanyId(req);
  const id = parseIntParam(req.params.keyId);
  if (!companyId || !id) return reply.code(400).send({ message: 'Paramètres invalides' });
  const { isActive } = req.body ?? {};
  try { reply.send(await service.setStatus({ companyId, id, isActive })); }
  catch (e) { handleError(reply, e); }
}

async function deleteKey(req, reply) {
  const companyId = parseCompanyId(req);
  const id = parseIntParam(req.params.keyId);
  if (!companyId || !id) return reply.code(400).send({ message: 'Paramètres invalides' });
  try {
    await service.remove({ companyId, id });
    reply.code(204).send();
  }
  catch (e) { handleError(reply, e); }
}

module.exports = { listKeys, createKey, setStatus, deleteKey };
