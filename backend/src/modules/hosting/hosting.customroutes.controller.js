const customRoutesService = require('./hosting.customroutes.service');

const PLATFORM_ORIGINS = (process.env.CORS_ORIGIN || 'https://react.jipeg-corporation.eu')
  .split(',')
  .map((s) => s.trim());

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

function isPlatformOrigin(req) {
  const origin  = req.headers['origin']  || '';
  const referer = req.headers['referer'] || '';
  const source  = origin || referer;
  if (!source) return true;
  try {
    const host = new URL(source).hostname;
    if (host.endsWith('.jipeg-corporation.eu') || host === 'jipeg-corporation.eu') return true;
  } catch { /* source invalide, continuer */ }
  return PLATFORM_ORIGINS.some((base) => source.startsWith(base));
}

// ─── Authentifié ─────────────────────────────────────────

async function listRoutes(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId    = parseIntParam(req.params.siteId);
  if (!companyId || !siteId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await customRoutesService.listRoutes({ companyId, siteId })); }
  catch (e) { handleError(reply, e); }
}

async function getRoute(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId    = parseIntParam(req.params.siteId);
  const { key }   = req.params;
  if (!companyId || !siteId || !key) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await customRoutesService.getRoute({ companyId, siteId, key })); }
  catch (e) { handleError(reply, e); }
}

async function upsertRoute(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId    = parseIntParam(req.params.siteId);
  const { key }   = req.params;
  if (!companyId || !siteId || !key) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await customRoutesService.upsertRoute({ companyId, siteId, key, data: req.body ?? {} })); }
  catch (e) { handleError(reply, e); }
}

async function deleteRoute(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId    = parseIntParam(req.params.siteId);
  const { key }   = req.params;
  if (!companyId || !siteId || !key) return reply.code(400).send({ message: 'Paramètres invalides' });
  try {
    await customRoutesService.removeRoute({ companyId, siteId, key });
    reply.code(204).send();
  }
  catch (e) { handleError(reply, e); }
}

// ─── Public ──────────────────────────────────────────────

async function getPublicRoute(req, reply) {
  if (!isPlatformOrigin(req)) {
    return reply.code(403).send({ message: 'Accès refusé' });
  }
  const { slug, key } = req.params;
  try {
    const data = await customRoutesService.getPublicRoute(slug, key);
    reply.send(data);
  }
  catch (e) { handleError(reply, e); }
}

module.exports = { listRoutes, getRoute, upsertRoute, deleteRoute, getPublicRoute };
