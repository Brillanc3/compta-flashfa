// backend/src/modules/admin/admin.service.js

const prisma = require('../../db');
const { addDays, startOfWeek, endOfWeek, startOfDay, endOfDay } = require('date-fns');
const { createNotification } = require('../notifications/notifications.service');
const { emitGatewayEvent } = require('../../core/gateway/gateway.emitter');
const crypto = require('crypto');
const eventBus = require('../../lib/eventBusRedis'); // adapte le chemin si nécessaire
const IORedis = require('ioredis');
const imageService = require('../image/image.service');
// const employeesService = require('../employees/employees.service');
// const comptabiliteService = require('../comptabilite/comptabilite.service');
// const clientsService = require('../clients/clients.service');
// On déplace logProcessor dans les fonctions pour éviter les dépendances circulaires
// const logProcessor = require('../../services/logProcessor.service');
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    keyPrefix: process.env.ENV === 'dev' ? 'dev:' : 'prod:'
});

/* =============================================================================
 * Utils génériques
 * ========================================================================== */

/**
 * Génère une nouvelle clé aléatoire en base64url.
 * @param {number} size - taille en octets
 * @returns {string}
 */
function generateKey(size = 32) {
    return crypto.randomBytes(size).toString('base64url');
}



function generate6DigitToken() {
    const n = Math.floor(Math.random() * 1000000);
    return String(n).padStart(6, '0');
}
/**
 * Calcule la semaine ISO + année ISO d'une date.
 * @param {Date} date
 * @returns {{week:number, year:number}}
 */
function isoWeekInfo(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum); // jeudi ISO
    const year = d.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { week, year };
}

/**
 * Calcule la fenêtre de la semaine ISO sur [start, end).
 * @param {number} week - Semaine ISO (1–53)
 * @param {number} year - Année
 * @returns {{ start: Date, end: Date }}
 */
function getWeekRange(week, year) {
    // Trouve le jeudi de la semaine demandée (ISO)
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const dow = simple.getUTCDay();
    const ISOThursday = new Date(simple);
    ISOThursday.setUTCDate(simple.getUTCDate() + (dow <= 4 ? 4 - dow : 11 - dow));

    const start = new Date(ISOThursday);
    start.setUTCDate(ISOThursday.getUTCDate() - 3); // Lundi

    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7); // Lundi suivant (exclu)

    return { start, end };
}

/**
 * Normalise les paramètres semaine/année.
 * - Accepte (week, year) OU ({week, year})
 * - Fallback sur la semaine/année ISO courante si absent/invalides
 *
 * @param {number|object} weekArg
 * @param {number} [yearArg]
 * @returns {{week:number, year:number}}
 */
function normalizeWeekYear(weekArg, yearArg) {
    let week, year;
    if (weekArg && typeof weekArg === 'object') {
        week = Number(weekArg.week);
        year = Number(weekArg.year);
    } else {
        week = Number(weekArg);
        year = Number(yearArg);
    }
    const nowInfo = isoWeekInfo(new Date());
    if (!Number.isFinite(week) || week < 1 || week > 53) week = nowInfo.week;
    if (!Number.isFinite(year)) year = nowInfo.year;
    return { week, year };
}

/**
 * Construit le where Prisma pour Transactions selon les filtres.
 * NB: le modèle Transaction n’a PAS de user; on filtre sur date/description/amount uniquement.
 * @param {{startDate?:Date,endDate?:Date,reason?:string,user?:string,minAmount?:number,maxAmount?:number}} f
 */
function buildTxWhere(f = {}) {
    const where = {};
    if (f.startDate || f.endDate) {
        where.date = {};
        if (f.startDate) where.date.gte = startOfDay(f.startDate);
        if (f.endDate) where.date.lte = endOfDay(f.endDate);
    }
    if (f.reason) where.description = { contains: f.reason };
    if (Number.isFinite(f.minAmount) || Number.isFinite(f.maxAmount)) {
        where.amount = {};
        if (Number.isFinite(f.minAmount)) where.amount.gte = f.minAmount;
        if (Number.isFinite(f.maxAmount)) where.amount.lte = f.maxAmount;
    }
    return where;
}

/**
 * Construit le where Prisma pour Bills selon les filtres.
 * NB: le filtre 'user' s’applique à author.name.
 * @param {{startDate?:Date,endDate?:Date,reason?:string,user?:string,minAmount?:number,maxAmount?:number}} f
 */
function buildBillWhere(f = {}) {
    const where = {};
    if (f.startDate || f.endDate) {
        where.date = {};
        if (f.startDate) where.date.gte = startOfDay(f.startDate);
        if (f.endDate) where.date.lte = endOfDay(f.endDate);
    }
    if (f.reason) where.reason = { contains: f.reason };
    if (Number.isFinite(f.minAmount) || Number.isFinite(f.maxAmount)) {
        where.amount = {};
        if (Number.isFinite(f.minAmount)) where.amount.gte = f.minAmount;
        if (Number.isFinite(f.maxAmount)) where.amount.lte = f.maxAmount;
    }
    if (f.user) {
        // Relation REQUIRED (User author)
        where.author = { name: { contains: f.user } };
    }
    return where;
}

/**
 * Calcule un statut factice lisible (à adapter selon ta logique réelle).
 * @param {number} amount
 * @param {number} week
 * @param {number} year
 * @returns {{ status:'À faire'|'En attente de paiement'|'Payée'|'Impossible', reason?:string, amount:number }}
 */
/**
 * Calcule le statut Support Facturation selon la facture "compta parent" de la semaine.
 *
 * Règles (UI):
 * - Facture à faire
 * - Facture faite -> En attente de paiement
 * - Facture faite -> Temps de paiement dépassé
 * - Facture payé -> Dans les temps
 * - Facture payé -> Mais en retard
 *
 * @param {{ baseAmount:number, bill?:any, now:Date, paidAt?:Date|null }} args
 * @returns {{ status:string, reason?:string, amount:number, billExternalId?:number|null, dueAt?:string|null, paidAt?:string|null }}
 */
