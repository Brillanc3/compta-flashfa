// backend/src/services/handlers/duty.handler.js

const crypto = require('crypto');
const prisma = require('../../db');
const { CompanyEmployeeStatus, UserStatus } = require('@prisma/client');
const { _internal_createEvent, _internal_updateEvent } = require('../../modules/calendar/calendar.service');
const { formatDistanceStrict } = require('date-fns');
const { fr } = require('date-fns/locale');

const { emitGatewayEvent } = require('../../core/gateway/gateway.emitter');

// Ajuste le chemin si différent dans ton codebase (c’est la fonction que tu utilises déjà ailleurs)
const { getUserIdsByPermissionsCached } = require('../../lib/permissions/getUserIdsByPermissions.cached.js');
const { PERMISSIONS } = require('../../modules/comptabilite/comptabilite.permissions');

function supports(logType) {
    return logType === 'setStatus';
}

function toInt(v) {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toStringOrNull(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s.length ? s : null;
}

function isTruthy(v) {
    return v === true || v === 1 || v === '1' || v === 'true' || v === 'TRUE';
}

function getEventTime(log) {
    const asNum = Number(log.date);
    if (Number.isFinite(asNum) && asNum > 0) return new Date(asNum);
    return new Date(log.date);
}

function isPendingUsername(username, characterId) {
    if (!username || !characterId) return false;
    return String(username).startsWith(`pending_${characterId}_`);
}

async function ensureDefaultRank(companyId) {
    const cId = Number(companyId);
    if (!Number.isFinite(cId) || cId <= 0) {
        throw new Error(`[DutyHandler] companyId invalide: ${companyId}`);
    }

    let rank = await prisma.rank.findFirst({
        where: { companyId: cId },
        orderBy: { position: 'asc' },
    });

    if (rank) return rank;

    return prisma.rank.create({
        data: {
            name: 'Recrue',
            position: 1,
            companyId: cId,
            remunerationConfig: { commissionRate: 0, serviceSalaryPerMinute: 0 },
        },
    });
}

/**
 * Résout un user de manière robuste avec ton @@unique([discordId, characterId])
 * Ordre de préférence :
 * 1) discordId + characterId
 * 2) characterId
 * 3) discordId
 */
async function resolveUser({ discordId, characterId }) {
    if (discordId && characterId) {
        const u = await prisma.user.findFirst({
            where: { discordId: String(discordId), characterId: Number(characterId) },
            orderBy: { id: 'desc' },
        });
        if (u) return u;
    }

    if (characterId) {
        const u = await prisma.user.findFirst({
            where: { characterId: Number(characterId) },
            orderBy: { id: 'desc' },
        });
        if (u) return u;
    }

    if (discordId) {
        const u = await prisma.user.findFirst({
            where: { discordId: String(discordId) },
            orderBy: { id: 'desc' },
        });
        if (u) return u;
    }

    return null;
}

/**
 * Création user temp + employment temp, avec gestion de collision sur UniqueDiscordCharacter.
 *
 * FIX:
 * - Utiliser company: { connect } + rank: { connect } (comme addMoney.handler.js)
 *   car nested user.create => Prisma exige les relations requises via connect (sinon "Argument `company` is missing.")
 */
async function createTempUserAndEmployment({ companyId, discordId, characterId, properName }) {
    const defaultRank = await ensureDefaultRank(companyId);
    const cId = Number(companyId);

    const username = `pending_${characterId || 'unknown'}_${Date.now()}`;
    const tempPassword = crypto.randomBytes(32).toString('hex');

    try {
        const created = await prisma.companyEmployee.create({
            data: {
                status: CompanyEmployeeStatus.PENDING_LINK,

                // ✅ IMPORTANT: relations requises via connect (évite l'erreur "company is missing")
                company: { connect: { id: cId } },
                rank: { connect: { id: defaultRank.id } },

                user: {
                    create: {
                        name: properName || 'Employé inconnu',
                        username,
                        password: tempPassword,
                        characterId: characterId || null,
                        discordId: discordId || null,

                        // Cohérent avec addMoney: l’utilisateur créé automatiquement est “en attente”
                        status: UserStatus.PENDING_FINALIZATION,
                    },
                },
            },
            include: { user: true },
        });

        return { user: created.user, employmentId: created.id };
    } catch (err) {
        // Si collision UniqueDiscordCharacter (P2002), on récupère l’existant et on créé/assure l’employment.
        if (err?.code === 'P2002') {
            const existing = await resolveUser({ discordId, characterId });
            if (!existing) throw err;

            await ensureEmployment({ companyId: cId, user: existing, characterId });
            return { user: existing, employmentId: null };
        }

        throw err;
    }
}

/**
 * Assure que CompanyEmployee existe dans la company, et applique la règle PENDING_LINK / ACTIVE.
 *
 * (Optionnel mais recommandé) : utiliser aussi connect() pour rester homogène et éviter
 * toute dépendance implicite aux UncheckedCreateInput.
 */
async function ensureEmployment({ companyId, user, characterId }) {
    const cId = Number(companyId);
    const defaultRank = await ensureDefaultRank(cId);

    const pending = isPendingUsername(user.username, characterId);
    const desiredStatus = pending ? CompanyEmployeeStatus.PENDING_LINK : CompanyEmployeeStatus.ACTIVE;

    let employment = await prisma.companyEmployee.findFirst({
        where: { companyId: cId, userId: user.id },
    });

    if (!employment) {
        try {
            employment = await prisma.companyEmployee.create({
                data: {
                    status: desiredStatus,
                    company: { connect: { id: cId } },
                    user: { connect: { id: user.id } },
                    rank: { connect: { id: defaultRank.id } },
                },
            });
        } catch (err) {
            // Si créé en parallèle ailleurs
            if (err?.code === 'P2002') {
                employment = await prisma.companyEmployee.findFirst({
                    where: { companyId: cId, userId: user.id },
                });
            } else {
                throw err;
            }
        }
    }

    // Aligner statut
    if (employment && employment.status !== desiredStatus) {
        employment = await prisma.companyEmployee.update({
            where: { id: employment.id },
            data: { status: desiredStatus },
        });
    }

    // Rank fallback
    if (employment && !employment.rankId) {
        await prisma.companyEmployee.update({
            where: { id: employment.id },
            data: { rank: { connect: { id: defaultRank.id } } },
        });
    }

    return employment;
}

async function dispatchDutyEvent({ companyId, userId, event, payload }) {
    try {
        const watcherIds = await getUserIdsByPermissionsCached(PERMISSIONS.USERS_DUTY, companyId);
        const targets = Array.from(new Set([userId, ...(watcherIds || [])]));

        emitGatewayEvent({
            scope: 'USER',
            targets,
            event,
            payload,
        });
    } catch (err) {
        console.error(`[WS][${event}] Dispatch failed:`, err);
    }
}

async function handle(log) {
    const companyId = log.companyId;
    const eventTime = getEventTime(log);

    let logData;
    try {
        logData = JSON.parse(log.data);
    } catch (error) {
        await prisma.log.update({
            where: { id: log.id },
            data: { isProcessed: true, processingError: `[DutyHandler] JSON invalide: ${error.message}` },
        });
        return;
    }

    const characterId = toInt(logData.characterId);
    const discordId = toStringOrNull(logData.discord);
    const properName = toStringOrNull(logData.properName);
    const isStart = isTruthy(logData.status); // true = prise, false = fin

    if (!characterId && !discordId) {
        await prisma.log.update({
            where: { id: log.id },
            data: { isProcessed: true, processingError: `[DutyHandler] characterId ou discordId manquant.` },
        });
        return;
    }

    try {
        // 1) Résoudre user, sinon création complète
        let user = await resolveUser({ discordId, characterId });

        if (!user) {
            const created = await createTempUserAndEmployment({
                companyId,
                discordId,
                characterId,
                properName,
            });
            user = created.user;
        } else {
            // Patch “soft” : compléter discordId/characterId si manquants (sans écraser)
            const patch = {};
            if (discordId && !user.discordId) patch.discordId = discordId;
            if (characterId && !user.characterId) patch.characterId = characterId;

            if (properName && properName !== String(user.name || '').trim()) {
                patch.name = properName;
            }

            if (Object.keys(patch).length) {
                try {
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: patch,
                    });
                } catch (err) {
                    // Collision UniqueDiscordCharacter => on ignore le patch, on garde user tel quel
                    if (err?.code !== 'P2002') throw err;
                }
            }

            // Assurer employment + appliquer règle pending/active
            await ensureEmployment({ companyId, user, characterId });
        }

        const employeeName = properName || user.name || `Employé #${user.id}`;

        // 2) Prise de service
        if (isStart) {
            const existing = await prisma.calendarEvent.findFirst({
                where: {
                    companyId,
                    userId: user.id,
                    createdBySystem: true,
                    endTime: null,
                },
                select: { id: true },
            });

            if (existing) {
                await prisma.log.update({
                    where: { id: log.id },
                    data: { isProcessed: true, processingError: 'Service déjà en cours.' },
                });
                return;
            }

            const createdEvent = await _internal_createEvent(
                {
                    title: `Prise de Service - ${employeeName}`,
                    startTime: eventTime.toISOString(),
                    endTime: null,
                    isAllDay: false,
                    createdBySystem: true,
                    companyId,
                    userId: user.id,
                    description: 'Service en cours...',
                },
                user.id
            );

            await dispatchDutyEvent({
                companyId,
                userId: user.id,
                event: 'DUTY_STARTED',
                payload: {
                    companyId,
                    userId: user.id,
                    startTime:
                        (createdEvent?.startTime && new Date(createdEvent.startTime).toISOString()) ||
                        eventTime.toISOString(),
                    name: employeeName,
                    date: eventTime.toISOString(),
                },
            });
        }

        // 3) Fin de service
        else {
            const openEvent = await prisma.calendarEvent.findFirst({
                where: {
                    companyId,
                    userId: user.id,
                    createdBySystem: true,
                    endTime: null,
                },
                orderBy: { startTime: 'desc' },
                select: { id: true, startTime: true },
            });

            if (!openEvent) {
                await prisma.log.update({
                    where: { id: log.id },
                    data: { isProcessed: true, processingError: 'Aucun service ouvert.' },
                });
                return;
            }

            let duration = 'Durée inconnue';
            try {
                duration = `Durée: ${formatDistanceStrict(openEvent.startTime, eventTime, { locale: fr })}`;
            } catch {}

            const updatedEvent = await _internal_updateEvent(openEvent.id, {
                endTime: eventTime.toISOString(),
                description: duration,
            });

            await dispatchDutyEvent({
                companyId,
                userId: user.id,
                event: 'DUTY_ENDED',
                payload: {
                    companyId,
                    userId: user.id,
                    startTime: openEvent.startTime?.toISOString?.() ?? openEvent.startTime,
                    endTime:
                        (updatedEvent?.endTime && new Date(updatedEvent.endTime).toISOString()) ||
                        eventTime.toISOString(),
                    name: employeeName,
                    date: eventTime.toISOString(),
                },
            });
        }

        // 4) Finalisation du log
        await prisma.log.update({
            where: { id: log.id },
            data: { isProcessed: true, processingError: null },
        });
    } catch (err) {
        console.error('[DutyHandler] failed:', err);

        await prisma.log.update({
            where: { id: log.id },
            data: {
                isProcessed: true,
                processingError: err?.message ? String(err.message) : 'Erreur inconnue (DutyHandler).',
            },
        });
    }
}

module.exports = {
    supports,
    handle,
};
