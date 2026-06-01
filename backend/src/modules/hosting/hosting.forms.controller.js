const formsService = require('./hosting.forms.service');
const responsesService = require('./hosting.responses.service');

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

// ─── Formulaires ─────────────────────────────────────────

async function listForms(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  if (!companyId || !siteId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await formsService.listForms({ companyId, siteId })); }
  catch (e) { handleError(reply, e); }
}

async function getForm(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const formId = parseIntParam(req.params.formId);
  if (!companyId || !siteId || !formId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await formsService.getForm({ companyId, siteId, formId })); }
  catch (e) { handleError(reply, e); }
}

async function createForm(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  if (!companyId || !siteId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.code(201).send(await formsService.createForm({ companyId, siteId, data: req.body })); }
  catch (e) { handleError(reply, e); }
}

async function updateForm(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const formId = parseIntParam(req.params.formId);
  if (!companyId || !siteId || !formId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await formsService.updateForm({ companyId, siteId, formId, data: req.body })); }
  catch (e) { handleError(reply, e); }
}

async function deleteForm(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const formId = parseIntParam(req.params.formId);
  if (!companyId || !siteId || !formId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { await formsService.removeForm({ companyId, siteId, formId }); reply.code(204).send(); }
  catch (e) { handleError(reply, e); }
}

// ─── Champs ──────────────────────────────────────────────

async function addField(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const formId = parseIntParam(req.params.formId);
  if (!companyId || !siteId || !formId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.code(201).send(await formsService.addField({ companyId, siteId, formId, data: req.body })); }
  catch (e) { handleError(reply, e); }
}

async function updateField(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const formId = parseIntParam(req.params.formId);
  const fieldId = parseIntParam(req.params.fieldId);
  if (!companyId || !siteId || !formId || !fieldId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { reply.send(await formsService.updateField({ companyId, siteId, formId, fieldId, data: req.body })); }
  catch (e) { handleError(reply, e); }
}

async function deleteField(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const formId = parseIntParam(req.params.formId);
  const fieldId = parseIntParam(req.params.fieldId);
  if (!companyId || !siteId || !formId || !fieldId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { await formsService.removeField({ companyId, siteId, formId, fieldId }); reply.code(204).send(); }
  catch (e) { handleError(reply, e); }
}

async function reorderFields(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const formId = parseIntParam(req.params.formId);
  if (!companyId || !siteId || !formId) return reply.code(400).send({ message: 'Paramètres invalides' });
  const orderedIds = req.body?.orderedIds;
  if (!Array.isArray(orderedIds)) return reply.code(400).send({ message: 'orderedIds[] requis' });
  try { await formsService.reorderFields({ companyId, siteId, formId, orderedIds }); reply.send({ ok: true }); }
  catch (e) { handleError(reply, e); }
}

// ─── Réponses ────────────────────────────────────────────

async function listResponses(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const formId = parseIntParam(req.params.formId);
  if (!companyId || !siteId || !formId) return reply.code(400).send({ message: 'Paramètres invalides' });
  const unreadOnly = req.query.unread === 'true';
  try { reply.send(await responsesService.listResponses({ companyId, siteId, formId, unreadOnly })); }
  catch (e) { handleError(reply, e); }
}

async function markResponseRead(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const formId = parseIntParam(req.params.formId);
  const responseId = parseIntParam(req.params.responseId);
  if (!companyId || !siteId || !formId || !responseId) return reply.code(400).send({ message: 'Paramètres invalides' });
  const isRead = req.body?.isRead !== false;
  try { reply.send(await responsesService.markRead({ companyId, siteId, formId, responseId, isRead })); }
  catch (e) { handleError(reply, e); }
}

async function deleteResponse(req, reply) {
  const companyId = parseCompanyId(req);
  const siteId = parseIntParam(req.params.siteId);
  const formId = parseIntParam(req.params.formId);
  const responseId = parseIntParam(req.params.responseId);
  if (!companyId || !siteId || !formId || !responseId) return reply.code(400).send({ message: 'Paramètres invalides' });
  try { await responsesService.deleteResponse({ companyId, siteId, formId, responseId }); reply.code(204).send(); }
  catch (e) { handleError(reply, e); }
}

// ─── Public ──────────────────────────────────────────────

async function getPublicFormSchema(req, reply) {
  const { slug } = req.params;
  const formId = parseIntParam(req.params.formId);
  if (!formId) return reply.code(400).send({ message: 'formId invalide' });
  try { reply.send(await responsesService.getPublicFormSchema(slug, formId)); }
  catch (e) { handleError(reply, e); }
}

async function submitResponse(req, reply) {
  const { slug } = req.params;
  const formId = parseIntParam(req.params.formId);
  if (!formId) return reply.code(400).send({ message: 'formId invalide' });
  const metadata = { ip: req.ip, userAgent: req.headers['user-agent'] ?? '' };
  try {
    const result = await responsesService.submitResponse({ slug, formId, data: req.body ?? {}, metadata });
    reply.code(201).send(result);
  }
  catch (e) { handleError(reply, e); }
}

module.exports = {
  listForms, getForm, createForm, updateForm, deleteForm,
  addField, updateField, deleteField, reorderFields,
  listResponses, markResponseRead, deleteResponse,
  getPublicFormSchema, submitResponse,
};