function deriveBillingStatus({ baseAmount, bill, now, paidAt }) {
    const amount = bill?.amount != null ? Number(bill.amount) : (Number.isFinite(+baseAmount) ? +baseAmount : 0);
    const billExternalId = bill?.externalBillId ?? null;

    // Pas de facture routée vers cette company pour la période => à faire
    if (!bill) {
        return {
            status: 'Facture à faire',
            reason: 'Aucune facture émise sur la période.',
            amount,
            billExternalId: null,
            dueAt: null,
            paidAt: null,
        };
    }

    console.log("bill", bill);
    console.log("paidAt", paidAt);

    const dueAt = bill.accountingDueAt ? new Date(bill.accountingDueAt) : null;
    const due = dueAt || (bill.date ? new Date(new Date(bill.date).getTime() + 3 * 24 * 60 * 60 * 1000) : null);

    const st = String(bill.status || 'UNPAID').toUpperCase();

    if (!st.startsWith('PAID')) {
        if (due && now.getTime() > due.getTime()) {
            return {
                status: 'Facture faite -> Temps de paiement dépassé',
                reason: bill.reason || 'Facture émise',
                amount,
                billExternalId,
                dueAt: due ? due.toISOString() : null,
                paidAt: null,
            };
        }
        return {
            status: 'Facture faite -> En attente de paiement',
            reason: bill.reason || 'Facture émise',
            amount,
            billExternalId,
            dueAt: due ? due.toISOString() : null,
            paidAt: null,
        };
    }

    const paid = paidAt ? new Date(paidAt) : null;
    const paidIso = paid ? paid.toISOString() : null;

    if (due && paid && paid.getTime() > due.getTime()) {

        const lateMs = paid.getTime() - due.getTime();

        const hours = Math.floor(lateMs / (1000 * 60 * 60));
        const minutes = Math.floor((lateMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((lateMs % (1000 * 60)) / 1000);

        const lateDuration = [
            String(hours).padStart(2, '0'),
            String(minutes).padStart(2, '0'),
            String(seconds).padStart(2, '0'),
        ].join(':');

        return {
            status: 'Facture payé -> Mais en retard',
            reason: bill.reason || 'Facture payée',
            amount,
            billExternalId,
            dueAt: due.toISOString(),
            paidAt: paidIso,

            lateDuration,
            lateMs,
        };
    }

    return {
        status: 'Facture payé -> Dans les temps',
        reason: bill.reason || 'Facture payée',
        amount,
        billExternalId,
        dueAt: due ? due.toISOString() : null,
        paidAt: paidIso,
    };
}

/* =============================================================================
 * Accès / Admin
 * ========================================================================== */

/**
 * ✅ Vérifie l'accès au module Admin.
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function checkAccess() {
    return { success: true, message: 'Accès au module Admin confirmé.' };
}

/* =============================================================================
 * Support facturation
 * ========================================================================== */

/**
 * Retourne le tableau de bord "Support Facturation" pour une semaine/année.
 * - Normalise les paramètres
 * - Ajoute billingStatus.currency = 'USD' (exemple)
 * - Expose billableContacts + ibanToBill
 *
 * @param {number|{week:number,year:number}} weekArg
 * @param {number} [yearArg]
 */
async function getBillingSupportDashboard(weekArg, yearArg) {
    const { week, year } = normalizeWeekYear(weekArg, yearArg);
    const { start, end } = getWeekRange(week, year);

    const companies = await prisma.company.findMany({
        where: {
            isApiActive: true,
            id: { notIn: [9999, 25, 1] },
        },
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            accountingPrice: true,
            billableContacts: {
                include: {
                    user: {
                        select: { id: true, name: true, phoneNumber: true, iban: true },
                    },
                },
            },
            customServices: true,
        },
    });

    const companyIds = companies.map((c) => c.id);

    const parentBills = await prisma.bill.findMany({
        where: {
            isParentBill: true,
            accountingTargetCompanyId: { in: companyIds },
            date: { gte: start, lte: end },
            status: { not: 'CANCELED' },
        },
        select: {
            id: true,
            externalBillId: true,
            date: true,
            amount: true,
            status: true,
            reason: true,
            accountingTargetCompanyId: true,
            accountingDueAt: true,
        },
        orderBy: { date: 'desc' },
    });

    const billsByTargetCompanyId = new Map();
    for (const b of parentBills) {
        const tid = b.accountingTargetCompanyId;
        if (!tid) continue;
        if (!billsByTargetCompanyId.has(tid)) billsByTargetCompanyId.set(tid, []);
        billsByTargetCompanyId.get(tid).push(b);
    }

    const now = new Date();
    const paidDateByExternalId = new Map();

    const paidBills = parentBills.filter(
        (b) => String(b.status || '').toUpperCase().startsWith('PAID')
    );

    if (paidBills.length) {
        const pairs = await Promise.all(
            paidBills.map(async (b) => {
                try {
                    const paidAt = await getPaidDate(b.externalBillId);
                    return [b.externalBillId, paidAt];
                } catch {
                    return [b.externalBillId, null];
                }
            })
        );
        for (const [ext, dt] of pairs) paidDateByExternalId.set(ext, dt);
    }

    const results = companies.map((c) => {
        const contacts = (c.billableContacts || []).map((b) => ({
            userId: b.user?.id ?? null,
            userName: b.user?.name ?? 'Inconnu',
            phoneNumber: b.user?.phoneNumber ?? null,
            iban: b.user?.iban ?? null,
            isPrio: !!b.isPrio,
        }));

        const ibanToBill = contacts.find((x) => x.isPrio && !!x.iban)?.iban || contacts.find((x) => !!x.iban)?.iban || null;
        const baseAmount = Number.isFinite(+c.accountingPrice) ? +c.accountingPrice : 0;

        const companyBills = billsByTargetCompanyId.get(c.id) || [];

        const billingInvoices = companyBills.map(bill => {
            const paidAt = bill.externalBillId ? paidDateByExternalId.get(bill.externalBillId) : null;
            const status = deriveBillingStatus({ baseAmount, bill, now, paidAt });
            status.currency = 'USD';
            return status;
        });

        if (billingInvoices.length === 0) {
            const forceImpossible = !ibanToBill;
            const status = forceImpossible
                ? { status: 'Impossible', reason: 'Profil incomplet', amount: baseAmount, billExternalId: null, dueAt: null, paidAt: null }
                : { status: 'Facture à faire', reason: `Paiement W${week} / ${year}`, amount: baseAmount, billExternalId: null, dueAt: null, paidAt: null };
            status.currency = 'USD';
            billingInvoices.push(status);
        }

        const activeServices = (c.customServices || []).filter(s => {
            if (s.startWeek && week < s.startWeek) return false;
            if (s.endWeek && week > s.endWeek) return false;
            return true;
        });

        return {
            id: c.id,
            name: c.name,
            billingStatus: billingInvoices,
            ibanToBill,
            billableContacts: contacts,
            customServices: activeServices,
            accountingPrice: baseAmount
        };
    });

    return results;
}

/**
 * Vérifie l'existence d'au moins un contact facturable complet.
 * @param {number} companyId
 * @returns {Promise<boolean>}
 */
async function hasAtLeastOneCompleteBillable(companyId) {
    const contacts = await prisma.billableContact.findMany({
        where: { companyId },
        include: {
            user: {
                select: {
                    phoneNumber: true, iban: true, discordId: true, characterId: true,
                },
            },
        },
    });
    return contacts.some(({ user }) =>
        !!user.phoneNumber && !!user.iban && !!user.discordId && !!user.characterId
    );
}

/**
 * Notifie (bloquant) tous les contacts facturables d'une entreprise.
 * @param {number} companyId
 * @param {{title:string, body:string, content?:any}} payload
 */
async function notifyAllBillablesBlocking(companyId, payload) {
    try {
        const contacts = await prisma.billableContact.findMany({
            where: { companyId },
            include: { user: { select: { id: true } } },
        });
        if (!contacts.length) return;
        const now = new Date();
        await prisma.$transaction(
            contacts.map(c =>
                prisma.notification.create({
                    data: {
                        userId: c.user.id,
                        type: 'BLOCKING',
                        title: payload.title,
                        body: payload.body,
                        content: payload.content || {},
                        isAcknowledged: false,
                        createdAt: now,
                    },
                })
            )
        );
    } catch (e) {
        console.warn('[AdminService] Notification bloquante non créée:', e?.message);
    }
}

/**
 * Retrouve la date de paiement via Log (logType=paid).
 * @param {number} externalBillId
 * @returns {Promise<Date|null>}
 */
async function getPaidDate(externalBillId) {
    const log = await prisma.log.findFirst({
        where: {
            category: 'xbankaccount',
            logType: 'paid',
            OR: [
                { data: { contains: `"billId":${externalBillId}` } },
                { data: { contains: `"billId": ${externalBillId}` } },
            ],
        },
        orderBy: { createdAt: 'desc' },
        select: {
            date: true,
            createdAt: true,
        },
    });

    if (!log) return null;

    // priorité au vrai champ date
    if (log.date instanceof Date) {
        return log.date;
    }

    const parsed = new Date(log.date);

    if (!isNaN(parsed.getTime())) {
        return parsed;
    }

    return log.createdAt || null;
}


/**
 * Envoie une notification BLOQUANTE aux contacts facturables d'une entreprise,
 * avec un formulaire qui ne demande QUE les champs manquants.
 *
 * - Destinataires : billableContacts
 * - Form submit : PATCH /user/me
 *
 * @param {number} companyId
 * @param {{ title: string, body: string }} payload
 * @param {number|null} senderId
 * @returns {Promise<{ sentCount:number, skippedCompleteCount:number, skippedNoBillables:boolean }>}
 */
async function sendBlockingNotificationToCompany(companyId, payload, senderId = null) {
    const cid = Number(companyId);
    if (!Number.isFinite(cid)) {
        const err = new Error("ID entreprise invalide.");
        err.statusCode = 400;
        throw err;
    }

    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    const baseBody = typeof payload?.body === "string" ? payload.body : "";
    if (!title) {
        const err = new Error("Titre de notification invalide.");
        err.statusCode = 400;
        throw err;
    }

    const company = await prisma.company.findUnique({
        where: { id: cid },
        select: { id: true, name: true },
    });

    if (!company) {
        const err = new Error("Entreprise introuvable.");
        err.statusCode = 404;
        throw err;
    }

    const billables = await prisma.billableContact.findMany({
        where: { companyId: cid },
        select: {
            userId: true,
            user: {
                select: {
                    phoneNumber: true,
                    iban: true,
                    discordId: true,
                    characterId: true,
                },
            },
        },
    });

    if (!billables.length) {
        const err = new Error("Aucun contact facturable lié à cette entreprise.");
        err.statusCode = 409;
        throw err;
    }

    const buildMissingFields = (u) => {
        const fields = [];

        const hasPhone = typeof u.phoneNumber === "string" && u.phoneNumber.trim().length > 0;
        const hasIban = typeof u.iban === "string" && u.iban.trim().length > 0;
        const hasDiscord = typeof u.discordId === "string" && u.discordId.trim().length > 0;
        const hasChar = Number.isFinite(Number(u.characterId)) && Number(u.characterId) > 0;

        if (!hasPhone) {
            fields.push({
                id: "phoneNumber",
                label: "Numéro de téléphone",
                type: "tel",
                required: true,
            });
        }

        if (!hasIban) {
            fields.push({
                id: "iban",
                label: "IBAN",
                type: "text",
                required: true,
            });
        }

        if (!hasDiscord) {
            fields.push({
                id: "discordId",
                label: "Discord ID",
                type: "text",
                required: true,
            });
        }

        if (!hasChar) {
            fields.push({
                id: "characterId",
                label: "Character ID",
                type: "number",
                required: true,
            });
        }

        return fields;
    };

    const toCreate = [];
    let skippedCompleteCount = 0;

    for (const row of billables) {
        const missing = buildMissingFields(row.user || {});
        if (missing.length === 0) {
            skippedCompleteCount += 1;
            continue;
        }

        const missingLabels = missing.map((f) => f.label).join(", ");
        const body =
            (baseBody ? `${baseBody}\n\n` : "") +
            `Champs manquants : ${missingLabels}.`;

        toCreate.push({
            userId: row.userId,
            content: {
                title,
                body,
                // 🔽 Le modal BlockingNotificationModal.jsx attend ces clés AU NIVEAU RACINE
                formFields: missing,
                submitEndpoint: "/user/me",
                submitMethod: "PATCH",
            },
        });
    }

    if (toCreate.length === 0) {
        return {
            sentCount: 0,
            skippedCompleteCount,
            skippedNoBillables: false,
        };
    }

    const created = await prisma.$transaction(async (tx) => {
        const out = [];

        for (const item of toCreate) {
            const notification = await tx.notification.create({
                data: {
                    content: JSON.stringify(item.content),
                    type: "USER_SPECIFIC",
                    behavior: "BLOCKING",
                    senderId: Number.isFinite(Number(senderId)) ? Number(senderId) : null,
                },
                select: { id: true, createdAt: true },
            });

            const recipient = await tx.notificationRecipient.create({
                data: {
                    notificationId: notification.id,
                    userId: Number(item.userId),
                },
                select: { id: true, userId: true },
            });

            out.push({
                notificationId: notification.id,
                recipientId: recipient.id,
                userId: recipient.userId,
                createdAt: notification.createdAt,
                content: item.content,
            });
        }

        return out;
    });

    // Temps réel : permettre l'ACK immédiat (recipientId requis côté frontend)
    for (const c of created) {
        emitGatewayEvent({
            scope: "USER",
            targets: [c.userId],
            event: "NOTIFICATION_CREATED",
            payload: {
                notificationId: c.notificationId,
                recipientId: c.recipientId,
                content: c.content,
                companyId: cid,
                senderId: Number.isFinite(Number(senderId)) ? Number(senderId) : null,
                behavior: "BLOCKING",
                createdAt: c.createdAt,
            },
        });
    }

    return {
        sentCount: created.length,
        skippedCompleteCount,
        skippedNoBillables: false,
    };
}


/* =============================================================================
 * Entreprises / Utilisateurs / Modules
 * ========================================================================== */

/**
 * Liste des entreprises (avec quelques infos compactes).
 * @returns {Promise<Array>}
 */
async function listCompanies(params = {}) {
    const q = typeof params.q === 'string' ? params.q.trim() : '';
    const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
    const pageSizeRaw = Number.parseInt(params.pageSize ?? params.limit ?? '25', 10);
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(pageSizeRaw) ? pageSizeRaw : 25));

    const where = {};
    if (q) {
        const or = [
            { name: { contains: q } },
            { onboardingKey: { contains: q } },
            { apiKey: { contains: q } },
        ];
        if (/^\d+$/.test(q)) or.push({ id: Number.parseInt(q, 10) });
        where.OR = or;
    }

    const [companies, total] = await prisma.$transaction([
        prisma.company.findMany({
            where,
            orderBy: { name: 'asc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
                billableContacts: {
                    include: { user: { select: { id: true, name: true } } },
                },
                _count: {
                    select: {
                        employees: { where: { status: 'ACTIVE' } },
                        activeModules: true,
                    },
                },
            },
        }),
        prisma.company.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    let enriched = companies;

    // Enrich shard infos with a Redis pipeline (avoids N+1 round-trips).
    try {
        if (Array.isArray(companies) && companies.length > 0) {
            const metas = companies.map((c) => ({ id: c.id, shardName: shardNameFor(c.id) }));
            const pipeline = redis.multi();
            for (const m of metas) {
                pipeline.sismember('knownCompanies', String(m.id));
                pipeline.get(`shard:${m.shardName}:status`);
                pipeline.get(`shard:${m.shardName}:lastActivity`);
                pipeline.get(`shard:${m.shardName}:port`);
            }
            const results = await pipeline.exec();

            enriched = companies.map((c, i) => {
                const meta = metas[i];
                const offset = i * 4;

                const knownRaw = results?.[offset]?.[1];
                const rawStatus = results?.[offset + 1]?.[1];
                const lastActivityRaw = results?.[offset + 2]?.[1];
                const portRaw = results?.[offset + 3]?.[1];

                const lastActivityMs = lastActivityRaw ? Number(lastActivityRaw) : NaN;
                const status = colorFrom(rawStatus, lastActivityMs);

                return {
                    ...c,
                    shard: {
                        name: meta.shardName,
                        known: Number(knownRaw) === 1,
                        rawStatus: rawStatus || null,
                        status, // 'green' | 'orange' | 'red'
                        lastActivity: Number.isFinite(lastActivityMs) ? new Date(lastActivityMs).toISOString() : null,
                        port: portRaw ? Number(portRaw) : null,
                    },
                };
            });
        } else {
            enriched = (companies || []).map((c) => ({ ...c, shard: null }));
        }
    } catch (e) {
        // Fallback: bounded N+1 (pageSize) if pipeline fails.
        const fallback = [];
        for (const c of companies || []) {
            const shard = await getShardInfo(c.id);
            fallback.push({ ...c, shard });
        }
        enriched = fallback;
    }

    return {
        items: enriched,
        total,
        page,
        pageSize,
        totalPages,

        // compat: some frontends may still read `data/pagination`
        data: enriched,
        pagination: {
            totalCount: total,
            currentPage: page,
            pageSize,
            totalPages,
        },
    };
}


/**
 * Liste basique des entreprises (ID + Nom) pour les filtres.
 */
async function listCompaniesBasic() {
    return prisma.company.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
    });
}



