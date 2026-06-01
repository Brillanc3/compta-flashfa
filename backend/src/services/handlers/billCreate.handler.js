// backend/src/services/handlers/billCreate.handler.js

const prisma = require('../../db');
const { CompanyEmployeeStatus, UserStatus } = require('@prisma/client');
const { addDays } = require('date-fns');

// Live WS (même pattern que addMoney)
const { getUserIdsByPermissionsCached } =
    require('../../lib/permissions/getUserIdsByPermissions.cached');
const { PERMISSIONS } =
    require('../../modules/comptabilite/comptabilite.permissions');
const { emitGatewayEvent } =
    require('../../core/gateway/gateway.emitter');

/**
 * Indique si ce handler peut traiter les logs de création de facture.
 * @param {string} logType
 * @returns {boolean}
 */
function supports(logType) {
    return logType === 'create';
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
 * Règle demandée:
 * - user.username commence par "pending_" => CompanyEmployee PENDING_LINK
 * - user.username ne commence pas par "pending_" ET user.status ACTIVE => CompanyEmployee ACTIVE
 * - sinon => PENDING_LINK
 */
function resolveCompanyEmployeeStatusFromUser(user) {
    const username = (user?.username || '').toString();
    if (username.startsWith('pending_')) {
        return CompanyEmployeeStatus.PENDING_LINK;
    }

    if (user?.status === UserStatus.ACTIVE) {
        return CompanyEmployeeStatus.ACTIVE;
    }

    return CompanyEmployeeStatus.PENDING_LINK;
}

async function ensureDefaultRank(tx, companyId) {
    let defaultRank = await tx.rank.findFirst({
        where: { companyId },
        orderBy: { position: 'asc' },
    });

    if (!defaultRank) {
        console.log(
            `[billCreate] Aucun rang trouvé pour company #${companyId}, création du rang "Recrue".`
        );
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
 * Gère la création d'une facture à partir d'un log.
 * - Crée un utilisateur "pending" si nécessaire
 * - Crée/récupère un CompanyEmployee lié à la société avec rang par défaut
 * - Applique la règle de statut CompanyEmployee (pending_/ACTIVE)
 * - Crée le client (upsert)
 * - Crée la facture
 * - Crée le partage par défaut (100% sur le créateur)
 * - Diffuse la facture en direct (WS) via BILL_CREATED
 *
 * ADD (facture compta parent):
 * - Si issuer company isParentCompany=true ET destinataire résolu via (toDiscord, characterIdTo),
 *   alors isParentBill=true + recipientDiscordId/recipientCharacterId + accountingDueAt=(date+3j)
 *   + notification BLOCKING "facture émise" vers le user destinataire
 * - Si user destinataire introuvable => facture simple (ne rien faire)
 */
async function handle(log) {
    let createdBill = null;

    // ADD: tracking notif (créée dans la transaction, émise en WS après)
    let createdNotification = null;
    let createdRecipient = null;
    let notifiedUserId = null;
    let issuedContent = null;

    try {
        let logData;

        try {
            logData = JSON.parse(log.data);
        } catch (error) {
            throw new Error(`[billCreate] Erreur JSON pour le log ID ${log.id}: ${error.message}`);
        }

        const companyId = log.companyId;
        const dateRaw = log.date;

        const billId = parseIntOrNull(logData.billId);
        const fromPropername = (logData.fromPropername || '').toString().trim();
        const toPropername = (logData.toPropername || '').toString().trim();

        // ADD: destinataire (strict)
        const toDiscord = logData.toDiscord ? logData.toDiscord.toString() : null;
        const characterIdTo = parseIntOrNull(logData.characterIdTo);
        const groupIdTo = parseIntOrNull(logData.groupIdTo);

        const amount = logData.amount; // number/string acceptable selon ton pipeline
        const reason = (logData.reason || '').toString();

        const discordId = logData.fromDiscord ? logData.fromDiscord.toString() : null;
        const characterId = parseIntOrNull(logData.characterIdFrom);

        // Vérification données minimales
        if (!billId || !fromPropername || (!toPropername && !groupIdTo) || amount === null || amount === undefined || amount === '') {
            throw new Error(`[billCreate] Données manquantes (Log ID: ${log.id})`);
        }

        const date = new Date(Number.parseInt(String(dateRaw), 10));

        await prisma.$transaction(async (tx) => {
            // ============================
            // ADD: determine isParentBill (sans supposition)
            // ============================
            const issuerCompany = await tx.company.findUnique({
                where: { id: companyId },
                select: { isParentCompany: true },
            });

            let isParentBill = false;
            let recipientDiscordId = null;
            let recipientCharacterId = null;
            let accountingDueAt = null;

            let accountingTargetCompanyId = null;

            // On conserve l'user id destinataire (si résolu) pour notifier
            let recipientUserId = null;

            if (issuerCompany?.isParentCompany && toDiscord && characterIdTo) {
                const recipientUser = await tx.user.findUnique({
                    where: {
                        UniqueDiscordCharacter: {
                            discordId: toDiscord,
                            characterId: characterIdTo,
                        },
                    },
                    select: { id: true, name: true },
                });

                // Décision actée: si user introuvable => facture simple (ne rien faire)
                if (recipientUser) {
                    recipientUserId = recipientUser.id;

                    // Mise à jour du nom du destinataire si changé
                    if (toPropername && toPropername !== (recipientUser.name || '').trim()) {
                        try {
                            await tx.user.update({ where: { id: recipientUser.id }, data: { name: toPropername } });
                        } catch (_) { }
                    }
                    isParentBill = true;
                    recipientDiscordId = toDiscord;
                    recipientCharacterId = characterIdTo;
                    accountingDueAt = addDays(date, 3);

                    // Détermination de l'entreprise cible via le contact facturable (règle: 1 user => 1 entreprise facturable)
                    try {
                        const bc = await tx.billableContact.findUnique({
                            where: { userId: recipientUserId },
                            select: { companyId: true },
                        });
                        accountingTargetCompanyId = bc?.companyId ?? null;
                    } catch (e) {
                        // best effort: ne bloque pas la création de facture si le routing n'est pas déterminable
                        console.warn('[billCreate] Impossible de déterminer accountingTargetCompanyId via BillableContact:', e?.message);
                        accountingTargetCompanyId = null;
                    }
                }
            }
            // ============================

            // 1) Trouver l'auteur (si possible)
            let existingUser = null;

            // UniqueDiscordCharacter si dispo (meilleur chemin)
            if (discordId && characterId) {
                existingUser = await tx.user.findUnique({
                    where: {
                        UniqueDiscordCharacter: {
                            discordId,
                            characterId,
                        },
                    },
                });
            }

            let author = null;
            let authorEmployee = null;

            // 2) Gestion user + employee
            if (existingUser) {
                author = existingUser;

                // Mise à jour du nom de l'émetteur si changé
                if (fromPropername && fromPropername !== (author.name || '').trim()) {
                    try {
                        author = await tx.user.update({ where: { id: author.id }, data: { name: fromPropername } });
                    } catch (_) { }
                }

                const desiredEmployeeStatus = resolveCompanyEmployeeStatusFromUser(author);

                const existingEmployee = await tx.companyEmployee.findFirst({
                    where: { userId: author.id, companyId },
                });

                if (existingEmployee) {
                    authorEmployee = existingEmployee;

                    // Mise à jour progressive du status de l'employé (si besoin)
                    if (authorEmployee.status !== desiredEmployeeStatus) {
                        authorEmployee = await tx.companyEmployee.update({
                            where: { id: authorEmployee.id },
                            data: { status: desiredEmployeeStatus },
                        });
                    }
                } else {
                    const defaultRank = await ensureDefaultRank(tx, companyId);

                    authorEmployee = await tx.companyEmployee.create({
                        data: {
                            status: desiredEmployeeStatus,
                            company: { connect: { id: companyId } },
                            rank: { connect: { id: defaultRank.id } },
                            user: { connect: { id: author.id } },
                        },
                    });

                    console.log(
                        `[billCreate] Utilisateur existant lié à la company #${companyId} avec le rang "${defaultRank.name}".`
                    );
                }
            } else {
                // Création pending
                const defaultRank = await ensureDefaultRank(tx, companyId);

                const newEmployee = await tx.companyEmployee.create({
                    data: {
                        status: CompanyEmployeeStatus.PENDING_LINK,
                        company: { connect: { id: companyId } },
                        rank: { connect: { id: defaultRank.id } },
                        user: {
                            create: {
                                name: fromPropername,
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

                author = newEmployee.user;
                authorEmployee = { id: newEmployee.id, status: newEmployee.status };
                console.log(`[billCreate] Nouvel utilisateur créé: ${author.name} (#${author.id}).`);
            }

            if (!authorEmployee?.id) {
                throw new Error(
                    `[billCreate] Impossible de résoudre CompanyEmployee pour authorId=${author?.id} (Log ID: ${log.id}).`
                );
            }

            // 3) Client upsert / merge
            let client = null;

            // Cas entreprise : groupIdTo présent → client fantôme lié à une company
            if (groupIdTo) {
                const targetCompany = await tx.company.findUnique({
                    where: { groupId: groupIdTo },
                    select: { id: true, name: true },
                });

                if (targetCompany) {
                    // Cherche un client fantôme existant pour cette company dans la companyId émettrice
                    const existingPhantom = await tx.client.findFirst({
                        where: { companyId, linkedCompanyGroupId: groupIdTo },
                        orderBy: { id: 'asc' },
                    });

                    if (existingPhantom) {
                        // Mise à jour snapshot si le nom a changé
                        if (existingPhantom.linkedCompanyNameSnapshot !== targetCompany.name) {
                            client = await tx.client.update({
                                where: { id: existingPhantom.id },
                                data: {
                                    name: targetCompany.name,
                                    nameSearchable: `${targetCompany.name} ${groupIdTo}`,
                                    linkedCompanyNameSnapshot: targetCompany.name,
                                },
                            });
                        } else {
                            client = existingPhantom;
                        }
                    } else {
                        // Création du client fantôme (name unique dans la company — on préfixe si conflit)
                        try {
                            client = await tx.client.create({
                                data: {
                                    name: targetCompany.name,
                                    nameSearchable: `${targetCompany.name} ${groupIdTo}`,
                                    companyId,
                                    kind: 'COMPANY',
                                    linkedCompanyGroupId: groupIdTo,
                                    linkedCompanyNameSnapshot: targetCompany.name,
                                },
                            });
                        } catch (e) {
                            if (e?.code === 'P2002') {
                                // Conflit de nom : on suffixe avec le groupId
                                client = await tx.client.create({
                                    data: {
                                        name: `${targetCompany.name} (${groupIdTo})`,
                                        nameSearchable: `${targetCompany.name} ${groupIdTo}`,
                                        companyId,
                                        kind: 'COMPANY',
                                        linkedCompanyGroupId: groupIdTo,
                                        linkedCompanyNameSnapshot: targetCompany.name,
                                    },
                                });
                            } else {
                                throw e;
                            }
                        }
                        console.log(`[billCreate] Client fantôme créé pour company "${targetCompany.name}" (groupId=${groupIdTo}).`);
                    }
                } else {
                    // Company inconnue → client reste null, facture avec clientId=null
                    console.warn(`[billCreate] groupIdTo=${groupIdTo} introuvable — facture sans client.`);
                }
            }

            // Résolution client personne physique (seulement si pas de groupIdTo)
            if (!groupIdTo) {

                // Priority 1: characterId (plus fiable)
                if (characterIdTo) {
                    client = await tx.client.findFirst({
                        where: { companyId, characterId: characterIdTo },
                        orderBy: { id: 'asc' },
                    });
                }

                // Priority 2: discordId
                if (!client && toDiscord) {
                    client = await tx.client.findFirst({
                        where: { companyId, discordId: toDiscord },
                        orderBy: { id: 'asc' },
                    });
                }

                if (client) {
                    try {
                        client = await tx.client.update({
                            where: { id: client.id },
                            data: {
                                name: toPropername,
                                characterId: characterIdTo ?? client.characterId,
                                discordId: toDiscord ?? client.discordId,
                            },
                        });
                    } catch (e) {
                        if (e?.code === 'P2002') {
                            // Conflit de nom: un autre client dans la même company a déjà ce properName.
                            // Fusion: migrer toutes les relations du doublon vers l'actuel, supprimer le doublon, puis renommer.
                            const conflictClient = await tx.client.findUnique({
                                where: { name_companyId: { name: toPropername, companyId } },
                            });

                            if (conflictClient) {
                                await tx.bill.updateMany({ where: { clientId: conflictClient.id }, data: { clientId: client.id } });
                                await tx.fidelityCard.updateMany({ where: { clientId: conflictClient.id }, data: { clientId: client.id } });
                                await tx.pawnshopPurchase.updateMany({ where: { clientId: conflictClient.id }, data: { clientId: client.id } });

                                const existingVarIds = (await tx.clientVariableValue.findMany({
                                    where: { clientId: client.id },
                                    select: { variableId: true },
                                })).map(v => v.variableId);
                                if (existingVarIds.length > 0) {
                                    await tx.clientVariableValue.deleteMany({
                                        where: { clientId: conflictClient.id, variableId: { in: existingVarIds } },
                                    });
                                }
                                await tx.clientVariableValue.updateMany({
                                    where: { clientId: conflictClient.id },
                                    data: { clientId: client.id },
                                });

                                await tx.client.delete({ where: { id: conflictClient.id } });

                                client = await tx.client.update({
                                    where: { id: client.id },
                                    data: {
                                        name: toPropername,
                                        characterId: characterIdTo ?? client.characterId,
                                        discordId: toDiscord ?? client.discordId,
                                    },
                                });
                                console.log(`[billCreate] Fusion clients: "${conflictClient.name}" (#${conflictClient.id}) → "${toPropername}" (#${client.id})`);
                            } else {
                                client = await tx.client.update({
                                    where: { id: client.id },
                                    data: {
                                        characterId: characterIdTo ?? client.characterId,
                                        discordId: toDiscord ?? client.discordId,
                                    },
                                });
                            }
                        } else {
                            throw e;
                        }
                    }
                } else {
                    // Priority 3: exact name
                    const existingByName = await tx.client.findUnique({
                        where: { name_companyId: { name: toPropername, companyId } },
                    });

                    if (existingByName) {
                        client = await tx.client.update({
                            where: { id: existingByName.id },
                            data: {
                                characterId: characterIdTo ?? existingByName.characterId,
                                discordId: toDiscord ?? existingByName.discordId,
                            },
                        });
                    } else {
                        client = await tx.client.create({
                            data: {
                                name: toPropername,
                                companyId,
                                characterId: characterIdTo,
                                discordId: toDiscord,
                            },
                        });
                    }
                }

                // ============================
                // ADD: Tentative de fusion Client ↔ User
                // Si le client a un characterId (et optionnellement discordId) qui correspondent
                // à un user existant, on relie le client à ce user (userId).
                // ============================
                if (!client.userId && characterIdTo) {
                    try {
                        // Recherche par characterId seul (obligatoire), discordId optionnel
                        const linkedUser = toDiscord
                            ? await tx.user.findUnique({
                                where: {
                                    UniqueDiscordCharacter: {
                                        discordId: toDiscord,
                                        characterId: characterIdTo,
                                    },
                                },
                                select: { id: true },
                            })
                            : await tx.user.findFirst({
                                where: { characterId: characterIdTo },
                                select: { id: true },
                            });

                        if (linkedUser) {
                            client = await tx.client.update({
                                where: { id: client.id },
                                data: { userId: linkedUser.id },
                            });
                            console.log(
                                `[billCreate] Client #${client.id} (${toPropername}) fusionné avec User #${linkedUser.id}.`
                            );
                        }
                    } catch (e) {
                        // Best-effort : ne bloque pas la création de facture
                        console.warn('[billCreate] Tentative de fusion client↔user échouée (ignorée):', e?.message);
                    }
                }
                // ============================

            } // fin if (!groupIdTo)

            // 4) Vérification d'existence (évite les logs d'erreur Prisma bruyants en cas de doublon)
            const existingBill = await tx.bill.findFirst({
                where: { externalBillId: billId, companyId },
            });

            if (existingBill) {
                console.warn(`[billCreate] Facture déjà existante (externalBillId: ${billId}). Skipping creation.`);
                return;
            }

            // 5) Création de la facture (avec share par défaut: 100% créateur)
            createdBill = await tx.bill.create({
                data: {
                    externalBillId: billId,
                    issuerName: fromPropername,
                    recipientName: toPropername,
                    reason,
                    amount,
                    companyId,
                    clientId: client?.id ?? null,
                    date,
                    authorId: author.id,

                    // Nouveau champ nullable => on le renseigne dès maintenant
                    authorCompanyEmployeeId: authorEmployee.id,

                    // ADD: champs compta parent
                    isParentBill,
                    recipientDiscordId,
                    recipientCharacterId,
                    accountingDueAt,


                    accountingTargetCompanyId: isParentBill ? accountingTargetCompanyId : null,
                    accountingNotifyUserId: isParentBill ? recipientUserId : null,
                    accountingIssuedNotifiedAt: isParentBill ? new Date() : null,

                    // Partage par défaut => 100% sur le créateur uniquement
                    shares: {
                        create: {
                            companyEmployeeId: authorEmployee.id,
                            percentage: 100,
                        },
                    },
                },
                include: {
                    author: true,
                    client: true,
                    canceledBy: true,
                    shares: true,
                    authorCompanyEmployee: true,
                },
            });

            console.log(
                `[billCreate] Facture ${billId} créée + share default 100% (employeeId=${authorEmployee.id}) pour ${toPropername} par ${fromPropername}.`
            );

            // =========================================================
            // ADD: NOTIFICATION "Facture émise" (BLOCKING) si facture parent
            // =========================================================
            if (isParentBill && recipientUserId && accountingDueAt) {
                const amountNum = Number(amount) || 0;
                const dueStr = new Date(accountingDueAt).toLocaleString('fr-FR');

                issuedContent = {
                    kind: 'ACCOUNTING_BILL_ISSUED',
                    title: `Facture émise #${billId}`,
                    body:
                        `Une facture de USD ${amountNum.toFixed(2)} a été émise.\n` +
                        `Paiement requis sous 3 jours (avant le ${dueStr}).\n` +
                        `Des frais peuvent être ajoutés en cas de non paiement.`,
                    billExternalId: billId,
                    amount: amountNum,
                    currency: 'USD',
                    dueAt: accountingDueAt, // JSON.stringify => ISO string
                };

                createdNotification = await tx.notification.create({
                    data: {
                        content: JSON.stringify(issuedContent),
                        type: 'USER_SPECIFIC',
                        behavior: 'BLOCKING',
                        senderId: null, // log-driven
                    },
                });

                createdRecipient = await tx.notificationRecipient.create({
                    data: {
                        notificationId: createdNotification.id,
                        userId: recipientUserId,
                    },
                });

                notifiedUserId = recipientUserId;
            }
            // =========================================================
        });

        console.log(`[billCreate] Traitement du log #${log.id} terminé avec succès.`);

        // =========================================================
        // ADD: WS — NOTIFICATION_CREATED (si notif créée)
        // =========================================================
        if (createdNotification && createdRecipient && notifiedUserId && issuedContent) {
            try {
                emitGatewayEvent({
                    scope: 'USER',
                    targets: [notifiedUserId],
                    event: 'NOTIFICATION_CREATED',
                    payload: {
                        notificationId: createdNotification.id,
                        recipients: [{ id: createdRecipient.id, userId: notifiedUserId }],
                        content: issuedContent,
                        behavior: 'BLOCKING',
                        createdAt: createdNotification.createdAt,
                    },
                });
            } catch (err) {
                console.error('[WS][NOTIFICATION_CREATED] Dispatch failed:', err);
            }
        }
        // =========================================================

        // ===========================
        // WS — BILL_CREATED
        // ===========================
        if (createdBill) {
            try {
                const perm = resolveBillsViewPermission();
                const userIds = await getUserIdsByPermissionsCached(perm, companyId);

                emitGatewayEvent({
                    scope: 'USER',
                    targets: userIds,
                    event: 'BILL_CREATED',
                    payload: {
                        companyId,
                        bill: createdBill,
                    },
                });
            } catch (err) {
                console.error('[WS][BILL_CREATED] Dispatch failed:', err);
            }
        }
    } catch (error) {
        // Unique constraint (externalBillId @unique)
        if (error?.code === 'P2002') {
            console.warn(
                `[billCreate] Facture déjà existante (externalBillId: ${(() => {
                    try {
                        const d = JSON.parse(log.data);
                        return d.billId ?? 'unknown';
                    } catch {
                        return 'unknown';
                    }
                })()
                })`
            );
            return;
        }

        console.error('[billCreate] Erreur critique:', error);
        throw error;
    }
}

module.exports = {
    supports,
    handle,
};