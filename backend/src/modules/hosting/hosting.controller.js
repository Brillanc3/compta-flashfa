const prisma = require('../../db');
const siteService = require('./hosting.service');
const contentService = require('./hosting.content.service');

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

// ─── SITES ───────────────────────────────────────────────

async function listSites(req, reply) {
  const companyId = parseCompanyId(req);
  if (!companyId) return reply.code(400).send({ message: 'x-company-id manquant' });
  try { reply.send(await siteService.list({ companyId })); }
  catch (e) { handleError(reply, e); }
}

async function getSite(req, reply) {
  const companyId = parseCompanyId(req);
  const id = parseIntParam(req.params.siteId);
  if (!companyId || !id) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await siteService.getById({ companyId, id })); }
  catch (e) { handleError(reply, e); }
}

async function createSite(req, reply) {
  const companyId = parseCompanyId(req);
  if (!companyId) return reply.code(400).send({ message: 'x-company-id manquant' });
  try { reply.code(201).send(await siteService.create({ companyId, user: req.user, payload: req.body })); }
  catch (e) { handleError(reply, e); }
}

async function updateSite(req, reply) {
  const companyId = parseCompanyId(req);
  const id = parseIntParam(req.params.siteId);
  if (!companyId || !id) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await siteService.update({ companyId, user: req.user, id, payload: req.body })); }
  catch (e) { handleError(reply, e); }
}

async function publishSite(req, reply) {
  const companyId = parseCompanyId(req);
  const id = parseIntParam(req.params.siteId);
  if (!companyId || !id) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await siteService.publish({ companyId, user: req.user, id })); }
  catch (e) { handleError(reply, e); }
}

async function unpublishSite(req, reply) {
  const companyId = parseCompanyId(req);
  const id = parseIntParam(req.params.siteId);
  if (!companyId || !id) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await siteService.unpublish({ companyId, user: req.user, id })); }
  catch (e) { handleError(reply, e); }
}

async function deleteSite(req, reply) {
  const companyId = parseCompanyId(req);
  const id = parseIntParam(req.params.siteId);
  if (!companyId || !id) return reply.code(400).send({ message: 'Paramètres invalides' });
  try {
    await siteService.remove({ companyId, id });
    reply.code(204).send();
  }
  catch (e) { handleError(reply, e); }
}

async function linkBill(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  if (!companyId || !siteId) return reply.code(400).send({ message: 'Paramètres invalides' });
  const billId = req.body?.billId === null ? null : parseIntParam(req.body?.billId);
  if (req.body?.billId !== null && billId === null) {
    return reply.code(400).send({ message: 'billId invalide (entier > 0 ou null attendu)' });
  }
  try { reply.send(await siteService.linkBill({ companyId, user: req.user, siteId, billId })); }
  catch (e) { handleError(reply, e); }
}

// ─── PAGES ───────────────────────────────────────────────

async function listPages(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  if (!companyId || !siteId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await contentService.listPages({ companyId, siteId })); }
  catch (e) { handleError(reply, e); }
}

async function getPage(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const pageId = parseIntParam(req.params.pageId);
  if (!companyId || !siteId || !pageId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await contentService.getPage({ companyId, siteId, pageId })); }
  catch (e) { handleError(reply, e); }
}

async function createPage(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  if (!companyId || !siteId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.code(201).send(await contentService.createPage({ companyId, siteId, payload: req.body })); }
  catch (e) { handleError(reply, e); }
}

async function updatePage(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const pageId = parseIntParam(req.params.pageId);
  if (!companyId || !siteId || !pageId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await contentService.updatePage({ companyId, siteId, pageId, payload: req.body })); }
  catch (e) { handleError(reply, e); }
}

async function deletePage(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const pageId = parseIntParam(req.params.pageId);
  if (!companyId || !siteId || !pageId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try {
    await contentService.deletePage({ companyId, siteId, pageId });
    reply.code(204).send();
  }
  catch (e) { handleError(reply, e); }
}

// ─── ASSETS ──────────────────────────────────────────────

async function listAssets(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  if (!companyId || !siteId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await contentService.listAssets({ companyId, siteId })); }
  catch (e) { handleError(reply, e); }
}

async function getAsset(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const assetId = parseIntParam(req.params.assetId);
  if (!companyId || !siteId || !assetId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await contentService.getAsset({ companyId, siteId, assetId })); }
  catch (e) { handleError(reply, e); }
}

async function upsertAsset(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  if (!companyId || !siteId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await contentService.upsertAsset({ companyId, siteId, payload: req.body })); }
  catch (e) { handleError(reply, e); }
}

async function deleteAsset(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const assetId = parseIntParam(req.params.assetId);
  if (!companyId || !siteId || !assetId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try {
    await contentService.deleteAsset({ companyId, siteId, assetId });
    reply.code(204).send();
  }
  catch (e) { handleError(reply, e); }
}

// ─── PUBLIC (sans auth) ───────────────────────────────────

async function getPublicPage(req, reply) {
  const { slug } = req.params;
  const route = String(req.params['*'] || '').replace(/^\/+|\/+$/g, '');

  try {
    const site = await prisma.hostedSite.findUnique({
      where: { slug },
      select: { id: true, isPublished: true, name: true },
    });
    if (!site || !site.isPublished) {
      return reply.code(404).send({ message: 'Site introuvable ou non publié' });
    }

    const [page, assets] = await Promise.all([
      prisma.hostedPage.findUnique({
        where: { siteId_route: { siteId: site.id, route } },
        select: { title: true, htmlContent: true },
      }),
      prisma.hostedAsset.findMany({
        where: { siteId: site.id },
        orderBy: [{ kind: 'asc' }, { filename: 'asc' }],
        select: { filename: true, kind: true, content: true },
      }),
    ]);

    if (!page) {
      return reply.code(404).send({ message: `Page "${route || '/'}" introuvable` });
    }

    reply.send({
      site: { slug, name: site.name },
      page: { title: page.title, htmlContent: page.htmlContent },
      assets,
    });
  } catch (e) {
    reply.code(500).send({ message: e.message });
  }
}

module.exports = {
  listSites, getSite, createSite, updateSite, publishSite, unpublishSite, deleteSite, linkBill,
  listPages, getPage, createPage, updatePage, deletePage,
  listAssets, getAsset, upsertAsset, deleteAsset,
  getPublicPage,
};
