// backend/src/modules/discord/discord.controller.js
'use strict';

const service = require('./discord.service');

function parseCompanyId(request) {
    const id = Number(request.headers['x-company-id']);
    if (!Number.isInteger(id) || id <= 0) {
        const e = new Error("Missing or invalid 'x-company-id' header.");
        e.statusCode = 400;
        throw e;
    }
    return id;
}

function sendError(reply, err) {
    reply.code(err?.statusCode || 500).send({ message: err?.message || 'Erreur interne.' });
}

const getConfig = async (req, reply) => {
    try {
        const companyId = parseCompanyId(req);
        const data = await service.getConfig(companyId);
        const clientId = process.env.DISCORD_CLIENT_ID ?? null;
        reply.send({ data: data ?? null, clientId });
    } catch (err) { sendError(reply, err); }
};

const saveConfig = async (req, reply) => {
    try {
        const companyId = parseCompanyId(req);
        const { guildId, rankRoleMap, enabled, guildName, guildIcon } = req.body ?? {};
        const data = await service.saveConfig(companyId, { guildId, rankRoleMap, enabled, guildName, guildIcon });
        reply.send({ success: true, data });
    } catch (err) { sendError(reply, err); }
};

const deleteConfig = async (req, reply) => {
    try {
        const companyId = parseCompanyId(req);
        await service.deleteConfig(companyId);
        reply.send({ success: true });
    } catch (err) { sendError(reply, err); }
};

const getGuildRoles = async (req, reply) => {
    try {
        const companyId = parseCompanyId(req);
        // Accept guildId from query (before save) or fall back to saved config
        let guildId = req.query?.guildId ?? null;
        if (!guildId) {
            const cfg = await service.getConfig(companyId);
            guildId = cfg?.guildId ?? null;
        }
        if (!guildId) {
            return reply.code(400).send({ message: 'Aucun serveur Discord configuré.' });
        }
        const roles = await service.getGuildRoles(guildId);
        reply.send({ roles });
    } catch (err) { sendError(reply, err); }
};

const verifyBot = async (req, reply) => {
    try {
        const companyId = parseCompanyId(req);
        const { guildId } = req.body ?? {};
        if (!guildId) return reply.code(400).send({ message: 'guildId requis.' });

        const { inGuild, guild } = await service.verifyBotInGuild(guildId);
        reply.send({ inGuild, guild });
    } catch (err) { sendError(reply, err); }
};

const syncAll = async (req, reply) => {
    try {
        const companyId = parseCompanyId(req);
        const result = await service.syncAll(companyId);
        reply.send({ success: true, ...result });
    } catch (err) { sendError(reply, err); }
};

module.exports = { getConfig, saveConfig, deleteConfig, getGuildRoles, verifyBot, syncAll };