/**
 * Crée une entreprise.
 * @param {{ name: string, isParentCompany?: boolean, accountingPrice?: number, phone?:string, iban?:string, discordId?:string, characterId?:number }} companyData
 * @returns {Promise<object>}
 */
async function createCompany(companyData) {
    const { name, isParentCompany = false, ...other } = companyData;
    if (!name) throw new Error("Le nom de l'entreprise est requis.");

    if (isParentCompany) {
        const existingParent = await prisma.company.findFirst({ where: { isParentCompany: true } });
        if (existingParent) throw new Error("Une entreprise parente existe déjà.");
    }

    const newCompany = await prisma.company.create({
        data: {
            name,
            isParentCompany,
            accountingPrice: other.accountingPrice || 0,
            ...(other.groupId != null ? { groupId: Number(other.groupId) } : {}),
        },
    });
    await ensureCompanyFullPermission(newCompany.id);

    return newCompany;
}

/**
 * Met à jour une entreprise.
 * @param {number} companyId
 * @param {{ name?: string, isParentCompany?: boolean, accountingPrice?: number, phone?:string, iban?:string, discordId?:string, characterId?:number }} dataToUpdate
 * @returns {Promise<object>}
 */
async function updateCompany(companyId, dataToUpdate) {
    if (dataToUpdate.isParentCompany === true) {
        const existingParent = await prisma.company.findFirst({
            where: { isParentCompany: true, id: { not: companyId } },
        });
        if (existingParent) throw new Error('Une autre entreprise est déjà parente.');
    }
    return prisma.company.update({
        where: { id: companyId },
        data: dataToUpdate,
    });
}

/**
 * Supprime une entreprise et toutes ses données (sauf Users, contrats et historique de rang).
 * - Les Users ne sont jamais supprimés.
 * - Les contrats ne sont pas supprimés: on détache les FK vers Company (NULL) avant la suppression.
 * - L'historique de rang est conservé via RankHistoryArchive (snapshot companyName + rankName)
 *   car RankHistory est en cascade via CompanyEmployee.
 *
 * @param {number} companyId
 * @param {{ actorUserId?: number|null }} opts
 */
async function deleteCompany(companyId, opts = {}) {
    if (!Number.isInteger(companyId) || companyId <= 0) {
        const err = new Error('ID entreprise invalide.');
        err.statusCode = 400;
        throw err;
    }

    const result = await prisma.$transaction(async (tx) => {
        const company = await tx.company.findUnique({
            where: { id: companyId },
            select: { id: true, name: true },
        });

        if (!company) {
            const err = new Error('Entreprise introuvable.');
            err.statusCode = 404;
            throw err;
        }

        // 1) Archive RankHistory -> RankHistoryArchive
        const employees = await tx.companyEmployee.findMany({
            where: { companyId },
            select: { id: true, userId: true },
        });

        if (employees.length > 0) {
            const empIds = employees.map((e) => e.id);
            const empUserMap = new Map(employees.map((e) => [e.id, e.userId]));

            const histories = await tx.rankHistory.findMany({
                where: { companyEmployeeId: { in: empIds } },
                select: {
                    assignedAt: true,
                    leaveAt: true,
                    rankId: true,
                    rankName: true,
                    companyEmployeeId: true,
                },
                orderBy: [{ assignedAt: 'asc' }],
            });

            if (histories.length > 0) {
                const archiveRows = histories.map((h) => ({
                    userId: empUserMap.get(h.companyEmployeeId),
                    companyId: companyId,
                    companyName: company.name,
                    rankId: h.rankId ?? null,
                    rankName: h.rankName || 'N/A',
                    assignedAt: h.assignedAt,
                    leaveAt: h.leaveAt ?? null,
                }));

                const batchSize = 1000;
                for (let i = 0; i < archiveRows.length; i += batchSize) {
                    await tx.rankHistoryArchive.createMany({
                        data: archiveRows.slice(i, i + batchSize),
                    });
                }
            }
        }

        // 2) Contrats: ne PAS supprimer. Détacher les FK Company.
        //    On conserve un snapshot du nom de l'entreprise pour pouvoir l'afficher après déliaison.
        await tx.assignedContract.updateMany({
            where: { generatedCompanyId: companyId },
            data: { generatedCompanyNameSnapshot: company.name, generatedCompanyId: null },
        });
        await tx.assignedContract.updateMany({
            where: { modifiesCompanyId: companyId },
            data: { modifiesCompanyNameSnapshot: company.name, modifiesCompanyId: null },
        });
        await tx.contractTemplate.updateMany({
            where: { companyId },
            data: { companyNameSnapshot: company.name, companyId: null },
        });

        // 3) Entités qui bloquent le delete (FK sans onDelete)
        // Chat (channels -> cascades messages/attachments/overrides)
        await tx.chatChannel.deleteMany({ where: { companyId } });
        await tx.chatCategory.deleteMany({ where: { companyId } });

        // Pawnshop (purchases -> cascade purchase items)
        await tx.pawnshopPurchase.deleteMany({ where: { companyId } });
        await tx.pawnshopPartnerBuyPrice.deleteMany({ where: { companyId } });
        await tx.pawnshopProduct.deleteMany({ where: { companyId } });
        await tx.pawnshopPartner.deleteMany({ where: { companyId } });

        // 3.5) Nettoyer les entités dépendantes de catégories qui peuvent bloquer le cascade (P2003)
        await tx.calendarEvent.deleteMany({ where: { companyId } });
        await tx.transaction.deleteMany({ where: { companyId } });
        await tx.expenseReport.deleteMany({ where: { companyId } });

        // 4) Détacher les users (M2M)
        await tx.company.update({
            where: { id: companyId },
            data: { users: { set: [] } },
        });

        // 5) Nettoyer permissions company-scoped (ne supprime pas les users)
        await tx.permission.deleteMany({
            where: { action: { startsWith: `COMPANY.${companyId}.` } },
        });

        // 6) Delete entreprise (le reste part en cascade via FK)
        await tx.company.delete({ where: { id: companyId } });

        return { deletedCompanyId: companyId, deletedCompanyName: company.name };
    }, { timeout: 30000 });

    // Redis cleanup (best effort)
    try {
        await redis.srem('knownCompanies', String(companyId));
        const shardName = companyId === 'global' ? 'shard-global' : `shard-c-${companyId}`;
        await redis.del(
            `shard:${shardName}:status`,
            `shard:${shardName}:lastActivity`,
            `shard:${shardName}:port`,
        );
    } catch (e) {
        // ignore
    }

    return result;
}

/**
 * Assigne un utilisateur comme "contact facturable".
 * @param {number} companyId
 * @param {number} userId
 * @returns {Promise<object>}
 */
async function assignBillableContact(companyId, userId, isPrio) {
    const cId = Number(companyId);
    const uId = Number(userId);

    const [company, user] = await Promise.all([
        prisma.company.findUnique({ where: { id: cId } }),
        prisma.user.findUnique({ where: { id: uId } }),
    ]);
    if (!company) throw new Error('Entreprise introuvable.');
    if (!user) throw new Error('Utilisateur introuvable.');

    const wantPrio = isPrio === true;

    return prisma.$transaction(async (tx) => {
        if (wantPrio) {
            await tx.billableContact.updateMany({
                where: { companyId: cId },
                data: { isPrio: false },
            });
        }

        // upsert pour éviter les erreurs si déjà présent
        const createData = wantPrio ? { companyId: cId, userId: uId, isPrio: true } : { companyId: cId, userId: uId };
        const updateData = wantPrio ? { isPrio: true } : {};

        return tx.billableContact.upsert({
            where: { userId_companyId: { userId: uId, companyId: cId } },
            create: createData,
            update: updateData,
        });
    });
}

/**
 * Retire un utilisateur des "contacts facturables".
 * @param {number} companyId
 * @param {number} userId
 * @returns {Promise<object>}
 */
async function removeBillableContact(companyId, userId) {
    return prisma.billableContact.delete({
        where: {
            userId_companyId: { userId, companyId },
        },
    });
}

/**
 * Liste (compacte) des utilisateurs.
 * @param {string} [searchQuery]
 * @returns {Promise<Array<{id:number,name:string,username:string}>>}
 */
async function listUsers(searchQuery = '') {
    const whereClause = searchQuery
        ? { OR: [{ name: { contains: searchQuery } }, { username: { contains: searchQuery } }] }
        : {};
    return prisma.user.findMany({
        where: whereClause,
        select: { id: true, name: true, username: true },
        orderBy: { name: 'asc' },
        take: 50,
    });
}

/**
 * Récupère le détail complet d’une entreprise + toutes les relations utiles.
 * Applique les filtres côté serveur sur transactions et factures.
 * @param {number} companyId
 * @param {{startDate?:Date,endDate?:Date,reason?:string,user?:string,minAmount?:number,maxAmount?:number}} filters
 * @returns {Promise<object>}
 */
