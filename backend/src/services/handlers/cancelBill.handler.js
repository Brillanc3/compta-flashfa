// backend/src/services/handlers/cancelBill.handler.js

const prisma = require('../../db');
const { CompanyEmployeeStatus, UserStatus } = require('@prisma/client');
const { createNotification } = require('../notificationService');

// Live WS (même pattern que addMoney)
const { getUserIdsByPermissionsCached } =
    require('../../lib/permissions/getUserIdsByPermissions.cached');
const { PERMISSIONS } =
    require('../../modules/comptabilite/comptabilite.permissions');
const { emitGatewayEvent } =
    require('../../core/gateway/gateway.emitter');

function supports(logType) {
    return logType === 'cancel';
}

function resolveBillsViewPermission() {
    return (
        PERMISSIONS?.BILLS_VIEW_ALL ??
        PERMISSIONS?.BILLS_VIEW_SELF ??
        'COMPTABILITE.{companyId}.BILLS.VIEW_ALL'
    );
}

function parseIntOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number.parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
}

async function ensureDefaultRank(tx, companyId) {
    let defaultRank = await tx.rank.findFirst({
        where: { companyId },
        orderBy: { position: 'asc' },
    });

    if (!defaultRank) {
        defaultRank = await tx.rank.create({
            data: {
                name: 'Recrue',
                position: 1,
                companyId,
                remunerationConfig: { commissionRate: 0, serviceSalaryPerMinute: 0 },
            },
        });
    }

    return defaultRank;
}

/**
 * Avec ton log:
 * {"cancellerPropername":"Dela vega Gonzo","cancellerDiscord":"...","characterIdCanceller":72338,...}
 */
async function ensureCancelerUser(tx, { companyId, discordId, characterId, properName }) {
    if (!discordId && !characterId) return null;

    let user = null;

    // Si tu as la contrainte UniqueDiscordCharacter, c’est le meilleur chemin
    if (discordId && characterId) {
        user = await tx.user.findUnique({
            where: { UniqueDiscordCharacter: { discordId: discordId.toString(), characterId } },
        });
    }

    if (!user) {
        const defaultRank = await ensureDefaultRank(tx, companyId);

        const employee = await tx.companyEmployee.create({
            data: {
                status: CompanyEmployeeStatus.PENDING_LINK,
                company: { connect: { id: companyId } },
                rank: { connect: { id: defaultRank.id } },
                user: {
                    create: {
                        name: (properName || 'Employé inconnu').trim(),
                        username: `pending_${characterId || 'unknown'}_${Date.now()}`,
                        password: '',
                        characterId: characterId ?? null,
                        discordId: discordId ? discordId.toString() : null,
                        status: UserStatus.PENDING_FINALIZATION,
                    },
                },
            },
            include: { user: true },
        });

        user = employee.user;
    } else {
        // Mise à jour du nom si changé
        const currentCancellerName = String(user.name || "").trim();
        if (properName && properName !== currentCancellerName) {
            try {
                await tx.user.update({ where: { id: user.id }, data: { name: properName } });
            } catch (_) {}
        }

        // S’assurer qu’il est employé de la company
        const existingEmployee = await tx.companyEmployee.findFirst({
            where: { userId: user.id, companyId },
        });

        if (!existingEmployee) {
            const defaultRank = await ensureDefaultRank(tx, companyId);
            await tx.companyEmployee.create({
                data: {
                    status: CompanyEmployeeStatus.PENDING_LINK,
                    company: { connect: { id: companyId } },
                    rank: { connect: { id: defaultRank.id } },
                    user: { connect: { id: user.id } },
                },
            });
        }
    }

    return user;
}

async function handle(log) {
    let logData;
    try {
        logData = JSON.parse(log.data);
    } catch (_) {
        throw new Error("Impossible de parser les données du log, le format JSON est invalide.");
    }

    const companyId = log.companyId;

    // ✅ Ton log cancel expose billId (et parfois source en fallback)
    const externalBillId = parseIntOrNull(logData.billId) ?? parseIntOrNull(logData.source);

    if (!externalBillId) {
        throw new Error(
            `Log ID ${log.id}: 'billId' absent et 'source' absent/invalide dans les données pour un log de type 'cancel'.`
        );
    }

    const cancelerIdentity = {
        // Dans la log: cancellerPropername / cancellerDiscord / characterIdCanceller
        properName: (logData.cancellerPropername || '').toString().trim() || null,
        discordId: logData.cancellerDiscord ? logData.cancellerDiscord.toString() : null,
        characterId: parseIntOrNull(logData.characterIdCanceller),
    };

    const updatedBill = await prisma.$transaction(async (tx) => {
        // IMPORTANT: findFirst car externalBillId est unique globalement mais tu filtres aussi companyId
        const bill = await tx.bill.findFirst({
            where: { externalBillId, companyId },
        });

        if (!bill) {
            console.log(`[CancelBillHandler] Bill ${externalBillId} not found for company ${companyId}. Skipping.`);
            return null;
        }

        const cancelerUser = await ensureCancelerUser(tx, { companyId, ...cancelerIdentity });
        const cancelerUserId = cancelerUser?.id ?? null;

        // Si déjà annulée, on complète canceledBy si manquant
        if (bill.status === 'CANCELED') {
            if (!bill.canceledById && cancelerUserId) {
                return tx.bill.update({
                    where: { id: bill.id },
                    data: { canceledById: cancelerUserId },
                    include: { author: true, client: true, canceledBy: true },
                });
            }
            return null;
        }

        return tx.bill.update({
            where: { id: bill.id },
            data: {
                status: 'CANCELED',
                canceledById: cancelerUserId,
            },
            include: { author: true, client: true, canceledBy: true },
        });
    });

    if (!updatedBill) return;

    // Notification auteur (optionnel)
    await createNotification({
        recipientUserIds: [updatedBill.authorId],
        content: {
            title: "Facture Annulée",
            body: `La facture N°${updatedBill.externalBillId} d'un montant de ${updatedBill.amount}$ a été annulée.`,
            billId: updatedBill.id,
        },
        type: 'SYSTEM',
        behavior: 'PERMANENT',
    });

    // Live WS => le front reçoit bill.canceledBy mis à jour
    try {
        const perm = resolveBillsViewPermission();
        const userIds = await getUserIdsByPermissionsCached(perm, companyId);
        console.log('createdBill perm', perm);
        console.log('createdBill candidates', perm.includes('{companyId}') ? [perm, perm.replace('{companyId}', String(companyId))] : [perm]);
        console.log('createdBill userIds', userIds);
        emitGatewayEvent({
            scope: 'USER',
            targets: userIds,
            event: 'BILL_UPDATED',
            payload: {
                companyId,
                bill: updatedBill,
            },
        });
    } catch (err) {
        console.error('[WS][BILL_UPDATED] Dispatch failed:', err);
    }
}

module.exports = {
    supports,
    handle,
};