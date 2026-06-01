'use strict';

const { nextV2 } = require('../lib/snowflake');
const { invalidateRole, invalidateGuild } = require('../permissions/permission.cache');
const repo = require('./role.repository');

async function createRole(guildId, userId, { name, color, hoist, position, permissions, mentionable }) {
    const userMax = await repo.getMaxPositionForUser(guildId, userId);
    const pos = position ?? 1;
    if (pos > userMax) {
        throw Object.assign(new Error('Cannot create role above your highest role'), { status: 403 });
    }
    const role = await repo.create({
        id: nextV2(),
        guildId: BigInt(guildId),
        name,
        color: color ?? 0,
        hoist: hoist ?? false,
        position: pos,
        permissions: permissions != null ? BigInt(permissions) : 0n,
        mentionable: mentionable ?? false,
    });
    return role;
}

async function updateRole(guildId, roleId, userId, data) {
    const existing = await repo.findById(roleId);
    if (!existing || existing.guildId !== BigInt(guildId)) {
        throw Object.assign(new Error('Unknown Role'), { status: 404 });
    }
    const isEveryone = existing.id === BigInt(guildId);
    if (isEveryone &&
        (data.name != null || data.color != null ||
         data.hoist != null || data.mentionable != null)) {
        throw Object.assign(
            new Error('Cannot edit @everyone display fields'), { status: 400 });
    }
    if (existing.managed && data.name != null) {
        throw Object.assign(new Error('Cannot rename a company-managed role'), { status: 400 });
    }
    const userMax = await repo.getMaxPositionForUser(guildId, userId);
    if (existing.position > userMax) {
        throw Object.assign(new Error('Cannot modify role above your highest role'), { status: 403 });
    }
    const updated = await repo.update(roleId, {
        ...(data.name        != null && { name: data.name }),
        ...(data.color       != null && { color: data.color }),
        ...(data.hoist       != null && { hoist: data.hoist }),
        ...(data.permissions != null && { permissions: BigInt(data.permissions) }),
        ...(data.mentionable != null && { mentionable: data.mentionable }),
    });
    await invalidateRole(guildId, roleId);
    return updated;
}

async function deleteRole(guildId, roleId, userId) {
    const existing = await repo.findById(roleId);
    if (!existing || existing.guildId !== BigInt(guildId)) {
        throw Object.assign(new Error('Unknown Role'), { status: 404 });
    }
    // Cannot delete @everyone (id === guildId)
    if (existing.id === BigInt(guildId)) {
        throw Object.assign(new Error('Cannot delete @everyone role'), { status: 400 });
    }
    if (existing.managed) {
        throw Object.assign(new Error('Cannot delete a company-managed role'), { status: 400 });
    }
    const userMax = await repo.getMaxPositionForUser(guildId, userId);
    if (existing.position > userMax) {
        throw Object.assign(new Error('Cannot delete role above your highest role'), { status: 403 });
    }
    await repo.remove(roleId);
    await invalidateRole(guildId, roleId);
}

async function reorderRoles(guildId, updates) {
    const filtered = updates.filter(u => String(u.id) !== String(guildId));
    if (filtered.length === 0) return;
    await repo.batchUpdatePositions(filtered);
    await invalidateGuild(guildId);
}

module.exports = { createRole, updateRole, deleteRole, reorderRoles };
