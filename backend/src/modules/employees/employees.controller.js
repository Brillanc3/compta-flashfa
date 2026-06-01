// backend/src/modules/employees/employees.controller.js
'use strict';

const service = require('./employees.service');
const prisma = require('../../db'); // laissé si utilisé ailleurs dans le contrôleur

// ---- Helpers ----
function parseCompanyIdFromHeader(request) {
    const raw = request.headers['x-company-id'];

    // companyId doit être un entier strictement positif
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
        const e = new Error("Missing or invalid 'x-company-id' header (numeric required).");
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

/**
 * Reset du mot de passe d'un compte employé.
 * Accessible seulement si l'utilisateur a la permission RESET_ACCOUNT.
 *
 * Comportement :
 * - Si un token actif existe → renvoie le token existant, alreadyActive = true
 * - Sinon → génère un token 6 chiffres valable 15 minutes, alreadyActive = false
 */
const resetEmployeeAccountController = async (request, reply) => {

    try {
        const companyId = parseCompanyIdFromHeader(request);
        const employeeId = request.params.employeeId;
        const actorUserId = request.user?.userId || null;

        const data = await service.resetEmployeeAccount({
            companyId,
            employeeId,
            actorUserId,
        });

        reply.send({
            success: true,
            data,
        });
    } catch (err) {
        sendError(reply, err, "Impossible de réinitialiser le compte employé.");
    }
}

// ---- Meta / Settings ----
const getAvailableColumns = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const data = await service.getAvailableColumns(companyId);
        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la récupération des colonnes disponibles.');
    }
};

const getAvailablePermissionTemplates = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const data = await service.getAvailablePermissionTemplates(companyId);
        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la récupération des permissions disponibles.');
    }
};

const getRemunerationSchema = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const data = await service.getRemunerationSchema(companyId);
        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la récupération du schéma de rémunération.');
    }
};

const getRankFormSettings = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const data = await service.getRankFormSettings(companyId);
        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la récupération des paramètres du formulaire de grade.');
    }
};

// ---- Rangs ----
const getRanks = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const data = await service.getRanks(companyId);
        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la récupération des grades.');
    }
};

const createRank = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const data = await service.createRank({
            companyId,
            payload: request.body,
            actorUserId: request.user?.userId
        });
        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la création du grade.');
    }
};

const updateRank = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const { rankId } = request.params;
        const data = await service.updateRank({
            companyId,
            rankId,
            payload: request.body,
            actorUserId: request.user?.userId,
        });
        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la mise à jour du grade.');
    }
};

const deleteRank = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const { rankId } = request.params;
        const data = await service.deleteRank({
            companyId,
            rankId,
            actorUserId: request.user?.userId
        });
        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la suppression du grade.');
    }
};

const updateRankOrder = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const data = await service.updateRankOrder({
            companyId, order: request.body });
        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la réorganisation des grades.');
    }
};

// ---- Employés ----
const getEmployees = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const data = await service.getEmployees(companyId, request.query);
        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la récupération des employés.');
    }
};

const getEmployeeDetails = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const { employeeId } = request.params;
        const data = await service.getEmployeeDetails({ companyId, employeeId });
        reply.send(data);
    } catch (err) {
        sendError(reply, err, "Erreur lors de la récupération du profil de l'employé.");
    }
};

const changeEmployeeStatus = async (request, reply) => {
    try {
        const companyId  = Number.parseInt(request.headers['x-company-id'], 10);
        const employeeId = Number.parseInt(request.params.employeeId, 10);
        const { status } = request.body || {};

        const data = await service.changeEmployeeStatus({ companyId, employeeId, status });
        return reply.code(200).send({ success: true, data });
    } catch (err) {
        return reply.code(200).send({
            success: false,
            message: err.message || 'Erreur lors du changement de rang.',
            statusCode: err.statusCode || 500,
        });
    }
};

