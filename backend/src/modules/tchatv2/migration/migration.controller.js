'use strict';

const { enableV2, disableV2, isV2Company } = require('./migration.service');
const { assignCompanyRankRole } = require('../guild/guild.service');
const { prisma } = require('../../../shards/database');

async function enable(req, reply) {
    const companyId = Number(req.params.companyId);
    if (!Number.isInteger(companyId) || companyId <= 0) {
        return reply.code(400).send({ message: 'companyId invalide' });
    }
    await enableV2(companyId);
    return reply.code(200).send({ ok: true, useTchatV2: true });
}

async function disable(req, reply) {
    const companyId = Number(req.params.companyId);
    if (!Number.isInteger(companyId) || companyId <= 0) {
        return reply.code(400).send({ message: 'companyId invalide' });
    }
    await disableV2(companyId);
    return reply.code(200).send({ ok: true, useTchatV2: false });
}

async function status(req, reply) {
    const companyId = Number(req.params.companyId);
    if (!Number.isInteger(companyId) || companyId <= 0) {
        return reply.code(400).send({ message: 'companyId invalide' });
    }
    const v2 = await isV2Company(companyId);
    return reply.code(200).send({ companyId, useTchatV2: v2 });
}

async function syncRanks(req, reply) {
    const companyId = Number(req.params.companyId);
    if (!Number.isInteger(companyId) || companyId <= 0) {
        return reply.code(400).send({ message: 'companyId invalide' });
    }
    const guild = await prisma.v2Guild.findFirst({
        where: { companyId },
        select: { id: true },
    });
    if (!guild) return reply.code(404).send({ message: 'Guild introuvable pour cette company' });

    const members = await prisma.v2Member.findMany({
        where: { guildId: guild.id },
        select: { userId: true },
    });

    let synced = 0;
    for (const m of members) {
        try {
            await assignCompanyRankRole(guild.id, m.userId, companyId);
            synced++;
        } catch {}
    }
    return reply.code(200).send({ ok: true, synced });
}

module.exports = { enable, disable, status, syncRanks };
