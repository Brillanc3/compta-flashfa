const prisma = require('../../db');
const https = require('https');
const http = require('http');

const MIN_REFRESH_MS = 3000;
const MAX_REFRESH_MS = 300000;

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function assertSiteOwnership(companyId, siteId) {
  const site = await prisma.hostedSite.findFirst({ where: { companyId, id: siteId }, select: { id: true } });
  if (!site) throw httpError(404, 'Site introuvable');
}

function clampRefreshMs(val) {
  if (val == null) return null;
  return Math.max(MIN_REFRESH_MS, Math.min(MAX_REFRESH_MS, Number(val)));
}

async function listVariables({ companyId, siteId }) {
  await assertSiteOwnership(companyId, siteId);
  return prisma.hostedVariable.findMany({ where: { siteId }, orderBy: { key: 'asc' } });
}

async function upsertVariable({ companyId, siteId, key, data }) {
  await assertSiteOwnership(companyId, siteId);
  if (!/^[a-zA-Z0-9_]+$/.test(key)) throw httpError(400, 'Clé invalide (alphanumérique + _ uniquement)');
  const refreshMs = clampRefreshMs(data.refreshMs);
  return prisma.hostedVariable.upsert({
    where: { siteId_key: { siteId, key } },
    create: {
      siteId,
      key,
      value: data.value ?? '',
      kind: data.kind ?? 'STATIC',
      sourceUrl: data.sourceUrl?.trim() || null,
      sourcePath: data.sourcePath?.trim() || null,
      refreshMs,
    },
    update: {
      value: data.value ?? '',
      kind: data.kind ?? 'STATIC',
      sourceUrl: data.sourceUrl?.trim() || null,
      sourcePath: data.sourcePath?.trim() || null,
      refreshMs,
    },
  });
}

async function deleteVariable({ companyId, siteId, key }) {
  await assertSiteOwnership(companyId, siteId);
  const v = await prisma.hostedVariable.findUnique({ where: { siteId_key: { siteId, key } } });
  if (!v) throw httpError(404, 'Variable introuvable');
  await prisma.hostedVariable.delete({ where: { siteId_key: { siteId, key } } });
}

// ─── Fetch externe (DYNAMIC) ─────────────────────────────

function fetchExternal(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractByPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((cur, k) => (cur == null ? null : cur[k]), obj);
}

async function getPublicVariables(slug) {
  const site = await prisma.hostedSite.findUnique({ where: { slug }, select: { id: true, isPublished: true } });
  if (!site || !site.isPublished) throw httpError(404, 'Site introuvable ou non publié');

  const variables = await prisma.hostedVariable.findMany({ where: { siteId: site.id } });
  const result = {};
  const updates = [];

  for (const v of variables) {
    if (v.kind === 'STATIC') {
      result[v.key] = v.value;
      continue;
    }

    const now = Date.now();
    const lastFetch = v.lastFetchedAt ? new Date(v.lastFetchedAt).getTime() : 0;
    const interval = v.refreshMs ?? 30000;

    if (now - lastFetch <= interval && v.cachedValue !== null) {
      result[v.key] = v.cachedValue;
      continue;
    }

    try {
      const json = await fetchExternal(v.sourceUrl);
      const value = String(extractByPath(json, v.sourcePath) ?? '');
      result[v.key] = value;
      updates.push(
        prisma.hostedVariable.update({
          where: { id: v.id },
          data: { cachedValue: value, lastFetchedAt: new Date() },
        })
      );
    } catch {
      result[v.key] = v.cachedValue ?? v.value;
    }
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  return result;
}

module.exports = { listVariables, upsertVariable, deleteVariable, getPublicVariables };
