// backend/src/modules/discord/discord.service.js
'use strict';

const prisma = require('../../db');

const DISCORD_API = 'https://discord.com/api/v10';

function botHeaders() {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw Object.assign(new Error('DISCORD_BOT_TOKEN non configuré.'), { statusCode: 503 });
    return {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
    };
}

async function discordRequest(method, path, body) {
    const res = await fetch(`${DISCORD_API}${path}`, {
        method,
        headers: botHeaders(),
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok && res.status !== 204) {
        const text = await res.text().catch(() => '');
        const err = new Error(`Discord API ${res.status}: ${text}`);
        err.statusCode = res.status === 403 ? 403 : 502;
        throw err;
    }
    if (res.status === 204) return null;
    return res.json();
}

// ─── Settings helpers ───────────────────────────────────────────────────────

async function getDiscordSettings(companyId) {
    const row = await prisma.companySettings.findUnique({ where: { companyId } });
    const json = row?.settings ?? {};
    return json.discordIntegration ?? null;
}

async function saveDiscordSettings(companyId, discordIntegration) {
    const row = await prisma.companySettings.findUnique({ where: { companyId } });
    const current = row?.settings ?? {};

    await prisma.companySettings.upsert({
        where: { companyId },
        create: { companyId, settings: { ...current, discordIntegration } },
        update: { settings: { ...current, discordIntegration } },
    });
}

// ─── Guild uniqueness guard ──────────────────────────────────────────────────

async function assertGuildNotUsed(guildId, excludeCompanyId) {
    const all = await prisma.companySettings.findMany({
        where: { companyId: { not: excludeCompanyId } },
        select: { companyId: true, settings: true },
    });
    for (const row of all) {
        const s = row.settings?.discordIntegration;
        if (s?.guildId === guildId) {
            const err = new Error(`Ce serveur Discord est déjà lié à une autre entreprise.`);
            err.statusCode = 409;
            throw err;
        }
    }
}

// ─── Public: config CRUD ─────────────────────────────────────────────────────

async function getConfig(companyId) {
    return getDiscordSettings(companyId);
}

async function saveConfig(companyId, { guildId, rankRoleMap, enabled, guildName, guildIcon }) {
    if (guildId) await assertGuildNotUsed(guildId, companyId);

    const existing = await getDiscordSettings(companyId) ?? {};
    const merged = {
        guildId: guildId ?? existing.guildId ?? null,
        guildName: guildName ?? existing.guildName ?? null,
        guildIcon: guildIcon ?? existing.guildIcon ?? null,
        enabled: enabled ?? existing.enabled ?? false,
        rankRoleMap: rankRoleMap ?? existing.rankRoleMap ?? {},
    };
    await saveDiscordSettings(companyId, merged);
    return merged;
}

async function deleteConfig(companyId) {
    const row = await prisma.companySettings.findUnique({ where: { companyId } });
    if (!row) return;
    const { discordIntegration: _removed, ...rest } = row.settings ?? {};
    await prisma.companySettings.update({
        where: { companyId },
        data: { settings: rest },
    });
}

// ─── Discord: guild info ──────────────────────────────────────────────────────

async function getGuildRoles(guildId) {
    return discordRequest('GET', `/guilds/${guildId}/roles`);
}

async function verifyBotInGuild(guildId) {
    const guild = await discordRequest('GET', `/guilds/${guildId}`).catch(() => null);
    if (!guild) return { inGuild: false, guild: null };
    return {
        inGuild: true,
        guild: { id: guild.id, name: guild.name, icon: guild.icon ?? null },
    };
}

// ─── Sync: member roles ───────────────────────────────────────────────────────

async function getMemberDiscordId(companyId, employeeId) {
    const emp = await prisma.companyEmployee.findFirst({
        where: { id: employeeId, companyId },
        include: { user: { select: { discordId: true } } },
    });
    return emp?.user?.discordId ?? null;
}

async function addRole(guildId, discordUserId, roleId) {
    await discordRequest('PUT', `/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`);
}

async function removeRole(guildId, discordUserId, roleId) {
    await discordRequest('DELETE', `/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`);
}

// rankRoleMap values are arrays: { rankId: [roleId1, roleId2] }
function getRoleIds(rankRoleMap, rankId) {
    const v = rankRoleMap[String(rankId)];
    if (!v) return [];
    return Array.isArray(v) ? v : [v]; // backward-compat: handle legacy single string
}

// Remove all mapped roles from a member
async function clearMappedRoles(guildId, discordUserId, rankRoleMap) {
    const allRoleIds = Object.values(rankRoleMap).flatMap((v) => Array.isArray(v) ? v : [v]);
    const unique = [...new Set(allRoleIds)];
    await Promise.allSettled(
        unique.map((roleId) => removeRole(guildId, discordUserId, roleId))
    );
}

// ─── Public: sync triggers ────────────────────────────────────────────────────

// Called after changeEmployeeStatus
async function syncOnStatusChange(companyId, employeeId, newStatus, rankId) {
    try {
        const cfg = await getDiscordSettings(companyId);
        if (!cfg?.enabled || !cfg?.guildId) {
            console.log(`[Discord] syncOnStatusChange skip: enabled=${cfg?.enabled} guildId=${cfg?.guildId}`);
            return;
        }

        const discordUserId = await getMemberDiscordId(companyId, employeeId);
        if (!discordUserId) {
            console.log(`[Discord] syncOnStatusChange skip: employee ${employeeId} has no discordId`);
            return;
        }

        const { guildId, rankRoleMap } = cfg;
        const isLeaving = newStatus === 'FIRE' || newStatus === 'RESIGNED';
        console.log(`[Discord] syncOnStatusChange: status=${newStatus} discordUser=${discordUserId} leaving=${isLeaving}`);

        if (isLeaving) {
            await clearMappedRoles(guildId, discordUserId, rankRoleMap);
        } else if (newStatus === 'ACTIVE' && rankId) {
            const roleIds = getRoleIds(rankRoleMap, rankId);
            console.log(`[Discord] adding roles for rankId=${rankId}:`, roleIds);
            await Promise.allSettled(roleIds.map((r) => addRole(guildId, discordUserId, r)));
        }
    } catch (err) {
        console.error('[Discord] syncOnStatusChange error:', err.message);
    }
}

// Called after changeEmployeeRank
async function syncOnRankChange(companyId, employeeId, oldRankId, newRankId) {
    try {
        const cfg = await getDiscordSettings(companyId);
        if (!cfg?.enabled || !cfg?.guildId) {
            console.log(`[Discord] syncOnRankChange skip: enabled=${cfg?.enabled} guildId=${cfg?.guildId}`);
            return;
        }

        const discordUserId = await getMemberDiscordId(companyId, employeeId);
        if (!discordUserId) {
            console.log(`[Discord] syncOnRankChange skip: employee ${employeeId} has no discordId`);
            return;
        }

        const { guildId, rankRoleMap } = cfg;
        console.log(`[Discord] syncOnRankChange: employee=${employeeId} ${oldRankId}→${newRankId} discordUser=${discordUserId}`);

        if (oldRankId) {
            const oldRoleIds = getRoleIds(rankRoleMap, oldRankId);
            console.log(`[Discord] removing roles for oldRankId=${oldRankId}:`, oldRoleIds);
            await Promise.allSettled(oldRoleIds.map((r) => removeRole(guildId, discordUserId, r)));
        }
        if (newRankId) {
            const newRoleIds = getRoleIds(rankRoleMap, newRankId);
            console.log(`[Discord] adding roles for newRankId=${newRankId}:`, newRoleIds);
            await Promise.allSettled(newRoleIds.map((r) => addRole(guildId, discordUserId, r)));
        }
    } catch (err) {
        console.error('[Discord] syncOnRankChange error:', err.message);
    }
}

// ─── Public: full sync ───────────────────────────────────────────────────────

async function syncAll(companyId) {
    const cfg = await getDiscordSettings(companyId);
    if (!cfg?.enabled || !cfg?.guildId) {
        const err = new Error('Synchronisation désactivée ou serveur non configuré.');
        err.statusCode = 400;
        throw err;
    }

    const { guildId, rankRoleMap } = cfg;

    const employees = await prisma.companyEmployee.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: { id: true, rankId: true, user: { select: { discordId: true } } },
    });

    let synced = 0, skipped = 0, errors = 0;

    await Promise.allSettled(
        employees.map(async (emp) => {
            const discordUserId = emp.user?.discordId;
            if (!discordUserId) { skipped++; return; }
            try {
                await clearMappedRoles(guildId, discordUserId, rankRoleMap);
                if (emp.rankId) {
                    const roleIds = getRoleIds(rankRoleMap, emp.rankId);
                    await Promise.allSettled(roleIds.map((r) => addRole(guildId, discordUserId, r)));
                }
                synced++;
            } catch {
                errors++;
            }
        })
    );

    return { synced, skipped, errors, total: employees.length };
}

module.exports = {
    getConfig,
    saveConfig,
    deleteConfig,
    getGuildRoles,
    verifyBotInGuild,
    syncOnStatusChange,
    syncOnRankChange,
    syncAll,
};