async function getCompanyDetails(companyId, filters = {}) {
    const txWhere = buildTxWhere(filters);
    const billWhere = buildBillWhere(filters);

    const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
            // Employés & rangs
            employees: {
                include: {
                    user: {
                        select: {
                            id: true, name: true,
                            phoneNumber: true, iban: true, discordId: true, characterId: true
                        }
                    },
                    rank: true,
                    rankHistory: true,
                }
            },
            ranks: {
                include: { permissionTemplates: true, history: true }
            },

            // Clients & Bills
            clients: true,
            bills: {
                where: billWhere,
                include: {
                    author: { select: { id: true, name: true } },
                    client: true,
                },
                orderBy: { date: 'desc' },
            },

            // Transactions
            transactions: {
                where: txWhere,
                include: {
                    bill: true,
                    category: true,
                },
                orderBy: { date: 'desc' },
            },

            // Notes de frais
            expenseReports: {
                include: {
                    category: true,
                    author: { select: { id: true, name: true } },
                    reviewer: { select: { id: true, name: true } },
                }
            },
            expenseReportCategories: true,

            // Modules actifs
            activeModules: {
                include: { module: true }
            },

            // Contacts facturables
            billableContacts: {
                include: { user: { select: { id: true, name: true, phoneNumber: true, iban: true, discordId: true } } }
            },

            // Widgets utilisateurs
            userWidgets: {
                include: {
                    widgetDefinition: true,
                    user: { select: { id: true, name: true } },
                }
            },

            // Événements & catégories
            eventCategories: true,
            calendarEvents: {
                include: {
                    user: { select: { id: true, name: true } },   // sujet
                    author: { select: { id: true, name: true } }, // créateur
                    category: true,
                },
                orderBy: { startTime: 'desc' }
            },

            // Onboarding & fidélité
            onboardingCodes: true,
            fidelityCardTemplates: {
                include: { stampZones: true }
            },

            // Logs
            logs: true,

            // Users liés
            users: true,

            // Contrats
            generatedContract: {
                include: { template: true, signature: true }
            },
            contractsModifying: {
                include: { template: true, signature: true }
            },
        }
    });

    if (!company) throw new Error('Entreprise introuvable.');

    return {
        ...company,
        stats: {
            totalEmployees: company.employees.length,
            totalClients: company.clients.length,
            totalBills: company.bills.length,
            totalModules: company.activeModules.length,
            totalTransactions: company.transactions.length,
        },
    };
}

/**
 * Liste tous les modules disponibles (catalogue).
 * @returns {Promise<Array<{id:number,name:string,description:string}>>}
 */
async function getAllModules() {
    return prisma.module.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, description: true },
    });
}

/**
 * ✅ Retourne tous les userIds membres d'une entreprise (employés actifs + users liés).
 * @param {number} companyId
 * @returns {Promise<number[]>}
 */
async function getCompanyMemberUserIds(companyId) {
    const cid = Number(companyId);
    const ids = new Set();

    // 1) Employés (CompanyEmployee)
    try {
        if (prisma?.companyEmployee?.findMany) {
            const rows = await prisma.companyEmployee.findMany({
                where: { companyId: cid },
                select: { userId: true },
            });
            for (const r of rows || []) if (r?.userId) ids.add(r.userId);
        }
    } catch (e) {
        console.warn('[AdminService] companyEmployee.findMany indisponible:', e?.message);
    }

    // 2) Users directement liés à la company
    try {
        const comp = await prisma.company.findUnique({
            where: { id: cid },
            select: { users: { select: { id: true } } },
        });
        for (const u of comp?.users || []) if (u?.id) ids.add(u.id);
    } catch (e) {
        console.warn('[AdminService] company.users indisponible:', e?.message);
    }

    // 3) Users ayant AU MOINS UNE permission "scopée company"
    //    (ex: 'COMPANY.{cid}.*' OU qui commence par 'COMPANY.{cid}.')
    try {
        const prefixU = `COMPANY.${cid}.`;
        const exactU = `COMPANY.${cid}.*`;
        const prefixL = prefixU.toLowerCase();
        const exactL = exactU.toLowerCase();

        // a) on récupère d'abord les IDs des Permission concernées
        const companyPerms = await prisma.permission.findMany({
            where: {
                OR: [
                    { action: exactU },
                    { action: { startsWith: prefixU } },
                    { action: exactL },
                    { action: { startsWith: prefixL } },
                ],
            },
            select: { id: true },
        });

        if (companyPerms.length) {
            const permIds = companyPerms.map(p => p.id);

            // b) puis on récupère les users liés à ces IDs (relation many-to-many)
            const permUsers = await prisma.user.findMany({
                where: {
                    permissions: {
                        some: { id: { in: permIds } },
                    },
                },
                select: { id: true },
            });

            for (const u of permUsers || []) if (u?.id) ids.add(u.id);
        }
    } catch (e) {
        console.warn('[AdminService] users via Permission.id indisponible:', e?.message);
    }

    // (Optionnel) Inclure les super-admins :
    // try {
    //   const admins = await prisma.user.findMany({
    //     where: { permissions: { some: { action: 'ADMIN.*' } } },
    //     select: { id: true },
    //   });
    //   for (const u of admins || []) if (u?.id) ids.add(u.id);
    // } catch (e) {
    //   console.warn('[AdminService] super-admins indisponible:', e?.message);
    // }

    return Array.from(ids);
}

/**
 * ✅ Émet un SSE 'permission-change' à TOUS les membres d’une entreprise.
 * @param {number} companyId
 * @param {object} payload
 */
async function emitPermissionChangeToCompanyMembers(companyId, payload = {}) {
    const userIds = await getCompanyMemberUserIds(companyId);
    const base = { reason: 'company-update', companyId: Number(companyId), ...payload };
    for (const uid of userIds) {
        eventBus.emit(`permissions:${uid}`, base);
    }
}

/**
 * 🔔 Notifie uniquement les utilisateurs possédant un rang donné.
 * @param {number} companyId
 * @param {number} rankId
 * @param {object} payload
 */
async function emitPermissionChangeToRankMembers(companyId, rankId, payload = {}) {
    const employees = await prisma.companyEmployee.findMany({
        where: {
            companyId: Number(companyId),
            rankId: Number(rankId),
            status: 'ACTIVE',
        },
        select: { userId: true },
    });

    const base = {
        reason: 'rank-permissions-updated',
        companyId: Number(companyId),
        rankId: Number(rankId),
        ...payload
    };

    for (const emp of employees) {
        if (emp.userId) {
            eventBus.emit(`permissions:${emp.userId}`, base);
        }
    }
}

/**
 * Attribue des modules à une entreprise (table de jointure CompanyModule).
 * ➕ Notifie TOUS les membres de l’entreprise (modale + refresh côté front).
 * @param {number} companyId
 * @param {number[]} moduleIds
 * @returns {Promise<object>} company avec activeModules inclus
 */
async function assignCompanyModules(companyId, moduleIds) {
    if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
        throw new Error('moduleIds requis');
    }

    // Snapshot avant
    const before = await prisma.companyModule.findMany({
        where: { companyId: Number(companyId) },
        select: { moduleId: true },
    });
    const beforeSet = new Set(before.map(x => Number(x.moduleId)));

    // createMany direct sur la table de jointure (skipDuplicates)
    await prisma.companyModule.createMany({
        data: moduleIds.map((moduleId) => ({ companyId: Number(companyId), moduleId: Number(moduleId) })),
        skipDuplicates: true,
    });

    // Diff
    const added = moduleIds.filter(x => !beforeSet.has(Number(x)));

    // 🔔 Notifie tous les membres de la company (front: modale + reload)
    await emitPermissionChangeToCompanyMembers(companyId, {
        reason: 'modules-changed',
        diff: { added, removed: [] },
    });

    return prisma.company.findUnique({
        where: { id: Number(companyId) },
        include: { activeModules: { include: { module: true } } },
    });
}

/**
 * Retire un module d'une entreprise (table CompanyModule).
 * ➕ Notifie TOUS les membres de l’entreprise (modale + refresh côté front).
 * @param {number} companyId
 * @param {number} moduleId
 * @returns {Promise<object>} company avec activeModules inclus
 */
async function removeCompanyModule(companyId, moduleId) {
    await prisma.companyModule.delete({
        where: { companyId_moduleId: { companyId: Number(companyId), moduleId: Number(moduleId) } },
    });

    // 🔔 Notifie tous les membres de la company (front: modale + reload)
    await emitPermissionChangeToCompanyMembers(companyId, {
        reason: 'modules-changed',
        diff: { added: [], removed: [Number(moduleId)] },
    });

    return prisma.company.findUnique({
        where: { id: Number(companyId) },
        include: { activeModules: { include: { module: true } } },
    });
}

/**
 * Assure l'existence de la permission "Full Entreprise" pour une société.
 * Crée en BDD la permission `COMPANY.${companyId}.*` si absente.
 *
 * @param {number} companyId - ID de l’entreprise
 * @returns {Promise<{id:number, action:string}>} La permission full entreprise
 */
async function ensureCompanyFullPermission(companyId) {
    const action = `COMPANY.${companyId}.*`;
    let perm = await prisma.permission.findFirst({ where: { action } });
    if (perm) return perm;

    perm = await prisma.permission.create({ data: { action } });
    return perm;
}

/**
 * Récupère la permission "Full Entreprise" (si existante) d’une société.
 * @param {number} companyId
 * @returns {Promise<{id:number, action:string} | null>}
 */
async function getCompanyFullPermission(companyId) {
    const action = `COMPANY.${companyId}.*`;
    return prisma.permission.findFirst({
        where: { action },
        select: { id: true, action: true },
    });
}

/**
 * GRANT full company → ⚠️ seulement l’utilisateur visé doit être notifié (modale + refresh).
 * @param {number} userId
 * @param {number} companyId
 * @returns {Promise<{assigned:boolean, permissionId:number}>}
 */
async function grantCompanyFullPermissionToUser(userId, companyId) {
    const perm = await ensureCompanyFullPermission(companyId);

    // Vérifie si déjà attribuée
    const user = await prisma.user.findUnique({
        where: { id: Number(userId) },
        include: { permissions: true },
    });
    if (user?.permissions?.some(p => p.id === perm.id)) {
        return { assigned: false, permissionId: perm.id };
    }

    await prisma.user.update({
        where: { id: Number(userId) },
        data: { permissions: { connect: { id: perm.id } } },
    });

    eventBus.emit(`permissions:${userId}`, {
        reason: 'grant-full',
        companyId: Number(companyId),
        permission: `COMPANY.${companyId}.*`,
    });

    return { assigned: true, permissionId: perm.id };
}

/**
 * REVOKE full company → ⚠️ seulement l’utilisateur visé doit être notifié (modale + refresh).
 * @param {number} userId
 * @param {number} companyId
 * @returns {Promise<{removed:boolean}>}
 */
