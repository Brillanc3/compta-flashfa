// /backend/src/modules/regie/regie.controller.js
'use strict';

const service = require('./regie.service');

async function getStatusHandler(req, reply) {
    const status = service.getServerStatus();
    return { status };
}

async function startServerHandler(req, reply) {
    const companyId = parseInt(req.params.companyId);
    const result = await service.startRTMP(companyId);
    return result;
}

async function stopServerHandler(req, reply) {
    const result = await service.stopRTMP();
    return result;
}

async function listKeysHandler(req, reply) {
    const companyId = parseInt(req.params.companyId);
    const keys = await service.listKeys(companyId);
    return keys;
}

async function generateKeyHandler(req, reply) {
    const companyId = parseInt(req.params.companyId);
    const { label, expiresAt } = req.body;
    const key = await service.generateKey(companyId, label, expiresAt);
    return key;
}

async function deleteKeyHandler(req, reply) {
    const companyId = parseInt(req.params.companyId);
    const { keyId } = req.params;
    await service.deleteKey(companyId, keyId);
    return { success: true };
}

async function toggleEmergencyHandler(req, reply) {
    const companyId = parseInt(req.params.companyId);
    const { keyId } = req.params;
    const { status } = req.body;
    const updated = await service.toggleEmergency(companyId, keyId, status);
    return updated;
}

async function getKeyStatusHandler(req, reply) {
    const { key } = req.params;
    const status = await service.getKeyStatus(key);
    if (!status) return reply.code(404).send({ message: "Key not found" });
    return status;
}

module.exports = {
    getStatusHandler,
    startServerHandler,
    stopServerHandler,
    listKeysHandler,
    generateKeyHandler,
    deleteKeyHandler,
    toggleEmergencyHandler,
    getKeyStatusHandler,
};
