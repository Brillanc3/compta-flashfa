// backend/src/services/handlers/paidBill.handler.js

const prisma = require('../../db');

// Live WS (même pattern que addMoney)
const { getUserIdsByPermissionsCached } =
    require('../../lib/permissions/getUserIdsByPermissions.cached');
const { PERMISSIONS } =
    require('../../modules/comptabilite/comptabilite.permissions');
const { emitGatewayEvent } =
    require('../../core/gateway/gateway.emitter');

/**
 * Indique si ce handler peut traiter les logs de paiement de facture.
 * @param {string} logType
 * @returns {boolean}
 */
function supports(logType) {
    return ['paid', 'paidCash'].includes(logType);
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

/**
 * Traite un log de paiement pour mettre à jour le statut d'une facture.
 * @param {object} log - L'objet log complet de la base de données.
 */
async function handle(log) {
    let logData;
    try {
        logData = JSON.parse(log.data);
    } catch (error) {
        console.error(`Erreur de parsing JSON pour le log ID ${log.id}:`, log.data);
        throw new Error("Impossible de parser les données du log, le format JSON est invalide.");
    }

    const companyId = log.companyId;

    /**
     * IMPORTANT:
     * - Certaines sources envoient billId, d'autres "source" (comme cancel).
     * - On supporte les deux pour éviter les régressions.
     */
    const externalBillId =
        parseIntOrNull(logData.billId);

    if (!externalBillId) {
        throw new Error(
            `Log ID ${log.id}: 'billId' absent/invalide dans les données pour un log de type '${log.logType}'.`
        );
    }

    // IMPORTANT: findFirst si tu veux filtrer companyId aussi
    const bill = await prisma.bill.findFirst({
        where: {
            externalBillId,
            companyId,
        },
    });

    if (!bill) {
        throw new Error(
            `Facture avec l'ID externe ${externalBillId} non trouvée pour l'entreprise ID ${companyId}.`
        );
    }

    if (['PAID_CARD', 'PAID_CASH', 'CANCELED'].includes(bill.status)) {
        console.warn(`[paidBill] Facture ${externalBillId} déjà dans statut final (${bill.status}). Skip.`);
        return;
    }

    // Mise à jour des noms from/to si disponibles (best-effort)
    const fromCharacterId = parseIntOrNull(logData.characterIdFrom);
    const fromDiscordId = logData.fromDiscord ? logData.fromDiscord.toString() : null;
    const fromProperName = (logData.fromPropername || '').toString().trim() || null;
    const toCharacterId = parseIntOrNull(logData.characterIdTo);
    const toDiscordId = logData.toDiscord ? logData.toDiscord.toString() : null;
    const toProperName = (logData.toPropername || '').toString().trim() || null;

    try {
        for (const { cId, dId, name } of [
            { cId: fromCharacterId, dId: fromDiscordId, name: fromProperName },
            { cId: toCharacterId, dId: toDiscordId, name: toProperName },
        ]) {
            if (!name || (!cId && !dId)) continue;
            let u = null;
            if (cId && dId) u = await prisma.user.findUnique({ where: { UniqueDiscordCharacter: { discordId: dId, characterId: cId } } });
            else if (cId) u = await prisma.user.findFirst({ where: { characterId: cId } });
            else u = await prisma.user.findFirst({ where: { discordId: dId } });
            if (u && name !== (u.name || '').trim()) {
                await prisma.user.update({ where: { id: u.id }, data: { name } });
            }
        }
    } catch (_) { }

    // paid => carte ; paidCash => espèces
    const newStatus = log.logType === 'paid' ? 'PAID_CARD' : 'PAID_CASH';

    // On ne touche pas canceledById ici
    const updatedBill = await prisma.bill.update({
        where: { id: bill.id },
        data: { status: newStatus },
        include: {
            author: true,
            client: true,
            canceledBy: true,
        },
    });

    // ===========================
    // WS — BILL_UPDATED
    // ===========================
    if (updatedBill) {
        try {
            const perm = resolveBillsViewPermission();
            const userIds = await getUserIdsByPermissionsCached(perm, companyId);
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
}

module.exports = {
    supports,
    handle,
};
