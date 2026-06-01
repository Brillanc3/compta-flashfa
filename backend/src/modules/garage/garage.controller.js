// /backend/src/modules/garage/garage.controller.js

'use strict';

const service = require('./garage.service');

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */
function getCompanyId(request) {
    const raw = request.headers['x-company-id'];
    const id = Number(raw);

    if (!raw || Number.isNaN(id)) {
        throw new Error("Header 'x-company-id' manquant ou invalide.");
    }
    return id;
}

/* ---------------------------------------------------------
   VEHICLES (CRUD)
--------------------------------------------------------- */

async function getVehicles(request, reply) {
    try {
        const companyId = getCompanyId(request);
        const vehicles = await service.listVehicles(companyId);
        return reply.send({ vehicles });
    } catch (err) {
        return reply.code(400).send({ error: err.message });
    }
}

async function createVehicle(request, reply) {
    try {
        const companyId = getCompanyId(request);
        const userId = request.user.userId;

        const created = await service.createVehicle(companyId, userId, request.body);
        return reply.send(created);
    } catch (err) {
        return reply.code(400).send({ error: err.message });
    }
}

async function updateVehicle(request, reply) {
    try {
        const userId = request.user.userId;
        const id = Number(request.params.id);

        const updated = await service.updateVehicle(id, userId, request.body);
        return reply.send(updated);
    } catch (err) {
        return reply.code(400).send({ error: err.message });
    }
}

async function deleteVehicle(request, reply) {
    try {
        const id = Number(request.params.id);
        const deleted = await service.deleteVehicle(id);
        return reply.send({ success: true, deleted });
    } catch (err) {
        return reply.code(400).send({ error: err.message });
    }
}

/* ---------------------------------------------------------
   MOVEMENTS (Entrées / Sorties)
--------------------------------------------------------- */

async function getMovements(request, reply) {
    try {
        const companyId = getCompanyId(request);
        const movements = await service.listMovements(companyId);
        return reply.send({ movements });
    } catch (err) {
        return reply.code(400).send({ error: err.message });
    }
}

/* ---------------------------------------------------------
   EXPORTS
--------------------------------------------------------- */

module.exports = {
    getVehicles,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    getMovements,
};