const changeEmployeeRank = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const { employeeId } = request.params;
        const currentUserId = request.user?.userId;
        const data = await service.changeEmployeeRank({
            companyId,
            employeeId,
            rankId: request.body?.newRankId,
            actorUserId: currentUserId
        });
        reply.send(data);
    } catch (err) {
        sendError(reply, err, "Erreur lors de la modification du grade de l'employé.");
    }
};

const sendProfileUpdateRequest = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const { employeeId } = request.params;
        const data = await service.sendProfileUpdateRequest({ companyId, employeeId });
        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de l’envoi de la demande de mise à jour du profil.');
    }
};

const getSalaryBreakdown = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const { employeeId } = request.params;
        const data = await service.getSalaryBreakdown(companyId, employeeId,  request.query );
        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la récupération du détail de salaire.');
    }
};

const setSalaryOverride = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const { employeeId } = request.params;
        const { year, week, amount } = request.body || {};
        const data = await service.setEmployeeSalaryOverride({ companyId, employeeId, year, week, amount });
        reply.send({ success: true, data });
    } catch (err) {
        sendError(reply, err, "Erreur lors de la mise à jour de l'override de salaire.");
    }
};

// ---- Widgets / Data ----
const getWidgetData_MySalary = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const currentUserId = request.user?.userId;

        const data = await service.getWidgetData_MySalary({ companyId, userId: currentUserId });
        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la récupération du widget salaire.');
    }
};

// ---- Chat helper ----
const getUsersForChat = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const users = await service.getUsersForChat(companyId);
        reply.send(users);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la récupération des utilisateurs pour le chat.');
    }
};

const getCompanyEmployee = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);

        const {
            activeAt,
            includeInactive,
            search,
            statuses,
            rankIds,
        } = request.query || {};

        const data = await service.getCompanyEmployees(companyId, {
            activeAt,
            includeInactive,
            search,
            statuses,
            rankIds,
        });

        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la récupération des employés de la compagnie.');
    }
};

const getWidgetData_MyTurnover = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const currentUserId = request.user?.userId;

        const { mode, year, week, date } = request.query || {};
        const config = { mode, year, week, date };

        const data = await service.getWidgetData_MyTurnover({
            companyId,
            userId: currentUserId,
            config,
        });

        reply.send(data);
    } catch (err) {
        sendError(reply, err, "Erreur lors de la récupération du widget chiffre d'affaire.");
    }
};


const generateLinkCodeController = async (request, reply) => {
    try {
        const companyId = parseCompanyIdFromHeader(request);
        const { employeeId } = request.params;
        const data = await service.generateLinkCode({ companyId, employeeId });
        reply.send({ success: true, data });
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la génération du code de liaison.');
    }
};

const useLinkCodeController = async (request, reply) => {
    try {
        const currentUserId = request.user?.userId;
        const { code } = request.body || {};
        if (!code || typeof code !== 'string') {
            return reply.code(400).send({ message: 'Code de liaison requis.' });
        }
        const data = await service.useLinkCode({ currentUserId, code: code.trim().toUpperCase() });
        reply.send(data);
    } catch (err) {
        sendError(reply, err, 'Erreur lors de la liaison du compte.');
    }
};

module.exports = {
    sendError,
    // Meta / Settings
    getAvailableColumns,
    getAvailablePermissionTemplates,
    getRemunerationSchema,
    getRankFormSettings,

    // Rangs
    getRanks,
    createRank,
    updateRank,
    deleteRank,
    updateRankOrder,

    // Employés
    getEmployees,
    getEmployeeDetails,
    changeEmployeeStatus,
    changeEmployeeRank,
    sendProfileUpdateRequest,
    getSalaryBreakdown,
    setSalaryOverride,
    resetEmployeeAccountController,

    // Link Code
    generateLinkCodeController,
    useLinkCodeController,

    // Widgets
    getWidgetData_MySalary,
    getWidgetData_MyTurnover,

    // Chat helper
    getUsersForChat,
    getCompanyEmployee,
};
