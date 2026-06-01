const prisma = require('../../db');

const MAX_FORMS = 50;

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

async function assertFormAccess(companyId, siteId, formId) {
  await assertSiteOwnership(companyId, siteId);
  const form = await prisma.hostedForm.findFirst({
    where: { id: formId, siteId },
    include: { fields: { orderBy: { order: 'asc' } }, _count: { select: { responses: true } } },
  });
  if (!form) throw httpError(404, 'Formulaire introuvable');
  return form;
}

async function listForms({ companyId, siteId }) {
  await assertSiteOwnership(companyId, siteId);
  return prisma.hostedForm.findMany({
    where: { siteId },
    include: { _count: { select: { fields: true, responses: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function getForm({ companyId, siteId, formId }) {
  return assertFormAccess(companyId, siteId, formId);
}

async function createForm({ companyId, siteId, data }) {
  await assertSiteOwnership(companyId, siteId);
  const count = await prisma.hostedForm.count({ where: { siteId } });
  if (count >= MAX_FORMS) throw httpError(400, `Limite de ${MAX_FORMS} formulaires atteinte`);
  return prisma.hostedForm.create({
    data: {
      siteId,
      name: String(data.name).trim(),
      description: data.description?.trim() || null,
      isActive: data.isActive ?? true,
      opensAt: data.opensAt ? new Date(data.opensAt) : null,
      closesAt: data.closesAt ? new Date(data.closesAt) : null,
      maxResponses: data.maxResponses ? Number(data.maxResponses) : null,
      notifKind: data.notifKind ?? 'TEMPORARY',
      notifTitle: data.notifTitle?.trim() || null,
      notifMessage: data.notifMessage?.trim() || 'Merci pour votre réponse !',
      notifDurationSec: data.notifDurationSec ? Number(data.notifDurationSec) : 5,
      discordWebhookUrl: data.discordWebhookUrl?.trim() || null,
    },
    include: { fields: true },
  });
}

async function updateForm({ companyId, siteId, formId, data }) {
  await assertFormAccess(companyId, siteId, formId);
  return prisma.hostedForm.update({
    where: { id: formId },
    data: {
      name: String(data.name).trim(),
      description: data.description?.trim() || null,
      isActive: data.isActive,
      opensAt: data.opensAt ? new Date(data.opensAt) : null,
      closesAt: data.closesAt ? new Date(data.closesAt) : null,
      maxResponses: data.maxResponses ? Number(data.maxResponses) : null,
      notifKind: data.notifKind,
      notifTitle: data.notifTitle?.trim() || null,
      notifMessage: data.notifMessage?.trim() || 'Merci pour votre réponse !',
      notifDurationSec: data.notifDurationSec ? Number(data.notifDurationSec) : 5,
      discordWebhookUrl: data.discordWebhookUrl?.trim() || null,
    },
    include: { fields: { orderBy: { order: 'asc' } } },
  });
}

async function removeForm({ companyId, siteId, formId }) {
  await assertFormAccess(companyId, siteId, formId);
  await prisma.hostedForm.delete({ where: { id: formId } });
}

// ─── Champs ──────────────────────────────────────────────

async function addField({ companyId, siteId, formId, data }) {
  await assertFormAccess(companyId, siteId, formId);
  const last = await prisma.hostedFormField.findFirst({
    where: { formId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  return prisma.hostedFormField.create({
    data: {
      formId,
      key: String(data.key).trim(),
      label: String(data.label).trim(),
      type: data.type,
      required: data.required ?? false,
      options: data.options ?? null,
      order: (last?.order ?? -1) + 1,
    },
  });
}

async function updateField({ companyId, siteId, formId, fieldId, data }) {
  await assertFormAccess(companyId, siteId, formId);
  const field = await prisma.hostedFormField.findFirst({ where: { id: fieldId, formId } });
  if (!field) throw httpError(404, 'Champ introuvable');
  return prisma.hostedFormField.update({
    where: { id: fieldId },
    data: {
      key: String(data.key).trim(),
      label: String(data.label).trim(),
      type: data.type,
      required: data.required ?? false,
      options: data.options ?? null,
    },
  });
}

async function removeField({ companyId, siteId, formId, fieldId }) {
  await assertFormAccess(companyId, siteId, formId);
  const field = await prisma.hostedFormField.findFirst({ where: { id: fieldId, formId } });
  if (!field) throw httpError(404, 'Champ introuvable');
  await prisma.hostedFormField.delete({ where: { id: fieldId } });
}

async function reorderFields({ companyId, siteId, formId, orderedIds }) {
  await assertFormAccess(companyId, siteId, formId);
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.hostedFormField.updateMany({ where: { id, formId }, data: { order: index } })
    )
  );
}

module.exports = {
  listForms, getForm, createForm, updateForm, removeForm,
  addField, updateField, removeField, reorderFields,
};