async function revokeCompanyFullPermissionFromUser(userId, companyId) {
    const perm = await getCompanyFullPermission(companyId);
    if (!perm) return { removed: false };

    await prisma.user.update({
        where: { id: Number(userId) },
        data: { permissions: { disconnect: { id: perm.id } } },
    });

    // 🎯 Événement ciblé UNIQUEMENT au user
    eventBus.emit(`permissions:${userId}`, {
        reason: 'revoke-full',
        companyId: Number(companyId),
        permission: `COMPANY.${companyId}.*`,
    });

    return { removed: true };
}

/* =============================================================================
 * Shard utils (si tu utilises des shards pour bots/services)
 * ========================================================================== */

function shardNameFor(companyId) {
    return companyId === 'global' ? 'shard-global' : `shard-c-${companyId}`;
}

function colorFrom(rawStatus, lastActivityMs) {
    if (!rawStatus) return 'red';
    const now = Date.now();
    const idle = Number.isFinite(lastActivityMs) ? (now - lastActivityMs) : Infinity;
    if (rawStatus === 'ready') {
        return idle < 90_000 ? 'green' : 'orange';
    }
    if (rawStatus === 'booting' || rawStatus === 'starting') return 'orange';
    return 'red';
}

async function getShardInfo(companyId) {
    const name = shardNameFor(companyId);
    const [known, rawStatus, lastActivity, port] = await Promise.all([
        redis.sismember('knownCompanies', String(companyId)),
        redis.get(`shard:${name}:status`),
        redis.get(`shard:${name}:lastActivity`),
        redis.get(`shard:${name}:port`),
    ]);
    const lastActivityMs = lastActivity ? Number(lastActivity) : NaN;
    const status = colorFrom(rawStatus, lastActivityMs);
    return {
        name,
        known: known === 1,
        rawStatus: rawStatus || null,
        status, // 'green' | 'orange' | 'red'
        lastActivity: Number.isFinite(lastActivityMs) ? new Date(lastActivityMs).toISOString() : null,
        port: port ? Number(port) : null,
    };
}

async function setCompanyKnown(companyId, known) {
    const id = String(companyId);
    const cacheKey = `company:active:${id}`;
    const activeValue = known ? "1" : "0";

    const pipeline = redis.multi();

    if (known) {
        pipeline.sadd("knownCompanies", id);
    } else {
        pipeline.srem("knownCompanies", id);
    }
    pipeline.set(cacheKey, activeValue);

    await pipeline.exec();

    return { companyId: Number(companyId), known: !!known };
}

/* =============================================================================
 * Onboarding / API keys
 * ========================================================================== */

/**
 * Met à jour ou régénère la clé d’onboarding d’une entreprise.
 * @param {number} companyId
 * @param {string} [customKey]
 */
async function updateOnboardingKey(companyId, customKey) {
    const newKey = customKey || generateKey(24);
    const company = await prisma.company.update({
        where: { id: Number(companyId) },
        data: { onboardingKey: newKey },
        select: { id: true, name: true, onboardingKey: true },
    });
    return company;
}

/**
 * Met à jour ou régénère la clé API d’une entreprise.
 * @param {number} companyId
 * @param {string} [customKey]
 */
async function updateApiKey(companyId, customKey) {
    const newKey = customKey || generateKey(32);
    const company = await prisma.company.update({
        where: { id: Number(companyId) },
        data: { apiKey: newKey },
        select: { id: true, name: true, apiKey: true },
    });
    return company;
}

/**
 * Liste les utilisateurs qui possèdent la FULL permission COMPANY.{companyId}.*
 * @param {number} companyId
 * @param {string} [q] - filtre par name/username (contains, case-insensitive)
 * @returns {Promise<Array<{id:number,name:string,username:string|null}>>}
 */
async function listCompanyFullUsers(companyId, q = '') {
    const action = `COMPANY.${Number(companyId)}.*`;
    const perm = await prisma.permission.findFirst({ where: { action }, select: { id: true } });
    if (!perm) return [];

    const where = {
        permissions: { some: { id: perm.id } },
    };
    if (q) {
        where.OR = [
            { name: { contains: q } },
            { username: { contains: q } },
        ];
    }

    return prisma.user.findMany({
        where,
        select: { id: true, name: true, username: true },
        orderBy: [{ name: 'asc' }, { username: 'asc' }],
        take: 100,
    });
}

/**
 * Détail enrichi employé pour panneau Admin.
 * Inclut user, rank, rankHistory et un aperçu des factures dont il est auteur.
 */
async function getEmployeeAdminProfile(companyId, employeeId) {
    const emp = await prisma.companyEmployee.findUnique({
        where: { id: Number(employeeId) },
        include: {
            user: {
                select: {
                    id: true, name: true, username: true, imageUrl: true,
                    phoneNumber: true, iban: true, discordId: true, characterId: true,
                }
            },
            rank: true,
            rankHistory: true,
        },
    });
    if (!emp || emp.companyId !== Number(companyId)) {
        throw new Error('Employé introuvable pour cette entreprise.');
    }

    // Factures de l’utilisateur (auteur) dans cette entreprise (si bill.companyId existe)
    let bills = [];
    try {
        bills = await prisma.bill.findMany({
            where: { companyId: Number(companyId), authorId: emp.userId },
            select: { id: true, date: true, reason: true, amount: true },
            orderBy: { date: 'desc' },
            take: 200,
        });
    } catch {
        // fallback si pas de companyId sur bill
        bills = await prisma.bill.findMany({
            where: { authorId: emp.userId },
            select: { id: true, date: true, reason: true, amount: true },
            orderBy: { date: 'desc' },
            take: 200,
        });
    }

    return { ...emp, bills };
}

/**
 * Upload d’avatar pour un utilisateur (via panneau Admin) puis MAJ de user.imageUrl
 * - Vérifie le mimetype
 * - Upload via imageService.uploadAndSaveImage (ownerType='USER', ownerId=userId)
 * - Construit l'URL publique comme le module image
 * - Sauvegarde l'URL dans User.imageUrl
 *
 * @param {number} companyId
 * @param {number} userId
 * @param {import('fastify-multipart').MultipartFile} fileData  // request.file()
 * @returns {Promise<{ imageUrl: string }>}
 */
async function saveUserAvatar(companyId, userId, fileData) {
    if (!fileData) {
        throw new Error('Aucun fichier fourni.');
    }
    const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ACCEPTED.includes(fileData.mimetype)) {
        throw new Error('Format de fichier non supporté.');
    }

    // Upload + persistance de l’image (même logique que le module image)
    const image = await imageService.uploadAndSaveImage(fileData, 'USER', Number(userId));

    // IMPORTANT: on construit l’URL comme dans image.controller.js
    const imageUrl = `/api/images/${image.publicId}?v=${image.updatedAt.getTime()}`;

    // MAJ du profil utilisateur
    await prisma.user.update({
        where: { id: Number(userId) },
        data: { imageUrl },
    });

    return { imageUrl };
}

/**
 * Change le statut d’un employé (ACTIVE | RESIGNED | FIRED)
 */
async function setEmployeeStatus(companyId, employeeId, status) {
    const allowed = new Set(['PENDING_LINK', 'ACTIVE', 'FIRE', 'RESIGNED']);
    if (!allowed.has(status)) throw new Error('Statut invalide.');
    const emp = await prisma.companyEmployee.update({
        where: { id: Number(employeeId) },
        data: { status, statusUpdatedAt: new Date() },
        select: { id: true, status: true, companyId: true, userId: true, rankId: true },
    });
    if (emp.companyId !== Number(companyId)) throw new Error('Employé non lié à cette entreprise.');
    return emp;
}

/**
 * Assigne un rang à l’employé et enregistre l’historique.
 */
async function assignEmployeeRank(companyId, employeeId, rankId) {
    const cId = Number(companyId);
    const eId = Number(employeeId);
    const rId = Number(rankId);

    return prisma.$transaction(async (tx) => {
        const employee = await tx.companyEmployee.findUnique({
            where: { id: eId },
            select: { id: true, companyId: true, rankId: true },
        });
        if (!employee || employee.companyId !== cId) {
            throw new Error('Employé non lié à cette entreprise.');
        }

        const newRank = await tx.rank.findFirst({ where: { id: rId, companyId: cId } });
        if (!newRank) throw new Error('Rang introuvable pour cette entreprise.');

        if (employee.rankId === rId) return employee;

        await tx.rankHistory.updateMany({
            where: { companyEmployeeId: eId, leaveAt: null },
            data: { leaveAt: new Date() },
        });

        const updated = await tx.companyEmployee.update({
            where: { id: eId },
            data: { rankId: rId },
            select: { id: true, companyId: true, rankId: true },
        });

        await tx.rankHistory.create({
            data: { companyEmployeeId: eId, rankId: rId, rankName: newRank.name || 'N/A' },
        });

        return updated;
    });
}


/**
 * Retire le rang courant si correspond au :rid + log d’historique.
 */
async function removeEmployeeRank(companyId, employeeId, rankId) {
    const cId = Number(companyId);
    const eId = Number(employeeId);
    const rId = Number(rankId);

    return prisma.$transaction(async (tx) => {
        const employee = await tx.companyEmployee.findUnique({
            where: { id: eId },
            select: { id: true, companyId: true, rankId: true },
        });
        if (!employee || employee.companyId !== cId) {
            throw new Error('Employé non lié à cette entreprise.');
        }

        if (Number(employee.rankId) !== rId) {
            return { ok: true };
        }

        // Fallback : rang le plus bas (position ASC)
        const fallback = await tx.rank.findFirst({
            where: { companyId: cId },
            orderBy: { position: 'asc' },
        });

        if (!fallback) throw new Error('Aucun rang fallback disponible pour cette entreprise.');

        if (fallback.id === employee.rankId) return { ok: true };

        await tx.rankHistory.updateMany({
            where: { companyEmployeeId: eId, leaveAt: null },
            data: { leaveAt: new Date() },
        });

        const updated = await tx.companyEmployee.update({
            where: { id: eId },
            data: { rankId: fallback.id },
            select: { id: true, companyId: true, rankId: true },
        });

        await tx.rankHistory.create({
            data: { companyEmployeeId: eId, rankId: fallback.id, rankName: fallback.name || 'N/A' },
        });

        return updated;
    });
}


/**
 * Ajoute une entrée d’historique de rang (note optionnelle).
 */
async function addEmployeeRankHistory(companyId, employeeId, rankId, note = '') {
    // NOTE: RankHistory ne stocke pas de note dans le schéma actuel.
    // Pour garder une cohérence fonctionnelle, on applique le changement de rang + historique.
    return assignEmployeeRank(companyId, employeeId, rankId);
}

/* ===============================================================
   🔧 Utilitaire : Pagination
   =============================================================== */
function toPagination({ page = 1, pageSize = 20 }) {
    const take = Math.max(1, Math.min(100, Number(pageSize) || 20));
    const current = Math.max(1, Number(page) || 1);
    const skip = (current - 1) * take;
    return { skip, take, current };
}

