'use strict';

const crypto  = require('crypto');
const sharp   = require('sharp');

const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const { putObject } = require('../lib/storage');
const { prisma } = require('../../../shards/database');
const repo = require('./guild.repository');
const { createGuild, deleteGuild, syncCompanyMembers } = require('./guild.service');
const { listAuditLogs } = require('../moderation/audit.service');
const cache = require('../lib/cache');

async function create(req, reply) {
    const guild = await createGuild(req.user.id, req.body);
    return reply.code(201).send(guild);
}

async function getOne(req, reply) {
    const guild = await repo.findById(req.params.guildId);
    if (!guild) return reply.code(404).send({ code: 10004, message: 'Unknown Guild' });
    return reply.send(guild);
}

async function update(req, reply) {
    const gid = req.params.guildId;
    const existing = await repo.findById(gid);
    if (!existing) return reply.code(404).send({ code: 10004, message: 'Unknown Guild' });
    const guild = await repo.update(gid, req.body);
    return reply.send(guild);
}

async function destroy(req, reply) {
    try {
        await deleteGuild(req.params.guildId, req.user.id);
        return reply.code(204).send();
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function myGuilds(req, reply) {
    const guilds = await repo.findUserGuilds(req.user.id);
    return reply.send(guilds);
}

/**
 * Vide les caches Redis propres à l'utilisateur (déclenché par Ctrl+R côté client).
 * Le client refait ensuite ses fetch → listes guildes/channels/membres fraîches.
 */
async function refreshCache(req, reply) {
    const uid = String(req.user.id);
    await Promise.all([
        cache.del(cache.key('user', uid, 'guilds')),
        cache.delPattern(cache.key('perm', 'guild', '*', 'user', uid)),
        cache.delPattern(cache.key('perm', 'chan', '*', 'user', uid)),
        cache.delPattern(cache.key('member', uid, '*')),
        cache.delPattern(cache.key('readstate', uid, '*')),
    ]).catch(() => {});
    return reply.send({ ok: true });
}

async function auditLogs(req, reply) {
    const { limit, before, action_type, user_id } = req.query;
    const logs = await listAuditLogs(req.params.guildId, {
        limit:      limit      ? Number(limit)      : 50,
        before:     before     ?? undefined,
        actionType: action_type ? Number(action_type) : undefined,
        userId:     user_id    ? Number(user_id)    : undefined,
    });
    return reply.send(logs);
}

async function guildPresences(req, reply) {
    const { getBulkStatuses } = require('../sockets/presence.service');
    const members = await prisma.v2Member.findMany({
        where:  { guildId: BigInt(req.params.guildId) },
        select: { userId: true },
    });
    const statuses = await getBulkStatuses(members.map(m => m.userId));
    return reply.send(statuses);
}

async function syncMembers(req, reply) {
    const { guildId } = req.params;
    const guild = await repo.findById(guildId);
    if (!guild) return reply.code(404).send({ code: 10004, message: 'Unknown Guild' });
    if (!guild.companyId) return reply.code(400).send({ message: 'Guild non liée à une company' });
    await syncCompanyMembers(BigInt(guildId), guild.companyId);
    return reply.send({ ok: true });
}

async function uploadIcon(req, reply) {
    const { guildId } = req.params;
    const existing = await repo.findById(guildId);
    if (!existing) return reply.code(404).send({ code: 10004, message: 'Unknown Guild' });

    let buffer, mimetype;
    const parts = req.files({ limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
    for await (const part of parts) {
        const chunks = [];
        for await (const chunk of part.file) chunks.push(chunk);
        if (part.file.truncated) return reply.code(413).send({ message: 'File too large' });
        buffer   = Buffer.concat(chunks);
        mimetype = part.mimetype;
    }
    if (!buffer) return reply.code(400).send({ message: 'No file provided' });
    if (!ALLOWED_IMAGE_MIME.includes(mimetype)) return reply.code(415).send({ message: 'Image required (JPEG/PNG/GIF/WEBP)' });

    const uuid = crypto.randomUUID();
    const key  = `${uuid}.webp`;
    let webp;
    try {
        webp = await sharp(buffer).resize(256, 256, { fit: 'cover' }).webp({ quality: 90 }).toBuffer();
    } catch {
        return reply.code(422).send({ message: 'Invalid or corrupt image' });
    }
    await putObject(`v2/guilds/${guildId}/icons/${key}`, webp, 'image/webp');

    const guild = await repo.update(guildId, { iconHash: key });
    return reply.send({ iconHash: guild.iconHash });
}

async function uploadBanner(req, reply) {
    const { guildId } = req.params;
    const existing = await repo.findById(guildId);
    if (!existing) return reply.code(404).send({ code: 10004, message: 'Unknown Guild' });

    let buffer, mimetype;
    const parts = req.files({ limits: { fileSize: 4 * 1024 * 1024, files: 1 } });
    for await (const part of parts) {
        const chunks = [];
        for await (const chunk of part.file) chunks.push(chunk);
        if (part.file.truncated) return reply.code(413).send({ message: 'File too large' });
        buffer   = Buffer.concat(chunks);
        mimetype = part.mimetype;
    }
    if (!buffer) return reply.code(400).send({ message: 'No file provided' });
    if (!ALLOWED_IMAGE_MIME.includes(mimetype)) return reply.code(415).send({ message: 'Image required (JPEG/PNG/GIF/WEBP)' });

    const uuid = crypto.randomUUID();
    const key  = `${uuid}.webp`;
    let webp;
    try {
        webp = await sharp(buffer).resize(960, 540, { fit: 'cover' }).webp({ quality: 85 }).toBuffer();
    } catch {
        return reply.code(422).send({ message: 'Invalid or corrupt image' });
    }
    await putObject(`v2/guilds/${guildId}/banners/${key}`, webp, 'image/webp');

    const guild = await repo.update(guildId, { bannerHash: key });
    return reply.send({ bannerHash: guild.bannerHash });
}

module.exports = { create, getOne, update, destroy, myGuilds, refreshCache, auditLogs, guildPresences, syncMembers, uploadIcon, uploadBanner };
