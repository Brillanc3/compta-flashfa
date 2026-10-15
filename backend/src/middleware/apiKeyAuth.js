const prisma = require('../db');
const { hashApiKey } = require('../lib/apiKeyHash');

/**
 * Modules réservés aux utilisateurs authentifiés (JWT) : administration,
 * gestion des clés API, authentification et compte utilisateur.
 */
const FORBIDDEN_MODULES = new Set(['admin', 'api', 'auth', 'onboarding', 'quiz', 'user']);

/**
 * Middleware global : si x-api-key présent, valide la clé et injecte le contexte.
 * Lance une erreur si la clé est invalide/désactivée/scope insuffisant.
 * Si x-api-key absent, laisse passer (l'auth JWT prend le relais).
 */
const authenticateApiKey = async (request, reply) => {
  const rawKey = request.headers['x-api-key'];
  if (!rawKey) return; // Pas de clé API → auth JWT normale

  const method = request.method.toUpperCase();

  const record = await prisma.companyApiKey.findUnique({
    where: { keyHash: hashApiKey(rawKey) },
    select: { id: true, companyId: true, isActive: true, scopes: true },
  });

  if (!record) {
    return reply.code(401).send({ message: 'Clé API invalide.' });
  }

  if (!record.isActive) {
    return reply.code(403).send({ message: 'Clé API désactivée.' });
  }

  // Compat : ancien format = tableau plat de méthodes
  const raw = record.scopes;
  const actions = Array.isArray(raw) ? raw : (Array.isArray(raw?.actions) ? raw.actions : []);
  const modules = Array.isArray(raw) ? [] : (Array.isArray(raw?.modules) ? raw.modules : []);

  if (!actions.includes(method)) {
    return reply.code(403).send({
      message: `Méthode ${method} non autorisée pour cette clé. Actions disponibles : ${actions.join(', ')}.`,
    });
  }

  // Module ciblé : on lit le pattern de route Fastify (préfixe du module),
  // plus fiable que l'URL brute (query string, préfixe /api éventuel).
  const routePath = request.routeOptions?.url || (request.url || '/').split('?')[0];
  const urlModule = routePath.split('/').filter(Boolean)[0] || '';

  // Modules jamais accessibles par clé API, même si la clé n'a aucune restriction de module
  if (FORBIDDEN_MODULES.has(urlModule)) {
    return reply.code(403).send({
      message: `Module "${urlModule}" non accessible par clé API.`,
    });
  }

  // Une clé API ne peut cibler que sa propre entreprise
  const ctxType = String(request.query?.contextType || '').toUpperCase();
  const ctxId = Number.parseInt(request.query?.contextId, 10);
  if (ctxType === 'COMPANY' && Number.isInteger(ctxId) && ctxId !== record.companyId) {
    return reply.code(403).send({ message: 'Cette clé API ne donne pas accès à cette entreprise.' });
  }

  if (modules.length > 0) {
    if (!modules.includes(urlModule)) {
      return reply.code(403).send({
        message: `Module "${urlModule}" non autorisé pour cette clé. Modules disponibles : ${modules.join(', ')}.`,
      });
    }
  }

  // Injecter le contexte entreprise
  request.headers['x-company-id'] = String(record.companyId);
  request.user = { userId: null, isApiKey: true, companyId: record.companyId };

  // Mise à jour lastUsedAt sans bloquer la réponse
  prisma.companyApiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});
};

module.exports = { authenticateApiKey };
