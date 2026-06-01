const crypto = require('crypto');
const prisma = require('../../db');

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function generateUniqueSlug() {
  for (let i = 0; i < 10; i++) {
    const slug = crypto.randomBytes(6).toString('hex');
    const exists = await prisma.hostedSite.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) return slug;
  }
  throw new Error('Impossible de générer un slug unique');
}

function pickSiteView(site) {
  return {
    id: site.id,
    companyId: site.companyId,
    slug: site.slug,
    name: site.name,
    description: site.description ?? null,
    isPublished: site.isPublished,
    publishedAt: site.publishedAt ?? null,
    billId: site.billId ?? null,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
    pageCount: site._count?.pages,
    assetCount: site._count?.assets,
  };
}

async function list({ companyId }) {
  const sites = await prisma.hostedSite.findMany({
    where: { companyId },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    include: { _count: { select: { pages: true, assets: true } } },
  });
  return { data: sites.map(pickSiteView) };
}

async function getById({ companyId, id }) {
  const site = await prisma.hostedSite.findFirst({
    where: { companyId, id },
    include: {
      pages: {
        orderBy: { route: 'asc' },
        select: { id: true, route: true, title: true, isPublished: true, updatedAt: true },
      },
      assets: {
        orderBy: [{ kind: 'asc' }, { filename: 'asc' }],
        select: { id: true, filename: true, kind: true, updatedAt: true },
      },
    },
  });
  if (!site) throw httpError(404, 'Site introuvable');
  return { ...pickSiteView(site), pages: site.pages, assets: site.assets };
}

async function create({ companyId, user, payload }) {
  const userId = Number(user?.userId);
  if (!Number.isInteger(userId) || userId <= 0) throw httpError(401, 'Non authentifié');

  const name = String(payload?.name ?? '').trim();
  if (!name) throw httpError(400, 'name requis');

  const slug = await generateUniqueSlug();

  const site = await prisma.$transaction(async (tx) => {
    const s = await tx.hostedSite.create({
      data: {
        companyId,
        slug,
        name,
        description: String(payload?.description ?? '').trim() || null,
        createdById: userId,
        updatedById: userId,
      },
      select: { id: true },
    });
    await tx.hostedPage.create({
      data: { siteId: s.id, route: '', title: 'Accueil', htmlContent: '' },
    });
    return s;
  });

  return getById({ companyId, id: site.id });
}

async function update({ companyId, user, id, payload }) {
  const userId = Number(user?.userId);
  if (!Number.isInteger(userId) || userId <= 0) throw httpError(401, 'Non authentifié');

  const exists = await prisma.hostedSite.findFirst({ where: { companyId, id }, select: { id: true } });
  if (!exists) throw httpError(404, 'Site introuvable');

  const data = { updatedById: userId };
  if ('name' in payload) {
    const name = String(payload.name ?? '').trim();
    if (!name) throw httpError(400, 'name requis');
    data.name = name;
  }
  if ('description' in payload) data.description = String(payload.description ?? '').trim() || null;

  await prisma.hostedSite.update({ where: { id }, data });
  return getById({ companyId, id });
}

async function publish({ companyId, user, id }) {
  const userId = Number(user?.userId);
  if (!Number.isInteger(userId) || userId <= 0) throw httpError(401, 'Non authentifié');

  const exists = await prisma.hostedSite.findFirst({ where: { companyId, id }, select: { id: true } });
  if (!exists) throw httpError(404, 'Site introuvable');

  await prisma.$transaction(async (tx) => {
    await tx.hostedSite.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date(), updatedById: userId },
    });
    await tx.hostedPage.updateMany({ where: { siteId: id }, data: { isPublished: true } });
  });

  return getById({ companyId, id });
}

async function unpublish({ companyId, user, id }) {
  const userId = Number(user?.userId);
  if (!Number.isInteger(userId) || userId <= 0) throw httpError(401, 'Non authentifié');

  const exists = await prisma.hostedSite.findFirst({ where: { companyId, id }, select: { id: true } });
  if (!exists) throw httpError(404, 'Site introuvable');

  await prisma.hostedSite.update({
    where: { id },
    data: { isPublished: false, updatedById: userId },
  });
  return getById({ companyId, id });
}

async function remove({ companyId, id }) {
  const exists = await prisma.hostedSite.findFirst({ where: { companyId, id }, select: { id: true } });
  if (!exists) throw httpError(404, 'Site introuvable');
  await prisma.hostedSite.delete({ where: { id } });
  return true;
}

async function linkBill({ companyId, user, siteId, billId }) {
  const userId = Number(user?.userId);
  if (!Number.isInteger(userId) || userId <= 0) throw httpError(401, 'Non authentifié');

  const site = await prisma.hostedSite.findFirst({ where: { companyId, id: siteId }, select: { id: true } });
  if (!site) throw httpError(404, 'Site introuvable');

  if (billId !== null) {
    const bill = await prisma.bill.findFirst({ where: { companyId, id: billId }, select: { id: true } });
    if (!bill) throw httpError(404, 'Facture introuvable');
  }

  await prisma.hostedSite.update({ where: { id: siteId }, data: { billId, updatedById: userId } });
  return getById({ companyId, id: siteId });
}

module.exports = { list, getById, create, update, publish, unpublish, remove, linkBill };
