// backend/src/modules/employees-hr/employees-hr.controller.js
'use strict';

const fs = require('fs');
const service = require('./employees-hr.service');

function parseCompanyId(request) {
    const raw = request.headers['x-company-id'];
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
        const e = new Error("Missing or invalid 'x-company-id' header.");
        e.statusCode = 400;
        throw e;
    }
    return id;
}

function sendError(reply, error, fallbackMsg) {
    const status = error?.statusCode || error?.status || 500;
    const message = error?.message || fallbackMsg || 'Internal Server Error';
    reply.code(status).send({ message, status });
}

const listEvents = async (req, reply) => {
    try {
        const companyId = parseCompanyId(req);
        const { employeeId } = req.params;
        const data = await service.listHREvents({ companyId, employeeId });
        reply.send(data);
    } catch (err) { sendError(reply, err); }
};

const listPrimes = async (req, reply) => {
    try {
        const companyId = parseCompanyId(req);
        const { employeeId } = req.params;
        const { isoWeek, isoYear } = req.query;
        if (!isoWeek || !isoYear) {
            return reply.code(400).send({ message: "isoWeek et isoYear sont requis." });
        }
        const data = await service.listPrimesForWeek({ companyId, employeeId, isoWeek, isoYear });
        reply.send(data);
    } catch (err) { sendError(reply, err); }
};

const createEvent = async (req, reply) => {
    try {
        const companyId = parseCompanyId(req);
        const { employeeId } = req.params;
        const actorEmployeeId = req.user?.companyEmployeeId ?? null;
        const data = await service.createHREvent({ companyId, employeeId, actorEmployeeId, body: req.body });
        reply.code(201).send(data);
    } catch (err) { sendError(reply, err); }
};

const updateEvent = async (req, reply) => {
    try {
        const companyId = parseCompanyId(req);
        const { employeeId, eventId } = req.params;
        const data = await service.updateHREvent({ companyId, employeeId, eventId, body: req.body });
        reply.send(data);
    } catch (err) { sendError(reply, err); }
};

const deleteEvent = async (req, reply) => {
    try {
        const companyId = parseCompanyId(req);
        const { employeeId, eventId } = req.params;
        await service.deleteHREvent({ companyId, employeeId, eventId });
        reply.code(204).send();
    } catch (err) { sendError(reply, err); }
};

const uploadAttachment = async (req, reply) => {
    try {
        const companyId = parseCompanyId(req);
        const { employeeId, eventId } = req.params;
        const file = await req.file();
        if (!file) return reply.code(400).send({ message: "Aucun fichier reçu." });
        const data = await service.uploadAttachment({ companyId, employeeId, eventId, file });
        reply.code(201).send(data);
    } catch (err) { sendError(reply, err); }
};

const serveAttachment = async (req, reply) => {
    try {
        const companyId = parseCompanyId(req);
        const { publicId } = req.params;
        const result = await service.serveAttachment({ companyId, publicId });
        if (!result) return reply.code(404).send({ message: "Pièce jointe introuvable." });
        const { att, filePath } = result;
        const buffer = await fs.promises.readFile(filePath);
        reply
            .header('Content-Disposition', `attachment; filename="${encodeURIComponent(att.fileName)}"`)
            .type(att.mimeType)
            .send(buffer);
    } catch (err) { sendError(reply, err); }
};

module.exports = { listEvents, listPrimes, createEvent, updateEvent, deleteEvent, uploadAttachment, serveAttachment };
