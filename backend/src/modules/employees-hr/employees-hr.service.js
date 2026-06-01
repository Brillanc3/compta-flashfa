// backend/src/modules/employees-hr/employees-hr.service.js
'use strict';

const prisma = require('../../db');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pipeline } = require('stream');
const util = require('util');

const pump = util.promisify(pipeline);
const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'hr');

function safeDiskPath(diskName) {
    const resolved = path.resolve(UPLOADS_DIR, diskName);
    if (!resolved.startsWith(UPLOADS_DIR + path.sep) && resolved !== UPLOADS_DIR) {
        const err = new Error('Invalid file path.');
        err.statusCode = 400;
        throw err;
    }
    return resolved;
}

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
];

async function assertEmployeeBelongsToCompany(companyId, employeeId) {
    const emp = await prisma.companyEmployee.findFirst({
        where: { id: Number(employeeId), companyId: Number(companyId) },
        select: { id: true },
    });
    if (!emp) {
        const err = new Error("Employé introuvable dans cette entreprise.");
        err.statusCode = 404;
        throw err;
    }
    return emp;
}

async function listHREvents({ companyId, employeeId }) {
    await assertEmployeeBelongsToCompany(companyId, employeeId);

    return prisma.employeeHREvent.findMany({
        where: { companyEmployeeId: Number(employeeId) },
        include: {
            attachments: {
                select: { id: true, publicId: true, fileName: true, mimeType: true, byteSize: true },
            },
            createdByEmployee: {
                select: { user: { select: { name: true } } },
            },
        },
        orderBy: { occurredAt: 'desc' },
    });
}

async function listPrimesForWeek({ companyId, employeeId, isoWeek, isoYear }) {
    await assertEmployeeBelongsToCompany(companyId, employeeId);

    return prisma.employeeHREvent.findMany({
        where: {
            companyEmployeeId: Number(employeeId),
            type: 'PRIME',
            isoWeek: Number(isoWeek),
            isoYear: Number(isoYear),
        },
        select: {
            id: true,
            title: true,
            description: true,
            amount: true,
            isoWeek: true,
            isoYear: true,
            occurredAt: true,
        },
        orderBy: { occurredAt: 'asc' },
    });
}

async function createHREvent({ companyId, employeeId, actorEmployeeId, body }) {
    await assertEmployeeBelongsToCompany(companyId, employeeId);

    const { type, title, description, amount, isoWeek, isoYear, occurredAt, expiresAt } = body;

    if (!type || !title) {
        const err = new Error("Les champs 'type' et 'title' sont requis.");
        err.statusCode = 400;
        throw err;
    }

    const VALID_TYPES = ['AVERTISSEMENT', 'FELICITATION', 'PRIME', 'NOTE'];
    if (!VALID_TYPES.includes(type)) {
        const err = new Error(`Type invalide: ${type}`);
        err.statusCode = 400;
        throw err;
    }

    if (type === 'PRIME' && (amount === undefined || amount === null)) {
        const err = new Error("Le champ 'amount' est requis pour une prime.");
        err.statusCode = 400;
        throw err;
    }

    if (type === 'PRIME' && (!isoWeek || !isoYear)) {
        const err = new Error("Les champs 'isoWeek' et 'isoYear' sont requis pour une prime.");
        err.statusCode = 400;
        throw err;
    }

    return prisma.employeeHREvent.create({
        data: {
            companyEmployeeId: Number(employeeId),
            createdByEmployeeId: actorEmployeeId ? Number(actorEmployeeId) : null,
            type,
            title,
            description: description || null,
            amount: type === 'PRIME' ? amount : null,
            isoWeek: type === 'PRIME' ? Number(isoWeek) : null,
            isoYear: type === 'PRIME' ? Number(isoYear) : null,
            occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
            expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
    });
}

async function updateHREvent({ companyId, employeeId, eventId, body }) {
    await assertEmployeeBelongsToCompany(companyId, employeeId);

    const event = await prisma.employeeHREvent.findFirst({
        where: { id: Number(eventId), companyEmployeeId: Number(employeeId) },
    });
    if (!event) {
        const err = new Error("Événement RH introuvable.");
        err.statusCode = 404;
        throw err;
    }

    const { title, description, amount, isoWeek, isoYear, occurredAt, expiresAt } = body;

    return prisma.employeeHREvent.update({
        where: { id: Number(eventId) },
        data: {
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description }),
            ...(amount !== undefined && { amount: event.type === 'PRIME' ? amount : null }),
            ...(isoWeek !== undefined && { isoWeek: event.type === 'PRIME' ? Number(isoWeek) : null }),
            ...(isoYear !== undefined && { isoYear: event.type === 'PRIME' ? Number(isoYear) : null }),
            ...(occurredAt !== undefined && { occurredAt: new Date(occurredAt) }),
            ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        },
    });
}

async function deleteHREvent({ companyId, employeeId, eventId }) {
    await assertEmployeeBelongsToCompany(companyId, employeeId);

    const event = await prisma.employeeHREvent.findFirst({
        where: { id: Number(eventId), companyEmployeeId: Number(employeeId) },
        include: { attachments: true },
    });
    if (!event) {
        const err = new Error("Événement RH introuvable.");
        err.statusCode = 404;
        throw err;
    }

    for (const att of event.attachments) {
        const filePath = safeDiskPath(att.diskPath);
        fs.unlink(filePath, (err) => {
            if (err && err.code !== 'ENOENT') {
                console.warn(`[HR] Failed to delete attachment file: ${filePath}`, err.message);
            }
        });
    }

    await prisma.employeeHREvent.delete({ where: { id: Number(eventId) } });
}

async function uploadAttachment({ companyId, employeeId, eventId, file }) {
    await assertEmployeeBelongsToCompany(companyId, employeeId);

    const event = await prisma.employeeHREvent.findFirst({
        where: { id: Number(eventId), companyEmployeeId: Number(employeeId) },
    });
    if (!event) {
        const err = new Error("Événement RH introuvable.");
        err.statusCode = 404;
        throw err;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        const err = new Error(`Type de fichier non autorisé: ${file.mimetype}`);
        err.statusCode = 400;
        throw err;
    }

    const publicId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.filename) || '';
    const diskName = `${publicId}${ext}`;
    const diskPath = path.join(UPLOADS_DIR, diskName);

    await pump(file.file, fs.createWriteStream(diskPath));

    const stat = fs.statSync(diskPath);

    try {
        return await prisma.employeeHRAttachment.create({
            data: {
                eventId: Number(eventId),
                publicId,
                fileName: file.filename,
                mimeType: file.mimetype,
                byteSize: stat.size,
                diskPath: diskName,
            },
        });
    } catch (err) {
        fs.unlink(diskPath, () => {});
        throw err;
    }
}

async function serveAttachment({ companyId, publicId }) {
    const att = await prisma.employeeHRAttachment.findUnique({
        where: { publicId },
        include: {
            event: {
                select: {
                    companyEmployee: { select: { companyId: true } }
                }
            }
        }
    });
    if (!att) return null;
    if (att.event.companyEmployee.companyId !== Number(companyId)) return null;

    const filePath = safeDiskPath(att.diskPath);
    if (!filePath || !fs.existsSync(filePath)) return null;

    return { att, filePath };
}

module.exports = {
    listHREvents,
    listPrimesForWeek,
    createHREvent,
    updateHREvent,
    deleteHREvent,
    uploadAttachment,
    serveAttachment,
};
