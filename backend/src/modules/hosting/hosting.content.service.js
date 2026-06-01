const prisma = require('../../db');

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function validateRoute(raw) {
  const route = String(raw ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (route && !/^[a-zA-Z0-9_\-\/]+$/.test(route)) {
    throw httpError(400, 'route invalide (alphanumérique, - _ / autorisés)');
  }
  return route;
}

async function assertSiteOwnership(companyId, siteId) {
  const site = await prisma.hostedSite.findFirst({
    where: { companyId, id: siteId },
    select: { id: true },
  });
  if (!site) throw httpError(404, 'Site introuvable');
}

// ─── PAGES ───────────────────────────────────────────────

async function listPages({ companyId, siteId }) {
  await assertSiteOwnership(companyId, siteId);
  const pages = await prisma.hostedPage.findMany({
    where: { siteId },
    orderBy: [{ route: 'asc' }],
    select: { id: true, route: true, title: true, isPublished: true, createdAt: true, updatedAt: true },
  });
  return { data: pages };
}

async function getPage({ companyId, siteId, pageId }) {
  await assertSiteOwnership(companyId, siteId);
  const page = await prisma.hostedPage.findFirst({ where: { siteId, id: pageId } });
  if (!page) throw httpError(404, 'Page introuvable');
  return page;
}

async function createPage({ companyId, siteId, payload }) {
  await assertSiteOwnership(companyId, siteId);

  const route = validateRoute(payload?.route);
  const title = String(payload?.title ?? '').trim();
  if (!title) throw httpError(400, 'title requis');

  const dup = await prisma.hostedPage.findUnique({
    where: { siteId_route: { siteId, route } },
    select: { id: true },
  });
  if (dup) throw httpError(409, `Route "${route || '/'}" déjà utilisée`);

  return prisma.hostedPage.create({
    data: { siteId, route, title, htmlContent: String(payload?.htmlContent ?? '') },
  });
}

async function updatePage({ companyId, siteId, pageId, payload }) {
  await assertSiteOwnership(companyId, siteId);
  const page = await prisma.hostedPage.findFirst({ where: { siteId, id: pageId }, select: { id: true, route: true } });
  if (!page) throw httpError(404, 'Page introuvable');

  const data = {};
  if ('title' in payload) {
    const title = String(payload.title ?? '').trim();
    if (!title) throw httpError(400, 'title requis');
    data.title = title;
  }
  if ('htmlContent' in payload) data.htmlContent = String(payload.htmlContent ?? '');
  if ('route' in payload) {
    const newRoute = validateRoute(payload.route);
    if (page.route === '' && newRoute !== '') {
      throw httpError(400, 'La page d\'accueil (route vide) ne peut pas être renommée');
    }
    const dup = await prisma.hostedPage.findUnique({
      where: { siteId_route: { siteId, route: newRoute } },
      select: { id: true },
    });
    if (dup && dup.id !== pageId) throw httpError(409, 'Route déjà utilisée par une autre page');
    data.route = newRoute;
  }

  return prisma.hostedPage.update({ where: { id: pageId }, data });
}

async function deletePage({ companyId, siteId, pageId }) {
  await assertSiteOwnership(companyId, siteId);
  const page = await prisma.hostedPage.findFirst({ where: { siteId, id: pageId }, select: { id: true, route: true } });
  if (!page) throw httpError(404, 'Page introuvable');
  if (page.route === '') throw httpError(400, 'La page d\'accueil ne peut pas être supprimée');
  await prisma.hostedPage.delete({ where: { id: pageId } });
  return true;
}

// ─── ASSETS ──────────────────────────────────────────────

async function listAssets({ companyId, siteId }) {
  await assertSiteOwnership(companyId, siteId);
  const assets = await prisma.hostedAsset.findMany({
    where: { siteId },
    orderBy: [{ kind: 'asc' }, { filename: 'asc' }],
    select: { id: true, filename: true, kind: true, updatedAt: true },
  });
  return { data: assets };
}

async function getAsset({ companyId, siteId, assetId }) {
  await assertSiteOwnership(companyId, siteId);
  const asset = await prisma.hostedAsset.findFirst({ where: { siteId, id: assetId } });
  if (!asset) throw httpError(404, 'Asset introuvable');
  return asset;
}

async function upsertAsset({ companyId, siteId, payload }) {
  await assertSiteOwnership(companyId, siteId);

  const filename = String(payload?.filename ?? '').trim();
  if (!filename) throw httpError(400, 'filename requis');
  if (!/^[a-zA-Z0-9_\-\.]+\.(css|js)$/i.test(filename)) {
    throw httpError(400, 'filename invalide. Format attendu: main.css ou script.js');
  }

  const kind = filename.toLowerCase().endsWith('.css') ? 'CSS' : 'JS';
  const content = String(payload?.content ?? '');

  return prisma.hostedAsset.upsert({
    where: { siteId_filename: { siteId, filename } },
    create: { siteId, filename, kind, content },
    update: { content },
  });
}

async function deleteAsset({ companyId, siteId, assetId }) {
  await assertSiteOwnership(companyId, siteId);
  const asset = await prisma.hostedAsset.findFirst({ where: { siteId, id: assetId }, select: { id: true } });
  if (!asset) throw httpError(404, 'Asset introuvable');
  await prisma.hostedAsset.delete({ where: { id: assetId } });
  return true;
}

module.exports = {
  listPages, getPage, createPage, updatePage, deletePage,
  listAssets, getAsset, upsertAsset, deleteAsset,
};
