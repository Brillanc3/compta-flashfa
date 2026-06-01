const prisma = require('../db');

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
    where: { key: rawKey },
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

  if (modules.length > 0) {
    const urlModule = (request.url || '/').split('/').filter(Boolean)[0] || '';
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