/* ===============================================================
   🏢 Conversations d’entreprise
   =============================================================== */

/**
 * Liste paginée des conversations rattachées à une entreprise.
 */
async function listCompanyConversations(companyId, { page = 1, pageSize = 20, search = '' } = {}) {
    const { skip, take, current } = toPagination({ page, pageSize });

    const where = {
        companyId: Number(companyId),
        ...(search ? { title: { contains: search } } : {}),
    };

    const orderBy = { lastActivityAt: 'desc' };

    const [convos, total] = await Promise.all([
        prisma.conversation.findMany({
            where,
            orderBy,
            skip,
            take,
            select: {
                id: true,
                kind: true,
                companyId: true,
                title: true,
                description: true,
                ticketStatus: true,
                membersCache: true,
                messageCount: true,
                reportCount: true,
                createdAt: true,
                updatedAt: true,
                lastActivityAt: true,
                ticketAdmin: { select: { id: true, name: true } },
            },
        }),
        prisma.conversation.count({ where }),
    ]);

    const totalPages = Math.ceil(total / take);

    return {
        items: convos,
        page: current,
        pageSize: take,
        total,
        totalPages,
    };
}

/**
 * Liste paginée des messages d'une conversation.
 */
async function listConversationMessages(conversationId, { page = 1, pageSize = 30 } = {}) {
    const { skip, take, current } = toPagination({ page, pageSize });

    const [messages, total] = await Promise.all([
        prisma.message.findMany({
            where: { conversationId: BigInt(conversationId) },
            orderBy: { createdAt: 'asc' },
            skip,
            take,
            select: {
                id: true,
                conversationId: true,
                authorId: true,
                content: true,
                createdAt: true,
                reportCount: true,
                author: { select: { id: true, name: true, imageUrl: true } },
            },
        }),
        prisma.message.count({ where: { conversationId: BigInt(conversationId) } }),
    ]);

    return {
        items: messages,
        page: current,
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take),
    };
}

/**
 * Modifie le contenu d’un message existant.
 */
async function editMessage(messageId, newContent, adminUserId) {
    const updated = await prisma.message.update({
        where: { id: BigInt(messageId) },
        data: {
            content: String(newContent || '').trim(),
        },
        select: {
            id: true,
            content: true,
            updatedAt: true,
        },
    });

    return updated;
}

/**
 * Supprime un message (hard delete).
 */
async function deleteMessage(messageId) {
    await prisma.message.delete({
        where: { id: BigInt(messageId) },
    });
    return { success: true };
}

/**
 * Envoie un message système dans une conversation.
 */
async function sendSystemMessage(conversationId, content, adminUserId) {
    const msg = await prisma.message.create({
        data: {
            conversationId: BigInt(conversationId),
            authorId: adminUserId,
            content: `[SYSTÈME] ${String(content || '').trim()}`,
        },
        select: {
            id: true,
            conversationId: true,
            content: true,
            createdAt: true,
        },
    });
    return msg;
}

/**
 * Ajoute un utilisateur ou un rôle à une conversation.
 */
async function addMember(conversationId, { userId = null, roleId = null, invitedById = null }) {
    const convId = BigInt(conversationId);

    if (!userId && !roleId) {
        throw new Error('userId ou roleId requis.');
    }

    if (userId) {
        const existing = await prisma.conversationUserMember.findUnique({
            where: { conversationId_userId: { conversationId: convId, userId: Number(userId) } },
        });
        if (existing) return existing;

        return prisma.conversationUserMember.create({
            data: {
                conversationId: convId,
                userId: Number(userId),
                invitedById: invitedById ? Number(invitedById) : null,
            },
        });
    }

    if (roleId) {
        const existing = await prisma.conversationRoleMember.findUnique({
            where: { conversationId_roleId: { conversationId: convId, roleId: Number(roleId) } },
        });
        if (existing) return existing;

        return prisma.conversationRoleMember.create({
            data: {
                conversationId: convId,
                roleId: Number(roleId),
            },
        });
    }
}

/**
 * Supprime un utilisateur ou un rôle d’une conversation.
 */
async function removeMember(conversationId, { userId = null, roleId = null }) {
    const convId = BigInt(conversationId);

    if (!userId && !roleId) {
        throw new Error('userId ou roleId requis.');
    }

    if (userId) {
        await prisma.conversationUserMember.deleteMany({
            where: { conversationId: convId, userId: Number(userId) },
        });
        return { success: true };
    }

    if (roleId) {
        await prisma.conversationRoleMember.deleteMany({
            where: { conversationId: convId, roleId: Number(roleId) },
        });
        return { success: true };
    }
}

/* ===============================================================
   🔒 Permissions : FULL ACCESS ("ADMIN.*")
   =============================================================== */

/**
 * Active ou désactive le FULL ACCESS pour une entreprise donnée.
 * → Permission : COMPANY.{companyId}.*
 */
async function setCompanyFullAccess(companyId, userId, enabled) {
    const actionName = `COMPANY.${companyId}.*`;

    if (enabled) {
        // Vérifie si l'utilisateur a déjà cette permission
        const exists = await prisma.permission.findFirst({
            where: { action: actionName, users: { some: { id: Number(userId) } } },
        });
        if (exists) return { success: true, granted: true };

        // Crée la permission si elle n'existe pas encore
        let permission = await prisma.permission.findUnique({ where: { action: actionName } });
        if (!permission) {
            permission = await prisma.permission.create({ data: { action: actionName } });
        }

        // Connecte l'utilisateur à cette permission
        await prisma.user.update({
            where: { id: Number(userId) },
            data: { permissions: { connect: { id: permission.id } } },
        });

        return { success: true, granted: true };
    }

    // Retire la permission pour cet utilisateur
    await prisma.user.update({
        where: { id: Number(userId) },
        data: { permissions: { disconnect: { action: actionName } } },
    });

    return { success: true, granted: false };
}

/* ===============================================================
   💵 Factures par employé (pagination)
   =============================================================== */

async function listEmployeeBills(employeeId, { page = 1, pageSize = 20 } = {}) {
    const { skip, take, current } = toPagination({ page, pageSize });

    const [items, total] = await Promise.all([
        prisma.bill.findMany({
            where: { authorId: Number(employeeId) },
            orderBy: { date: 'desc' },
            skip,
            take,
            select: {
                id: true,
                date: true,
                amount: true,
                status: true,
                reason: true,
                issuerName: true,
                recipientName: true,
                companyId: true,
                company: { select: { id: true, name: true } },
            },
        }),
        prisma.bill.count({ where: { authorId: Number(employeeId) } }),
    ]);

    // Normalisation : currency affichée en USD pour le front
    const normalized = items.map(b => ({ ...b, currency: 'USD' }));

    return {
        items: normalized,
        page: current,
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take),
    };
}

async function updateCompanyAccountingPrice(companyId, accountingPrice) {
    const id = Number(companyId);
    const price = Number(accountingPrice);

    if (!Number.isInteger(id) || id <= 0) {
        const err = new Error("ID entreprise invalide.");
        err.statusCode = 400;
        throw err;
    }
    if (!Number.isFinite(price) || price < 0) {
        const err = new Error("accountingPrice doit être un nombre >= 0.");
        err.statusCode = 400;
        throw err;
    }

    const company = await prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!company) {
        const err = new Error("Entreprise introuvable.");
        err.statusCode = 404;
        throw err;
    }

    // Normalisation 2 décimales
    const normalized = Math.round(price * 100) / 100;

    return prisma.company.update({
        where: { id },
        data: { accountingPrice: normalized },
    });
}

/**
 * billId = externalBillId
 */
async function setBillAccountingRouting(externalBillId, { accountingTargetCompanyId, accountingNotifyUserId }) {
    const ext = Number(externalBillId);
    const targetCompanyId = Number(accountingTargetCompanyId);
    const notifyUserId = Number(accountingNotifyUserId);

    if (!Number.isInteger(ext) || ext <= 0) {
        const err = new Error("externalBillId invalide.");
        err.statusCode = 400;
        throw err;
    }

    const bill = await prisma.bill.findUnique({
        where: { externalBillId: ext },
        select: {
            id: true,
            externalBillId: true,
            isParentBill: true,
            accountingIssuedNotifiedAt: true,
        },
    });

    if (!bill) {
        const err = new Error("Facture introuvable.");
        err.statusCode = 404;
        throw err;
    }

    if (!bill.isParentBill) {
        const err = new Error("Cette facture n'est pas une facture compta (isParentBill=false).");
        err.statusCode = 409;
        throw err;
    }

    const [company, user] = await Promise.all([
        prisma.company.findUnique({ where: { id: targetCompanyId }, select: { id: true } }),
        prisma.user.findUnique({ where: { id: notifyUserId }, select: { id: true } }),
    ]);

    if (!company) {
        const err = new Error("Entreprise cible introuvable.");
        err.statusCode = 404;
        throw err;
    }
    if (!user) {
        const err = new Error("Utilisateur à notifier introuvable.");
        err.statusCode = 404;
        throw err;
    }

    // Si la notif "émise" a déjà été envoyée, on peut encore laisser modifier,
    // mais généralement c'est dangereux => on bloque
    if (bill.accountingIssuedNotifiedAt) {
        const err = new Error("Facture déjà émise (notification déjà envoyée).");
        err.statusCode = 409;
        throw err;
    }

    return prisma.bill.update({
        where: { externalBillId: ext },
        data: {
            accountingTargetCompanyId: targetCompanyId,
            accountingNotifyUserId: notifyUserId,
        },
    });
}

/**
 * Émet une notif BLOCKING "facture émise" à accountingNotifyUserId
 * billId = externalBillId
 */
