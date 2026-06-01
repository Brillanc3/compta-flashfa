const prisma = require('../../db');
const https = require('https');
const http = require('http');

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function resolvePublicForm(slug, formId) {
  const site = await prisma.hostedSite.findUnique({
    where: { slug },
    select: { id: true, isPublished: true },
  });
  if (!site || !site.isPublished) throw httpError(404, 'Site introuvable ou non publié');
  const form = await prisma.hostedForm.findFirst({
    where: { id: formId, siteId: site.id },
    include: { fields: { orderBy: { order: 'asc' } } },
  });
  if (!form) throw httpError(404, 'Formulaire introuvable');
  return form;
}

function isFormOpen(form) {
  const now = new Date();
  if (form.opensAt && now < form.opensAt) return false;
  if (form.closesAt && now > form.closesAt) return false;
  return true;
}

function sendDiscordNotification(webhookUrl, formName, fields, data) {
  const embeds = [{
    title: `📬 Nouvelle réponse — ${formName}`,
    color: 0x6366f1,
    fields: fields.slice(0, 25).map((f) => ({
      name: f.label,
      value: String(data[f.key] ?? '—').slice(0, 1024),
      inline: true,
    })),
    timestamp: new Date().toISOString(),
  }];
  const body = JSON.stringify({ embeds });
  try {
    const url = new URL(webhookUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (r) => r.resume());
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch {}
}

async function getPublicFormSchema(slug, formId) {
  const form = await resolvePublicForm(slug, formId);
  if (!form.isActive || !isFormOpen(form)) throw httpError(400, 'Formulaire fermé ou désactivé');
  return {
    id: form.id,
    name: form.name,
    description: form.description,
    fields: form.fields.map(({ id, key, label, type, required, options, order }) => ({
      id, key, label, type, required, options, order,
    })),
  };
}

async function submitResponse({ slug, formId, data: rawData, metadata }) {
  const form = await resolvePublicForm(slug, formId);
  if (!form.isActive) throw httpError(400, 'Formulaire désactivé');
  if (!isFormOpen(form)) throw httpError(400, 'Formulaire fermé');

  if (form.maxResponses) {
    const count = await prisma.hostedFormResponse.count({ where: { formId } });
    if (count >= form.maxResponses) throw httpError(400, 'Nombre maximum de réponses atteint');
  }

  const data = {};
  for (const field of form.fields) {
    const val = rawData[field.key];
    if (field.required && (val === undefined || val === null || val === '')) {
      throw httpError(400, `Champ requis manquant : ${field.label}`);
    }
    data[field.key] = val ?? null;
  }

  const response = await prisma.hostedFormResponse.create({
    data: { formId, data, metadata: metadata ?? {} },
  });

  if (form.discordWebhookUrl) {
    sendDiscordNotification(form.discordWebhookUrl, form.name, form.fields, data);
  }

  return {
    response: { id: response.id },
    notification: {
      kind: form.notifKind,
      title: form.notifTitle,
      message: form.notifMessage,
      durationSec: form.notifDurationSec,
    },
  };
}

async function assertFormAccess(companyId, siteId, formId) {
  const site = await prisma.hostedSite.findFirst({ where: { companyId, id: siteId }, select: { id: true } });
  if (!site) throw httpError(404, 'Site introuvable');
  const form = await prisma.hostedForm.findFirst({ where: { id: formId, siteId }, select: { id: true } });
  if (!form) throw httpError(404, 'Formulaire introuvable');
}

async function listResponses({ companyId, siteId, formId, unreadOnly }) {
  await assertFormAccess(companyId, siteId, formId);
  const where = { formId };
  if (unreadOnly) where.isRead = false;
  return prisma.hostedFormResponse.findMany({ where, orderBy: { createdAt: 'desc' } });
}

async function markRead({ companyId, siteId, formId, responseId, isRead }) {
  await assertFormAccess(companyId, siteId, formId);
  const resp = await prisma.hostedFormResponse.findFirst({ where: { id: responseId, formId } });
  if (!resp) throw httpError(404, 'Réponse introuvable');
  return prisma.hostedFormResponse.update({ where: { id: responseId }, data: { isRead } });
}

async function deleteResponse({ companyId, siteId, formId, responseId }) {
  await assertFormAccess(companyId, siteId, formId);
  const resp = await prisma.hostedFormResponse.findFirst({ where: { id: responseId, formId } });
  if (!resp) throw httpError(404, 'Réponse introuvable');
  await prisma.hostedFormResponse.delete({ where: { id: responseId } });
}

module.exports = { getPublicFormSchema, submitResponse, listResponses, markRead, deleteResponse };
