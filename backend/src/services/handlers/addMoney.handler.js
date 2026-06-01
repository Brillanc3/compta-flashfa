// backend/src/services/handlers/addMoney.handler.js

const prisma = require('../../db');
const { TransactionCategoryName, CompanyEmployeeStatus, UserStatus } = require('@prisma/client');
const { getUserIdsByPermissionsCached } =
    require('../../lib/permissions/getUserIdsByPermissions.cached');
const { PERMISSIONS } =
    require('../../modules/comptabilite/comptabilite.permissions');
const { emitGatewayEvent } =
    require('../../core/gateway/gateway.emitter');

function supports(logType) {
    return logType === 'addmoney';
}

/**
 * BOX filter (ciblé) : évite ensure sur toutes les transactions.
 * Cas confirmé : "Redistribution N°42045"
 */
function isBoxAddMoney(logData) {
    const reason = (logData?.reason ?? '').toString().toLowerCase().trim();

    const redistributionMatch =
        /^redistribution\b/.test(reason) ||
        /redistribution\s*(n|n°|no|#)\s*\d+/i.test(reason);

    if (!redistributionMatch) return false;

    // On exige une identité pour éviter les faux positifs
    return !!(logData?.characterId || logData?.discord || logData?.discordId || logData?.properName);
}

function extractIdentity(logData) {
    const characterIdRaw =
        logData.characterId ?? logData.characterID ?? logData.charId ?? logData.charID ?? null;

    const discordRaw =
        logData.discord ?? logData.discordId ?? logData.discordID ?? null;

    const characterId =
        characterIdRaw !== null && characterIdRaw !== undefined && characterIdRaw !== ''
            ? Number.parseInt(characterIdRaw, 10)
            : null;

    const discordId =
        discordRaw !== null && discordRaw !== undefined && discordRaw !== ''
            ? discordRaw.toString()
            : null;

    const properName =
        (logData.properName ?? logData.name ?? logData.playerName ?? '').toString().trim() || null;

    return { characterId, discordId, properName };
}

/**
 * Normalise seulement pour matcher "Réception" / "Reception" proprement.
 * On garde les symboles (°/º) pour matcher N° / Nº.
 */
function normalizeReason(str) {
    return (str ?? '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // retire accents
        .trim();
}

/**
 * IMPORTANT (demandé) : ne matcher QUE ces 2 formats.
 * 1) "Paiement facture 1318264" (exact, rien après)
 * 2) "Réception facture N°1631018" (peut être seul OU suivi de " : ...")
 */
function extractBillInfoFromReason(reason) {
    const r = normalizeReason(reason);

    // 1) Paiement facture [N°] <id> (fin de string)
    //    Accepte: "Paiement facture 1732738" ET "Paiement facture N°1732738"
    let m = r.match(/^Paiement\s+facture\s+(?:N[°º]|No|#)?\s*(\d+)\s*$/i);
    if (m && m[1]) {
        return { externalBillId: Number.parseInt(m[1], 10), kind: 'PAYMENT' };
    }

    // 2) Réception facture N°<id> [ : ... ] (suffix optionnel)
    m = r.match(/^Reception\s+facture\s+N[°º]\s*(\d+)(?:\s*:\s*(.+))?\s*$/i);
    if (m && m[1]) {
        return { externalBillId: Number.parseInt(m[1], 10), kind: 'RECEPTION' };
    }

    return { externalBillId: null, kind: null };
}

/**
 * Company config (optionnel) : permet de renommer la description selon une config JSON,
 * sans casser si absent.
 *
 * Exemple (dans Company.pendingChanges):
 * {
 *   "comptabilite": {
 *     "transactionDescriptionOverrides": [
 *       { "match": "regex", "pattern": "^Redistribution", "description": "Redistribution (Box)" }
 *     ]
 *   }
 * }
 */
function parseCompanyConfig(company) {
    if (!company?.pendingChanges) return null;
    try {
        return JSON.parse(company.pendingChanges);
    } catch (_) {
        return null;
    }
}

function applyCompanyTransactionNaming({ company, baseDescription, reason, bill, externalBillId }) {
    const cfg = parseCompanyConfig(company);
    const overrides = cfg?.comptabilite?.transactionDescriptionOverrides;
    if (!Array.isArray(overrides) || overrides.length === 0) return baseDescription;

    const rawReason = (reason ?? '').toString();

    const interpolate = (tpl) => {
        const safe = (v) => (v === null || v === undefined) ? '' : String(v);
        return String(tpl)
            .replaceAll('{reason}', safe(rawReason))
            .replaceAll('{externalBillId}', safe(externalBillId))
            .replaceAll('{billReason}', safe(bill?.reason))
            .replaceAll('{companyName}', safe(company?.name));
    };

    for (const rule of overrides) {
        const matchType = rule?.match;
        const pattern = rule?.pattern;
        const description = rule?.description;

        if (!matchType || !pattern || !description) continue;

        try {
            if (matchType === 'equals') {
                if (rawReason === pattern) return interpolate(description);
            } else if (matchType === 'startsWith') {
                if (rawReason.startsWith(pattern)) return interpolate(description);
            } else if (matchType === 'regex') {
                const re = new RegExp(pattern, 'i');
                if (re.test(rawReason)) return interpolate(description);
            }
        } catch (_) {
            // règle invalide -> ignore
        }
    }

    return baseDescription;
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
 * Crée / relie User + CompanyEmployee (PENDING_LINK).
 * - User unique: UniqueDiscordCharacter(discordId, characterId)
 * - CompanyEmployee unique: (companyId, userId)
 * - P2002 (concurrence) => refetch
 */
async function ensureUserAndEmployment(tx, { companyId, characterId, discordId, properName }) {
    if (!characterId && !discordId) {
        return { user: null, employment: null };
    }

    let user = null;

    // Priorité : unique composite si on a les 2
    if (discordId && characterId) {
        user = await tx.user.findUnique({
            where: { UniqueDiscordCharacter: { discordId, characterId } },
        });
    }

    // Fallback : characterId (priorité non pending) / discord seul
    if (!user && characterId) {
        user = await tx.user.findFirst({
            where: {
                characterId,
                ...(discordId ? { discordId } : {}),
                NOT: { username: { startsWith: `pending_${characterId}` } },
            },
        });

        if (!user) {
            user = await tx.user.findFirst({
                where: { characterId, ...(discordId ? { discordId } : {}) },
            });
        }
    }

    if (!user && discordId) {
        user = await tx.user.findFirst({ where: { discordId } });
    }

    const defaultRank = await ensureDefaultRank(tx, companyId);

    // Création si besoin
    if (!user) {
        try {
            const newEmployee = await tx.companyEmployee.create({
                data: {
                    status: CompanyEmployeeStatus.PENDING_LINK,
                    company: { connect: { id: companyId } },
                    rank: { connect: { id: defaultRank.id } },
                    user: {
                        create: {
                            name: properName || 'Employé inconnu',
                            username: `pending_${characterId || 'unknown'}_${Date.now()}`,
                            password: '',
                            characterId: characterId ?? null,
                            discordId: discordId ?? null,
                            status: UserStatus.PENDING_FINALIZATION,
                        },
                    },
                },
                include: { user: true },
            });

            try {
                await tx.rankHistory.create({
                    data: {
                        companyEmployeeId: newEmployee.id,
                        rankId: defaultRank.id,
                        rankName: defaultRank.name,
                    },
                });
            } catch (_) { /* no-op */ }

            return { user: newEmployee.user, employment: newEmployee };
        } catch (e) {
            if (e.code !== 'P2002') throw e;

            // Refetch après course
            if (discordId && characterId) {
                user = await tx.user.findUnique({
                    where: { UniqueDiscordCharacter: { discordId, characterId } },
                });
            } else if (characterId) {
                user = await tx.user.findFirst({
                    where: { characterId, ...(discordId ? { discordId } : {}) },
                });
            } else if (discordId) {
                user = await tx.user.findFirst({ where: { discordId } });
            }
        }
    }

    if (!user) {
        return { user: null, employment: null };
    }

    // Mise à jour du nom si changé
    if (properName && properName !== (user.name || '').trim()) {
        try {
            user = await tx.user.update({ where: { id: user.id }, data: { name: properName } });
        } catch (_) {}
    }

    // Employment (unique companyId+userId)
    let employment = await tx.companyEmployee.findFirst({
        where: { companyId, userId: user.id },
    });

    if (!employment) {
        try {
            employment = await tx.companyEmployee.create({
                data: {
                    status: CompanyEmployeeStatus.PENDING_LINK,
                    companyId,
                    userId: user.id,
                    rankId: defaultRank.id,
                },
            });

            try {
                await tx.rankHistory.create({
                    data: {
                        companyEmployeeId: employment.id,
                        rankId: defaultRank.id,
                        rankName: defaultRank.name,
                    },
                });
            } catch (_) { /* no-op */ }

        } catch (e) {
            if (e.code !== 'P2002') throw e;

            employment = await tx.companyEmployee.findFirst({
                where: { companyId, userId: user.id },
            });
        }
    }

    return { user, employment };
}

function getRedistributionSettings(context) {
    return context?.companySettings?.boxs?.redistribution ?? null;
}


function extractRedistributionNumberFromContext(reason, context) {
    const cfg = getRedistributionSettings(context);
    const numbers = Array.isArray(cfg?.numbers) ? cfg.numbers : [];
    const prefix = (cfg?.reasonPrefix ?? '').toString();

    const raw = (reason ?? '').toString().trim();

    // 1) Extraction via reasonPrefix si présent (ex: "Redistribution N°")
    if (prefix && raw.toLowerCase().startsWith(prefix.toLowerCase())) {
        const tail = raw.slice(prefix.length).trim();
        const m = tail.match(/^(\d+)/);
        if (m?.[1]) return m[1];
    }

    // 2) Fallback regex générique "Redistribution N°42045"
    const m = raw.match(/redistribution\s*(?:n|n°|no|#)\s*(\d+)/i);
    if (m?.[1]) return m[1];

    // 3) Dernier fallback: si settings ne contient qu’un seul numéro, on le prend
    if (numbers.length === 1) return String(numbers[0]);

    return null;
}


function computeCartonCountFromContext(amount, context) {
    const cfg = getRedistributionSettings(context);
    const boxPriceRaw = cfg?.boxPrice;

    const boxPrice = Number(boxPriceRaw);
    const amt = Number(amount);

    if (!Number.isFinite(boxPrice) || boxPrice <= 0) return 0;
    if (!Number.isFinite(amt) || amt <= 0) return 0;

    const exact = amt / boxPrice;
    const rounded = Math.round(exact);

    // Tolérance float : si c’est “quasi entier”, on arrondit
    if (Math.abs(exact - rounded) < 1e-6) return rounded;

    // Sinon on tronque (évite de sur-compter)
    return Math.trunc(exact);
}

async function handle(log, context) {
    let logData;
    try {
        logData = JSON.parse(log.data);
    } catch (error) {
        throw new Error("Impossible de parser les données du log, le format JSON est invalide.");
    }

    const amount = logData.amount ?? 0;
    const reason = logData.reason ?? 'Raison non spécifiée';
    const balanceBeforeFromGame = logData.before;
    const balanceAfterFromGame = logData.after;

    // (léger) Lecture config company pour naming (optionnel, sans bloquer l’écriture)
    const company = await prisma.company.findUnique({
        where: { id: log.companyId },
        select: { id: true, name: true, pendingChanges: true },
    });

    // Catégories revenue
    const revenueCategories = await prisma.transactionCategory.findMany({ where: { type: 'REVENUE' } });
    const findCategory = (name) => revenueCategories.find(c => c.name === name);
    const defaultCategory = findCategory(TransactionCategoryName.CHIFFRE_AFFAIRES);

    if (!defaultCategory) {
        throw new Error(`Catégorie par défaut "Chiffre d'affaires" non trouvée.`);
    }

    // 1) Déterminer description + billId AVANT le flush final (pas de create puis update)
    let description = reason;
    let billIdToLink = null;
    let bill = null;

    const { externalBillId, kind } = extractBillInfoFromReason(reason);

    if (externalBillId) {
        bill = await prisma.bill.findFirst({ where: { externalBillId, companyId: log.companyId } });

        if (bill) {
            billIdToLink = bill.id;
            if (kind === 'PAYMENT') {
                description = `Paiement facture #${externalBillId}: ${bill.reason}`;
            } else {
                description = reason;
            }
        } else {
            console.warn(`[addmoney] Bill introuvable pour externalBillId=${externalBillId} (reason="${reason}")`);
        }
    }

    // 2) Appliquer éventuellement un naming par config company (si présent)
    description = applyCompanyTransactionNaming({
        company,
        baseDescription: description,
        reason,
        bill,
        externalBillId,
    });

    // 3) Faire la transaction (priorité) + update balance, avec retry P2034
    const maxRetries = 3;
    let newTransaction;

    // Avoid duplicate transaction if billId is already linked
    if (billIdToLink) {
        const existingTx = await prisma.transaction.findUnique({
            where: { billId: billIdToLink }
        });
        if (existingTx) {
            console.warn(`[addmoney] Transaction déjà existante pour billId=${billIdToLink}. Skip creation.`);
            return;
        }
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await prisma.$transaction(async (tx) => {
                const createdTx = await tx.transaction.create({
                    data: {
                        date: new Date(Number.parseInt(log.date, 10)),
                        amount: amount,
                        description: description,
                        companyId: log.companyId,
                        categoryId: defaultCategory.id,
                        billId: billIdToLink, // liaison facture correcte ici (FK côté Transaction)
                        balanceBefore: balanceBeforeFromGame,
                        balanceAfter: balanceAfterFromGame,
                    },
                    include: { category: true },
                });

                await tx.company.update({
                    where: { id: log.companyId },
                    data: { balance: balanceAfterFromGame },
                });

                return createdTx;
            });

            newTransaction = result;
            break;
        } catch (error) {
            if (error.code === 'P2034' && attempt < maxRetries) {
                console.warn(`[AddMoneyHandler] Conflit de transaction (tentative ${attempt}/${maxRetries})... Réessai.`);
                await new Promise(res => setTimeout(res, 50 * attempt));
            } else {
                throw error;
            }
        }
    }

    // 4) WS event TRANSACTION_CREATED (inchangé)
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

    // 5) Ajouter la box (post-traitement) : vérifier/créer l’utilisateur correctement
    //    => seulement si "Redistribution ..." (pas d’ensure pour toutes les transactions)
    try {
        if (isBoxAddMoney(logData) && newTransaction?.id) {
            const identity = extractIdentity(logData);

            await prisma.$transaction(async (tx) => {
                const { employment } = await ensureUserAndEmployment(tx, {
                    companyId: log.companyId,
                    characterId: identity.characterId,
                    discordId: identity.discordId,
                    properName: identity.properName,
                });

                // Si on ne peut pas associer l'employé, on ne crée pas de CartonSale
                if (!employment?.id) return;

                const redistributionNumber = extractRedistributionNumberFromContext(reason, context);
                const cartonCount = computeCartonCountFromContext(amount, context);

                // transactionId est @unique dans CartonSale -> rendre idempotent si reprocess
                try {
                    await tx.cartonSale.create({
                        data: {
                            occurredAt: newTransaction.date,
                            companyId: log.companyId,
                            transactionId: newTransaction.id,
                            companyEmployeeId: employment.id,

                            amount: amount,
                            cartonCount,
                            reason: reason ?? null,
                            redistributionNumber,
                        },
                    });
                } catch (e) {
                    // P2002 = unique violation (transactionId déjà utilisé) => ignore (idempotence)
                    if (e?.code !== 'P2002') throw e;
                }
            });
        }
    } catch (e) {
        // Important : ne jamais impacter l'écriture comptable déjà faite
        console.error('[addmoney][post-box-ensure] failed:', e);
    }
}

module.exports = { supports, handle };