async function issueAccountingBill(externalBillId, { senderId = null } = {}) {
    const ext = Number(externalBillId);
    if (!Number.isInteger(ext) || ext <= 0) {
        const err = new Error("externalBillId invalide.");
        err.statusCode = 400;
        throw err;
    }

    const bill = await prisma.bill.findUnique({
        where: { externalBillId: ext },
        select: {
            id: true,
            externalBillId: true,
            date: true,
            amount: true,
            status: true,
            reason: true,

            isParentBill: true,
            accountingTargetCompanyId: true,
            accountingNotifyUserId: true,
            accountingDueAt: true,
            accountingIssuedNotifiedAt: true,
        },
    });

    if (!bill) {
        const err = new Error("Facture introuvable.");
        err.statusCode = 404;
        throw err;
    }
    if (!bill.isParentBill) {
        const err = new Error("Cette facture n'est pas une facture compta (isParentBill=false).");
        err.statusCode = 409;
        throw err;
    }
    if (!bill.accountingTargetCompanyId || !bill.accountingNotifyUserId) {
        const err = new Error("Routage incomplet: il faut accountingTargetCompanyId et accountingNotifyUserId.");
        err.statusCode = 409;
        throw err;
    }
    if (bill.accountingIssuedNotifiedAt) {
        const err = new Error("Facture déjà émise (notification déjà envoyée).");
        err.statusCode = 409;
        throw err;
    }

    // Echéance: 3 jours après la date de facture
    const dueAt = bill.accountingDueAt ?? addDays(new Date(bill.date), 3);

    const amountNum = parseFloat(bill.amount) || 0;
    const amountStr = `USD ${amountNum.toFixed(2)}`;
    const dueStr = new Date(dueAt).toLocaleString('fr-FR');

    const content = {
        kind: "ACCOUNTING_BILL_ISSUED",
        title: `Facture émise #${bill.externalBillId}`,
        body:
            `Une facture de ${amountStr} a été émise.\n` +
            `Paiement requis sous 3 jours (avant le ${dueStr}).\n` +
            `Des frais peuvent être ajoutés en cas de non paiement.`,
        billExternalId: bill.externalBillId,
        amount: amountNum,
        currency: "USD",
        dueAt: dueAt,
        targetCompanyId: bill.accountingTargetCompanyId,
    };

    const now = new Date();
    const notifyUserId = bill.accountingNotifyUserId;

    const { notification, recipient } = await prisma.$transaction(async (tx) => {
        const n = await tx.notification.create({
            data: {
                content: JSON.stringify(content),
                type: "USER_SPECIFIC",
                behavior: "BLOCKING",
                senderId: Number.isFinite(Number(senderId)) ? Number(senderId) : null,
            },
        });

        const r = await tx.notificationRecipient.create({
            data: {
                notificationId: n.id,
                userId: notifyUserId,
            },
        });

        await tx.bill.update({
            where: { externalBillId: ext },
            data: {
                accountingDueAt: dueAt,
                accountingIssuedNotifiedAt: now,
            },
        });

        return { notification: n, recipient: r };
    });

    // Emission temps réel (permet au frontend d'injecter correctement + ack)
    emitGatewayEvent({
        scope: "USER",
        targets: [notifyUserId],
        event: "NOTIFICATION_CREATED",
        payload: {
            notificationId: notification.id,
            recipients: [{ id: recipient.id, userId: notifyUserId }],
            content,
            companyId: bill.accountingTargetCompanyId,
            senderId: Number.isFinite(Number(senderId)) ? Number(senderId) : null,
            behavior: "BLOCKING",
            createdAt: notification.createdAt,
        },
    });

    return {
        notificationId: notification.id,
        recipientId: recipient.id,
        dueAt,
    };
}

/* =============================================================================
 * Exports
 * ========================================================================== */



/* ============================================================================
 * Admin Company Dashboard — pagination & actions
 * ========================================================================== */

async function listCompanyLogs({ companyId, page = 1, pageSize = 20, filters = {} }) {
    const cId = Number(companyId);
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const skip = (p - 1) * ps;

    const category = typeof filters.category === 'string' ? filters.category.trim() : '';
    const logType = typeof filters.logType === 'string' ? filters.logType.trim() : '';
    const q = typeof filters.q === 'string' ? filters.q.trim() : '';
    const dateFrom = filters.dateFrom instanceof Date ? filters.dateFrom : null;
    const dateTo = filters.dateTo instanceof Date ? filters.dateTo : null;
    const includeData = !!filters.includeData;

    const where = { companyId: cId };

    if (category) where.category = category;
    if (logType) where.logType = logType;

    if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = dateFrom;
        if (dateTo) where.createdAt.lte = dateTo;
    }

    if (q) {
        const or = [
            { message: { contains: q } },
            { text: { contains: q } },
        ];
        if (includeData) or.push({ data: { contains: q } });
        where.OR = or;
    }

    const select = {
        id: true,
        createdAt: true,
        message: true,
        category: true,
        logType: true,
        text: true,
        date: true,
        isProcessed: true,
        processingError: true,
    };
    if (includeData) select.data = true;

    const [items, total] = await prisma.$transaction([
        prisma.log.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: ps,
            select,
        }),
        prisma.log.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / ps));

    return {
        items,
        total,
        page: p,
        pageSize: ps,
        totalPages,
        data: items,
        pagination: { totalCount: total, currentPage: p, pageSize: ps, totalPages },
    };
}

/**
 * Force le retraitement d'un log spécifique.
 * @param {number} logId
 */
async function retryLog(logId) {
    const logProcessor = require('../../services/logProcessor.service');
    const log = await prisma.log.findUnique({
        where: { id: Number(logId) },
    });

    if (!log) {
        const err = new Error('Log introuvable.');
        err.statusCode = 404;
        throw err;
    }

    // On lance le traitement direct via le service de processing
    await logProcessor.process(log);

    // On retourne le log mis à jour
    return prisma.log.findUnique({
        where: { id: log.id },
    });
}

/**
 * Liste globale des logs avec filtres.
 */
async function listGlobalLogs({ page = 1, pageSize = 20, filters = {} }) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const skip = (p - 1) * ps;

    const companyId = Number(filters.companyId);
    const category = typeof filters.category === 'string' ? filters.category.trim() : '';
    const q = typeof filters.q === 'string' ? filters.q.trim() : '';
    const isProcessed = filters.isProcessed !== undefined ? !!filters.isProcessed : undefined;

    const where = {};
    if (Number.isFinite(companyId)) where.companyId = companyId;
    if (category) where.category = category;
    if (isProcessed !== undefined) where.isProcessed = isProcessed;

    if (q) {
        where.OR = [
            { message: { contains: q } },
            { text: { contains: q } },
            { data: { contains: q } },
        ];
    }

    const [items, total] = await prisma.$transaction([
        prisma.log.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: ps,
            include: { company: { select: { id: true, name: true } } },
        }),
        prisma.log.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / ps));

    return {
        items,
        total,
        page: p,
        pageSize: ps,
        totalPages,
        pagination: { totalCount: total, currentPage: p, pageSize: ps, totalPages },
    };
}

/**
 * Retourne les statistiques des logs.
 * Pour l'instant : nombre de logs non traités.
 */
async function getLogsStats(filters = {}) {
    const where = { isProcessed: false };

    const companyId = Number(filters.companyId);
    const category = typeof filters.category === 'string' ? filters.category.trim() : '';

    if (Number.isFinite(companyId)) where.companyId = companyId;
    if (category) where.category = category;

    const failsCount = await prisma.log.count({
        where,
    });

    return { failsCount };
}

/**
 * Retente le traitement de tous les logs en échec.
 * Trié du plus ancien au plus récent (date ASC).
 */
async function retryAllFailedLogs(filters = {}, requestingUserId = null) {
    const logProcessor = require('../../services/logProcessor.service');
    const { createNotification } = require('../../services/notificationService');

    const where = { isProcessed: false };

    const companyId = Number(filters.companyId);
    const category = typeof filters.category === 'string' ? filters.category.trim() : '';

    if (Number.isFinite(companyId)) where.companyId = companyId;
    if (category) where.category = category;

    const failedLogs = await prisma.log.findMany({
        where,
        orderBy: { createdAt: 'asc' },
    });

    if (failedLogs.length === 0) {
        return { total: 0, successCount: 0, errorCount: 0, status: 'QUEUED' };
    }

    // On lance le traitement en arrière-plan
    setImmediate(async () => {
        let successCount = 0;
        let errorCount = 0;

        console.log(`[AdminService] Lancement du retraitement de ${failedLogs.length} logs en arrière-plan pour l'utilisateur ${requestingUserId}...`);

        for (const log of failedLogs) {
            try {
                await logProcessor.process(log);
                successCount++;
            } catch (err) {
                console.error(`[AdminService] Erreur retryAllFailedLogs pour log ${log.id}:`, err);
                errorCount++;
            }
        }

        console.log(`[AdminService] Retraitement terminé : ${successCount} succès, ${errorCount} erreurs.`);

        // Notification de fin
        if (requestingUserId) {
            await createNotification({
                recipientUserIds: [requestingUserId],
                type: 'SYSTEM',
                behavior: 'PERMANENT',
                content: {
                    title: 'Retraitement des logs terminé',
                    body: `${successCount} logs ont été traités avec succès.${errorCount > 0 ? ` (${errorCount} échecs)` : ''}`
                }
            });
        }
    });

    return { total: failedLogs.length, status: 'QUEUED', message: 'Le traitement a été lancé en arrière-plan.' };
}


async function listPermissionTemplates() {
    return prisma.permissionTemplate.findMany({
        orderBy: [{ moduleId: 'asc' }, { action: 'asc' }],
        include: {
            module: { select: { id: true, name: true, description: true } },
        },
    });
}

async function getCompanyRanks(companyId) {
    // Ne dépend pas du module employees (évite les déploiements partiels / mismatch d'exports).
    // On conserve l'ordre logique via `position` et on inclut les permissionTemplates.
    return prisma.rank.findMany({
        where: { companyId: Number(companyId) },
        orderBy: { position: 'asc' },
        include: { permissionTemplates: true },
    });
}

async function createCompanyRank({ companyId, payload, actorUserId }) {
    const employeesService = require('../employees/employees.service');
    const aId = actorUserId ? Number(actorUserId) : undefined;
    return employeesService.createRank({ companyId: Number(companyId), payload, actorUserId: aId });
}

async function updateCompanyRank({ companyId, rankId, payload, actorUserId }) {
    const employeesService = require('../employees/employees.service');
    const aId = actorUserId ? Number(actorUserId) : undefined;
    return employeesService.updateRank({ companyId: Number(companyId), rankId: Number(rankId), payload, actorUserId: aId });
}

async function deleteCompanyRank({ companyId, rankId, actorUserId }) {
    const employeesService = require('../employees/employees.service');
    const aId = actorUserId ? Number(actorUserId) : undefined;
    return employeesService.deleteRank({ companyId: Number(companyId), rankId: Number(rankId), actorUserId: aId });
}

async function updateCompanyRankOrder({ companyId, order, actorUserId }) {
    const employeesService = require('../employees/employees.service');
    const aId = actorUserId ? Number(actorUserId) : undefined;
    // updateRankOrder ne prend pas actorUserId; permissions gérées en amont (admin)
    return employeesService.updateRankOrder({ companyId: Number(companyId), order });
}

async function resetEmployeeAccountAdmin({ companyId, employeeId }) {
    const cId = Number(companyId);
    const eId = Number(employeeId);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    return prisma.$transaction(async (tx) => {
        const employee = await tx.companyEmployee.findUnique({
            where: { id: eId },
            include: { user: true, rank: true },
        });

        if (!employee || employee.companyId !== cId) {
            throw { status: 404, message: "Employé introuvable dans cette entreprise." };
        }
        if (!employee.user) {
            throw { status: 404, message: "Utilisateur lié introuvable." };
        }

        const targetUser = employee.user;

        if (targetUser.tempPasswordToken && targetUser.tempPasswordExpiresAt && targetUser.tempPasswordExpiresAt > now) {
            return {
                alreadyActive: true,
                userId: targetUser.id,
                username: targetUser.username,
                tempPasswordToken: targetUser.tempPasswordToken,
                tempPasswordExpiresAt: targetUser.tempPasswordExpiresAt,
            };
        }

        const token = generate6DigitToken();
        const placeholderPassword = "__RESET__";

        const updatedUser = await tx.user.update({
            where: { id: targetUser.id },
            data: {
                password: placeholderPassword,
                tempPasswordToken: token,
                tempPasswordExpiresAt: expiresAt,
            },
        });

        return {
            alreadyActive: false,
            userId: updatedUser.id,
            username: updatedUser.username,
            tempPasswordToken: updatedUser.tempPasswordToken,
            tempPasswordExpiresAt: updatedUser.tempPasswordExpiresAt,
        };
    });
}

