const crypto = require('crypto');
const prisma = require('../../db');

const VALID_ACTIONS = ['GET', 'POST', 'PATCH', 'DELETE'];

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function maskKey(key) {
  if (!key) return null;
  return key.slice(0, 8) + '••••••••••••••••••••••••' + key.slice(-4);
}

function formatKey(k) {
  return {
    id: k.id,
    name: k.name,
    maskedKey: maskKey(k.key),
    scopes: k.scopes,
    isActive: k.isActive,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
    lastUsedAt: k.lastUsedAt ?? null,
  };
}

async function list({ companyId }) {
  const keys = await prisma.companyApiKey.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });
  return { data: keys.map(formatKey) };
}

async function create({ companyId, name, scopes }) {
  const trimmedName = String(name ?? '').trim();
  if (!trimmedName) throw httpError(400, 'name requis');

  const rawActions = Array.isArray(scopes?.actions) ? scopes.actions : [];
  const rawModules = Array.isArray(scopes?.modules) ? scopes.modules : [];

  const validatedActions = rawActions.filter((s) => VALID_ACTIONS.includes(s));
  if (validatedActions.length === 0) {
    throw httpError(400, `actions invalides. Valeurs acceptées : ${VALID_ACTIONS.join(', ')}`);
  }

  const { getActiveModulesForCompany } = require('../../lib/moduleUtils');
  const activeRows = await getActiveModulesForCompany(companyId);
  const toSlug = (n) => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const activeModuleSlugs = new Set(activeRows.map((r) => toSlug(r.module?.name)).filter(Boolean));

  const validatedModules = rawModules.filter((m) => activeModuleSlugs.has(m));

  const rawKey = crypto.randomBytes(32).toString('hex');

  const created = await prisma.companyApiKey.create({
    data: {
      companyId,
      name: trimmedName,
      key: rawKey,
      scopes: { actions: validatedActions, modules: validatedModules },
    },
  });

  return {
    id: created.id,
    name: created.name,
    key: rawKey,
    maskedKey: maskKey(rawKey),
    scopes: created.scopes,
    isActive: created.isActive,
    createdAt: created.createdAt,
  };
}

async function setStatus({ companyId, id, isActive }) {
  if (typeof isActive !== 'boolean') {
    throw httpError(400, "Le champ 'isActive' (booléen) est requis.");
  }
  const existing = await prisma.companyApiKey.findFirst({ where: { companyId, id } });
  if (!existing) throw httpError(404, 'Clé introuvable');

  const updated = await prisma.companyApiKey.update({
    where: { id },
    data: { isActive },
  });
  return formatKey(updated);
}

async function remove({ companyId, id }) {
  const existing = await prisma.companyApiKey.findFirst({ where: { companyId, id } });
  if (!existing) throw httpError(404, 'Clé introuvable');
  await prisma.companyApiKey.delete({ where: { id } });
  return true;
}

module.exports = { list, create, setStatus, remove };
