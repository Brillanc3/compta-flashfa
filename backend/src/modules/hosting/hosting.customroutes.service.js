const prisma = require('../../db');

const MAX_ROUTES = 20;
const KEY_REGEX  = /^[a-zA-Z0-9_-]{1,64}$/;

const ROUTE_DEFINITIONS = {
  SERVICE: {
    fields: ['isOnline', 'memberCount', 'members'],
  },
  FORM_RESPONSES: {
    fields: ['totalResponses', 'unreadCount', 'lastResponseAt'],
    requiresForm: true,
  },
};

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function assertSiteOwnership(companyId, siteId) {
  const site = await prisma.hostedSite.findFirst({
    where: { companyId, id: siteId },
    select: { id: true },
  });
  if (!site) throw httpError(404, 'Site introuvable');
}

async function listRoutes({ companyId, siteId }) {
  await assertSiteOwnership(companyId, siteId);
  return prisma.hostedCustomRoute.findMany({
    where: { siteId },
    orderBy: { key: 'asc' },
    include: { form: { select: { id: true, name: true } } },
  });
}

async function getRoute({ companyId, siteId, key }) {
  await assertSiteOwnership(companyId, siteId);
  const route = await prisma.hostedCustomRoute.findUnique({
    where: { siteId_key: { siteId, key } },
    include: { form: { select: { id: true, name: true } } },
  });
  if (!route) throw httpError(404, 'Route introuvable');
  return route;
}

async function upsertRoute({ companyId, siteId, key, data }) {
  await assertSiteOwnership(companyId, siteId);

  if (!KEY_REGEX.test(key)) {
    throw httpError(400, 'Clé invalide (alphanumérique, - et _ uniquement, max 64 chars)');
  }

  const def = ROUTE_DEFINITIONS[data.type];
  if (!def) throw httpError(400, `Type invalide. Types disponibles : ${Object.keys(ROUTE_DEFINITIONS).join(', ')}`);

  const fields = Array.isArray(data.fields) ? data.fields.filter(f => def.fields.includes(f)) : def.fields;
  if (fields.length === 0) throw httpError(400, 'Au moins un champ requis');

  if (def.requiresForm) {
    if (!data.formId) throw httpError(400, 'formId requis pour ce type de route');
    const form = await prisma.hostedForm.findFirst({ where: { id: Number(data.formId), siteId }, select: { id: true } });
    if (!form) throw httpError(404, 'Formulaire introuvable');
  }

  const existing = await prisma.hostedCustomRoute.findUnique({
    where: { siteId_key: { siteId, key } },
    select: { id: true },
  });
  if (!existing) {
    const count = await prisma.hostedCustomRoute.count({ where: { siteId } });
    if (count >= MAX_ROUTES) throw httpError(400, `Limite de ${MAX_ROUTES} routes atteinte`);
  }

  return prisma.hostedCustomRoute.upsert({
    where: { siteId_key: { siteId, key } },
    create: {
      siteId,
      key,
      type:        data.type,
      isActive:    data.isActive ?? false,
      description: data.description?.trim() || null,
      fields,
      formId:      def.requiresForm ? Number(data.formId) : null,
    },
    update: {
      type:        data.type,
      isActive:    data.isActive ?? false,
      description: data.description?.trim() || null,
      fields,
      formId:      def.requiresForm ? Number(data.formId) : null,
    },
    include: { form: { select: { id: true, name: true } } },
  });
}

async function removeRoute({ companyId, siteId, key }) {
  await assertSiteOwnership(companyId, siteId);
  const route = await prisma.hostedCustomRoute.findUnique({ where: { siteId_key: { siteId, key } } });
  if (!route) throw httpError(404, 'Route introuvable');
  await prisma.hostedCustomRoute.delete({ where: { siteId_key: { siteId, key } } });
}

// ─── Calcul des données publiques ────────────────────────

async function computeServiceData(companyId, fields) {
  const activeEvents = await prisma.calendarEvent.findMany({
    where: { companyId, createdBySystem: true, endTime: null },
    orderBy: { startTime: 'desc' },
    distinct: ['userId'],
    include: { user: { select: { name: true } } },
  });

  const now = Date.now();
  const result = {};
  if (fields.includes('isOnline'))    result.isOnline    = activeEvents.length > 0;
  if (fields.includes('memberCount')) result.memberCount = activeEvents.length;
  if (fields.includes('members'))     result.members     = activeEvents.map((e) => ({
    name:           e.user.name,
    elapsedSeconds: Math.max(0, Math.floor((now - new Date(e.startTime).getTime()) / 1000)),
  }));
  return result;
}

async function computeFormResponsesData(formId, fields) {
  const [total, unread, last] = await Promise.all([
    prisma.hostedFormResponse.count({ where: { formId } }),
    fields.includes('unreadCount')
      ? prisma.hostedFormResponse.count({ where: { formId, isRead: false } })
      : Promise.resolve(null),
    fields.includes('lastResponseAt')
      ? prisma.hostedFormResponse.findFirst({ where: { formId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
      : Promise.resolve(null),
  ]);

  const result = {};
  if (fields.includes('totalResponses')) result.totalResponses = total;
  if (fields.includes('unreadCount'))    result.unreadCount    = unread ?? 0;
  if (fields.includes('lastResponseAt')) result.lastResponseAt = last?.createdAt ?? null;
  return result;
}

async function getPublicRoute(slug, key) {
  const site = await prisma.hostedSite.findUnique({
    where: { slug },
    select: { id: true, isPublished: true, companyId: true },
  });
  if (!site || !site.isPublished) throw httpError(404, 'Site introuvable ou non publié');

  const route = await prisma.hostedCustomRoute.findUnique({
    where: { siteId_key: { siteId: site.id, key } },
  });
  if (!route || !route.isActive) throw httpError(404, 'Route introuvable');

  const fields = Array.isArray(route.fields) ? route.fields : [];

  switch (route.type) {
    case 'SERVICE':
      return computeServiceData(site.companyId, fields);
    case 'FORM_RESPONSES':
      if (!route.formId) throw httpError(500, 'Route mal configurée (formId manquant)');
      return computeFormResponsesData(route.formId, fields);
    default:
      throw httpError(500, 'Type de route inconnu');
  }
}

module.exports = {
  ROUTE_DEFINITIONS,
  listRoutes, getRoute, upsertRoute, removeRoute, getPublicRoute,
};