async function updateEmployeeUserProfileAdmin({ companyId, employeeId, payload }) {
    const cId = Number(companyId);
    const eId = Number(employeeId);

    const allowed = ['name', 'phoneNumber', 'iban', 'discordId', 'characterId'];
    const data = {};
    for (const k of allowed) {
        if (payload?.[k] !== undefined) data[k] = payload[k];
    }
    if (Object.keys(data).length === 0) {
        throw new Error('Aucune donnée valide à mettre à jour.');
    }

    const emp = await prisma.companyEmployee.findUnique({
        where: { id: eId },
        select: { companyId: true, userId: true },
    });
    if (!emp || emp.companyId !== cId) {
        throw new Error("Employé introuvable pour cette entreprise.");
    }

    return prisma.user.update({
        where: { id: emp.userId },
        data,
        select: {
            id: true,
            name: true,
            username: true,
            phoneNumber: true,
            iban: true,
            discordId: true,
            characterId: true,
            imageUrl: true,
        },
    });
}

async function updateBillStatus({ companyId, billId, status, actorUserId }) {
    const allowed = new Set(['UNPAID', 'PAID_CASH', 'PAID_CARD', 'CANCELED']);
    if (!allowed.has(status)) throw new Error('Statut de facture invalide.');

    const cId = Number(companyId);
    const bId = Number(billId);

    const data = { status };
    if (status === 'CANCELED') {
        const aId = actorUserId ? Number(actorUserId) : null;
        if (aId) data.canceledById = aId;
    }

    const updated = await prisma.bill.updateMany({
        where: { id: bId, companyId: cId },
        data,
    });

    if (updated.count === 0) throw new Error('Facture introuvable pour cette entreprise.');

    return prisma.bill.findUnique({
        where: { id: bId },
        select: { id: true, date: true, amount: true, status: true, reason: true, externalBillId: true, companyId: true, clientId: true },
    });
}

async function updateTransactionCategoryAdmin({ companyId, transactionId, categoryId }) {
    const comptabiliteService = require('../comptabilite/comptabilite.service');
    return comptabiliteService.updateTransactionCategory(Number(transactionId), Number(categoryId), Number(companyId));
}

async function createClientAdmin({ companyId, payload }) {
    const clientsService = require('../clients/clients.service');
    const cId = Number(companyId);
    const { name, phoneNumber, address, iban, cni } = payload || {};
    if (!name) throw new Error('name requis.');

    const nameSearchable = clientsService._normalizeString ? clientsService._normalizeString(name) : String(name).toLowerCase();

    return prisma.client.create({
        data: {
            companyId: cId,
            name,
            phoneNumber: phoneNumber ?? null,
            address: address ?? null,
            iban: iban ?? null,
            cni: cni ?? null,
            nameSearchable,
        },
    });
}

async function updateClientAdmin({ companyId, clientId, payload }) {
    const clientsService = require('../clients/clients.service');
    const cId = Number(companyId);
    const clId = Number(clientId);
    return clientsService.updateClient(clId, cId, payload || {});
}

async function deleteClientAdmin({ companyId, clientId }) {
    const cId = Number(companyId);
    const clId = Number(clientId);

    const client = await prisma.client.findFirst({
        where: { id: clId, companyId: cId },
        select: { id: true },
    });
    if (!client) throw new Error('Client introuvable pour cette entreprise.');

    const [billsCount, pawnCount] = await prisma.$transaction([
        prisma.bill.count({ where: { clientId: clId } }),
        prisma.pawnshopPurchase.count({ where: { clientId: clId } }),
    ]);

    if (billsCount > 0 || pawnCount > 0) {
        throw new Error("Impossible de supprimer ce client car il est lié à des factures/achats.");
    }

    await prisma.client.delete({ where: { id: clId } });
    return { ok: true };
}

async function listBillableContacts(companyId) {
    const cId = Number(companyId);
    return prisma.billableContact.findMany({
        where: { companyId: cId },
        orderBy: [{ isPrio: 'desc' }, { assignedAt: 'asc' }],
        include: {
            user: { select: { id: true, name: true, username: true, phoneNumber: true, iban: true } },
        },
    });
}

async function setBillableContactPrio(companyId, userId, isPrio) {
    const cId = Number(companyId);
    const uId = Number(userId);
    const wantPrio = isPrio === true;

    return prisma.$transaction(async (tx) => {
        const existing = await tx.billableContact.findUnique({
            where: { userId_companyId: { userId: uId, companyId: cId } },
        });
        if (!existing) throw new Error('Contact facturable introuvable.');

        if (wantPrio) {
            await tx.billableContact.updateMany({
                where: { companyId: cId, NOT: { userId: uId } },
                data: { isPrio: false },
            });
        }

        return tx.billableContact.update({
            where: { userId_companyId: { userId: uId, companyId: cId } },
            data: { isPrio: wantPrio },
        });
    });
}




module.exports = {
    // Access / Admin
    checkAccess,

    // Support facturation
    getBillingSupportDashboard,
    notifyAllBillablesBlocking,
    sendBlockingNotificationToCompany,
    hasAtLeastOneCompleteBillable,
    getPaidDate,

    // Entreprises
    listCompanies,
    listCompaniesBasic,
    createCompany,
    updateCompany,
    deleteCompany,
    getCompanyDetails,
    setCompanyKnown,

    // Billables
    assignBillableContact,
    removeBillableContact,

    // Utilisateurs
    listUsers,

    // Modules
    getAllModules,
    assignCompanyModules,
    removeCompanyModule,

    // Permissions company full
    ensureCompanyFullPermission,
    getCompanyFullPermission,
    grantCompanyFullPermissionToUser,
    revokeCompanyFullPermissionFromUser,

    // Keys
    updateOnboardingKey,
    updateApiKey,

    // Utils
    getWeekRange,

    // (optionnel) helpers exposés si besoin de tests
    getCompanyMemberUserIds,
    emitPermissionChangeToCompanyMembers,
    emitPermissionChangeToRankMembers,

    // Admin page
    listCompanyFullUsers,
    getEmployeeAdminProfile,
    saveUserAvatar,
    setEmployeeStatus,
    assignEmployeeRank,
    removeEmployeeRank,
    addEmployeeRankHistory,
    listCompanyConversations,
    listConversationMessages,
    editMessage,
    deleteMessage,
    sendSystemMessage,
    addMember,
    removeMember,
    setCompanyFullAccess,
    listEmployeeBills,
    updateCompanyAccountingPrice,
    setBillAccountingRouting,
    issueAccountingBill,
    // Dashboard admin company (pagination/actions)
    listCompanyLogs,
    listGlobalLogs,
    retryLog,
    getLogsStats,
    retryAllFailedLogs,
    listPermissionTemplates,
    getCompanyRanks,
    createCompanyRank,
    updateCompanyRank,
    deleteCompanyRank,
    updateCompanyRankOrder,
    resetEmployeeAccountAdmin,
    updateEmployeeUserProfileAdmin,
    updateBillStatus,
    updateTransactionCategoryAdmin,
    createClientAdmin,
    updateClientAdmin,
    deleteClientAdmin,
    setBillableContactPrio,
    listBillableContacts,

    // Custom Services
    listCustomServices,
    createCustomService,
    updateCustomService,
    deleteCustomService,

    // Announcements
    listAnnouncements,
    getActiveAnnouncement,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,

    // Suspension comptabilité
    setAccountingSuspension,
};

async function listCustomServices(companyId) {
    return prisma.customService.findMany({
        where: { companyId: Number(companyId) },
        orderBy: { createdAt: 'desc' },
    });
}

async function createCustomService(companyId, data) {
    return prisma.customService.create({
        data: {
            companyId: Number(companyId),
            title: data.title,
            invoiceReason: data.invoiceReason,
            description: data.description,
            price: data.price,
            duration: data.duration,
            startWeek: data.startWeek ? Number(data.startWeek) : null,
            endWeek: data.endWeek ? Number(data.endWeek) : null,
        },
    });
}

async function updateCustomService(serviceId, data) {
    return prisma.customService.update({
        where: { id: Number(serviceId) },
        data: {
            title: data.title,
            invoiceReason: data.invoiceReason,
            description: data.description,
            price: data.price,
            duration: data.duration,
            startWeek: data.startWeek ? Number(data.startWeek) : null,
            endWeek: data.endWeek ? Number(data.endWeek) : null,
        },
    });
}

async function deleteCustomService(serviceId) {
    return prisma.customService.delete({
        where: { id: Number(serviceId) },
    });
}

/* =============================================================================
 * Announcements
 * ========================================================================== */

async function listAnnouncements() {
    return prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { id: true, username: true } } },
    });
}

async function getActiveAnnouncement() {
    return prisma.announcement.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
    });
}

async function createAnnouncement(userId, data) {
    const { title, body, isActive, actions } = data;

    if (isActive) {
        await prisma.announcement.updateMany({ data: { isActive: false } });
    }

    return prisma.announcement.create({
        data: {
            title,
            body,
            isActive: Boolean(isActive),
            actions: actions ?? [],
            createdById: userId,
        },
    });
}

async function updateAnnouncement(id, data) {
    const { title, body, isActive, actions } = data;

    if (isActive) {
        await prisma.announcement.updateMany({
            where: { id: { not: Number(id) } },
            data: { isActive: false },
        });
    }

    return prisma.announcement.update({
        where: { id: Number(id) },
        data: {
            ...(title !== undefined && { title }),
            ...(body !== undefined && { body }),
            ...(isActive !== undefined && { isActive: Boolean(isActive) }),
            ...(actions !== undefined && { actions }),
        },
    });
}

async function deleteAnnouncement(id) {
    return prisma.announcement.delete({ where: { id: Number(id) } });
}

async function setAccountingSuspension(companyId, suspendedAt) {
    const value = suspendedAt ? new Date(suspendedAt) : null;
    if (value && isNaN(value.getTime())) {
        throw new Error('Date de suspension invalide.');
    }
    return prisma.company.update({
        where: { id: Number(companyId) },
        data: { accountingSuspendedAt: value },
        select: { id: true, name: true, accountingSuspendedAt: true },
    });
}
