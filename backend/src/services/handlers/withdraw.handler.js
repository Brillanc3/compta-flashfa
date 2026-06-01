// backend/src/services/handlers/withdraw.handler.js

const prisma = require('../../db');
const { TransactionType, TransactionCategoryName } = require('@prisma/client');
const { getUserIdsByPermissionsCached } =
    require('../../lib/permissions/getUserIdsByPermissions.cached');
const { PERMISSIONS } =
    require('../../modules/comptabilite/comptabilite.permissions');
const { emitGatewayEvent } =
    require('../../core/gateway/gateway.emitter');

function supports(logType) {
    return logType === 'withdraw';
}

/**
 * --------------------------------------------------------------------------
 * CONFIG - Règles de catégorisation
 * --------------------------------------------------------------------------
 *
 * Objectif:
 * - Ajout facile d'une entreprise: ajouter une entrée dans COMPANY_BILL_RULES.
 * - Catégorie déterminée de façon plus propre et maintenable.
 *
 * Notes:
 * - Priorité: facture (si match) -> règles par reason -> fallback defaultCategory.
 * - Les match sur companyName sont normalisés (lowercase + underscores + trim).
 */

function normalizeCompanyName(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

/**
 * --------------------------------------------------------------------------
 * CONFIG - Règles de catégorisation (par companyId uniquement)
 * --------------------------------------------------------------------------
 *
 * Pour ajouter une entreprise:
 * - Ajouter son ID dans companyIds
 */
const COMPANY_BILL_RULES = [
    {
        /* ex: 10, 12 */
        companyIds: [1],
        category: TransactionCategoryName.AVOCATS,
    },
    {
        /* ex: 21 */
        companyIds: [5,7,6],
        category: TransactionCategoryName.FRAIS_VEHICULES,
    },
    {
        /* ex: 33 */
        companyIds: [3,11,8],
        category: TransactionCategoryName.NOURRITURE,
    }
];

/**
 * Règles génériques (hors facture), basées sur le champ reason
 */
const REASON_RULES = [
    {
        match: (reason) => reason.includes('Paye ponctuelle de membre'),
        category: TransactionCategoryName.SALAIRES,
    },
    {
        match: (reason) => reason.includes('Paiement loyer'),
        category: TransactionCategoryName.LOCATIONS_NON_DEDUC,
    },
    {
        match: (reason) => reason.startsWith('Transfert') && reason.endsWith('-> N°6087'),
        category: TransactionCategoryName.IMPOTS,
    },
    {
        match: (reason) => reason === 'Achat tenue',
        category: TransactionCategoryName.AUTRES_NON_DEDUC,
    },
    {
        match: (reason) => reason === 'Achat essence',
        category: TransactionCategoryName.FRAIS_VEHICULES,
    },
];

function resolveCategoryNameForBillCompany(company) {
    const cid = Number(company?.id);
    const cname = normalizeCompanyName(company?.name);

    for (const rule of COMPANY_BILL_RULES) {
        const ids = Array.isArray(rule.companyIds) ? rule.companyIds : [];
        const names = Array.isArray(rule.companyNames) ? rule.companyNames : [];

        const matchId = cid && ids.includes(cid);
        const matchName = cname && names.map(normalizeCompanyName).includes(cname);

        if (matchId || matchName) return rule.category;
    }

    return null;
}

function resolveCategoryNameForBillCompanyId(companyId) {
    const cid = Number(companyId);
    if (!cid) return null;

    for (const rule of COMPANY_BILL_RULES) {
        const ids = Array.isArray(rule.companyIds) ? rule.companyIds : [];
        if (ids.includes(cid)) return rule.category;
    }

    return null;
}

async function handle(log) {
    let logData;
    try {
        logData = JSON.parse(log.data);
    } catch (error) {
        console.error(`Erreur de parsing JSON pour le log ID ${log.id}:`, log.data);
        throw new Error("Impossible de parser les données du log, le format JSON est invalide.");
    }

    const amount = logData.amount ?? 0;
    const reason = String(logData.reason ?? 'Raison non spécifiée');

    // Mise à jour du nom si disponible (best-effort)
    const withdrawCharacterId = logData.characterId ? Number(logData.characterId) : null;
    const withdrawDiscordId = logData.discord ? String(logData.discord) : null;
    const withdrawProperName = (logData.properName || '').toString().trim() || null;
    if (withdrawProperName && (withdrawCharacterId || withdrawDiscordId)) {
        try {
            let u = null;
            if (withdrawCharacterId && withdrawDiscordId) u = await prisma.user.findUnique({ where: { UniqueDiscordCharacter: { discordId: withdrawDiscordId, characterId: withdrawCharacterId } } });
            else if (withdrawCharacterId) u = await prisma.user.findFirst({ where: { characterId: withdrawCharacterId } });
            else u = await prisma.user.findFirst({ where: { discordId: withdrawDiscordId } });
            if (u && withdrawProperName !== (u.name || '').trim()) {
                await prisma.user.update({ where: { id: u.id }, data: { name: withdrawProperName } });
            }
        } catch (_) {}
    }

    const balanceBeforeFromGame = logData.before;
    const balanceAfterFromGame = logData.after;

    // Charge les catégories de dépense (1 requête)
    const expenseCategories = await prisma.transactionCategory.findMany({
        where: { type: TransactionType.EXPENSE },
    });

    const findCategory = (name) =>
        expenseCategories.find((c) => String(c.name).toUpperCase() === String(name).toUpperCase());

    const defaultCategory = findCategory(TransactionCategoryName.MATIERES_PREMIERES);

    if (!defaultCategory) {
        throw new Error(`Catégorie par défaut "${TransactionCategoryName.MATIERES_PREMIERES}" non trouvée.`);
    }

    let category = defaultCategory;
    let description = reason;

    // --- 1) Facture ---
    const factureMatch = reason.match(/Paiement facture (\d+)/);
    if (factureMatch) {
        const billId = parseInt(factureMatch[1], 10);

        const bill = await prisma.bill.findFirst({
            where: { externalBillId: billId, companyId: log.companyId },
            include: { company: true },
        });

        if (bill) {
            description = `Paiement facture #${billId}: ${bill.reason} (${bill.company?.name || 'Entreprise inconnue'})`;

            // ============================
            // ADD: routage auto de la company cible si facture compta parent
            // ============================
            if (bill.isParentBill && !bill.accountingTargetCompanyId) {
                try {
                    await prisma.bill.update({
                        where: { externalBillId: billId },
                        data: { accountingTargetCompanyId: log.companyId },
                    });
                } catch (err) {
                    // best effort: on ne casse pas le withdraw si ça échoue
                    console.error(
                        `[withdraw] update accountingTargetCompanyId failed for Bill #${billId}:`,
                        err
                    );
                }
            }
            // ============================

            const categoryName = resolveCategoryNameForBillCompanyId(bill.companyId);
            category = (categoryName && findCategory(categoryName)) || defaultCategory;
        } else {
            category = defaultCategory;
        }
    } else {
        // --- 2) Règles par reason (hors facture) ---
        const matchedRule = REASON_RULES.find((r) => {
            try {
                return r.match(reason);
            } catch {
                return false;
            }
        });

        if (matchedRule?.category) {
            category = findCategory(matchedRule.category) || defaultCategory;
        } else {
            // --- 3) Fallback ---
            category = defaultCategory;
        }
    }

    // Safety
    if (!category?.id) {
        category = defaultCategory;
    }

    const { newTransaction } = await prisma.$transaction(async (tx) => {
        const createdTx = await tx.transaction.create({
            data: {
                date: new Date(parseInt(log.date, 10)),
                amount: amount,
                description: description,
                companyId: log.companyId,
                categoryId: category.id,
                balanceBefore: balanceBeforeFromGame,
                balanceAfter: balanceAfterFromGame,
            },
            include: { category: true },
        });

        await tx.company.update({
            where: { id: log.companyId },
            data: { balance: balanceAfterFromGame },
        });

        return { newTransaction: createdTx };
    });

    if (newTransaction) {
        try {
            const userIds = await getUserIdsByPermissionsCached(
                PERMISSIONS.TRANSACTIONS_VIEW,
                log.companyId
            );

            const payload = {
                id: newTransaction.id,
                date: newTransaction.date,
                description: newTransaction.description,
                amount: newTransaction.amount,
                category: {
                    id: newTransaction.category.id,
                    name: newTransaction.category.name,
                    type: newTransaction.category.type,
                },
                companyId: log.companyId,
            };

            emitGatewayEvent({
                scope: 'USER',
                targets: userIds,
                event: 'TRANSACTION_CREATED',
                payload,
            });
        } catch (err) {
            console.error('[WS][TRANSACTION_CREATED] Dispatch failed:', err);
        }
    }

    if (newTransaction) {
        try {
            const userIds = await getUserIdsByPermissionsCached(
                PERMISSIONS.VIEW_BALANCE,
                log.companyId
            );

            // "Retourne seulement le nouveau solde"
            const payload = {
                companyId: log.companyId,
                balanceAfterFromGame: balanceAfterFromGame,
            };

            emitGatewayEvent({
                scope: 'USER',
                targets: userIds,
                event: 'COMPANY_BALANCE_UPDATE',
                payload,
            });
        } catch (err) {
            console.error('[WS][COMPANY_BALANCE_UPDATE] Dispatch failed:', err);
        }
    }
}

module.exports = {
    supports,
    handle,
};