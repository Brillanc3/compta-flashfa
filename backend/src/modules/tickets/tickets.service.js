// /backend/src/modules/tickets/tickets.service.js

const prisma = require('../../db');
const ticketsQueueRedis = require('../../lib/ticketsQueueRedis');
const { emitGatewayEvent } = require('../../core/gateway/gateway.emitter');
const { hasPermission, buildEffectiveCompanyPermissions } = require('../../middleware/auth');
const { PERMISSIONS, CATEGORY_PERMISSION_MAP } = require('./tickets.permissions');

const MS_24H = 24 * 60 * 60 * 1000;
const MS_48H = 48 * 60 * 60 * 1000;

let _ensurePermissionsPromise = null;

function _httpError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

function _parsePagination(query) {
    const page = Math.max(1, parseInt(query?.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query?.pageSize ?? query?.limit ?? '15', 10) || 15));
    return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function _normalizeContent(content) {
    const v = String(content ?? '').trim();
    if (!v) throw _httpError(400, 'Message vide.');
    if (v.length > 4000) throw _httpError(400, 'Message trop long (max 4000).');
    return v;
}

/* -------------------------------------------------------------------------- */
/* Permissions registry (DB)                                                  */
/* -------------------------------------------------------------------------- */

async function ensureTicketAdminPermissionsExist() {
    if (_ensurePermissionsPromise) return _ensurePermissionsPromise;

    _ensurePermissionsPromise = (async () => {
        const actions = [
            PERMISSIONS.TICKETS_ALL,
            PERMISSIONS.TICKETS_BILLS,
            PERMISSIONS.TICKETS_SUPPORT,
            PERMISSIONS.TICKETS_OTHERS,
        ];

        // Table `Permission` existe dans le schéma
        const existing = await prisma.permission.findMany({
            where: { action: { in: actions } },
            select: { action: true },
        });

        const existingSet = new Set(existing.map((p) => p.action));
        const toCreate = actions.filter((a) => !existingSet.has(a));

        if (toCreate.length > 0) {
            await prisma.permission.createMany({
                data: toCreate.map((action) => ({ action })),
                skipDuplicates: true,
            });
        }
    })();

    return _ensurePermissionsPromise;
}

/* -------------------------------------------------------------------------- */
/* Notifications (Gateway WS: NOTIFICATION_CREATED)                            */
/* -------------------------------------------------------------------------- */

async function _createGatewayNotification({ recipientUserIds, content, type = 'USER_SPECIFIC', behavior = 'PERMANENT', senderId = null }) {
    const ids = Array.from(new Set((recipientUserIds || []).map(Number).filter(Number.isFinite)));
    if (ids.length === 0) return;

    const notification = await prisma.$transaction(async (tx) => {
        const notif = await tx.notification.create({
            data: {
                content: JSON.stringify(content),
                type,
                behavior,
                senderId,
            },
        });

        await tx.notificationRecipient.createMany({
            data: ids.map((userId) => ({ notificationId: notif.id, userId })),
        });

        return notif;
    });

    emitGatewayEvent({
        scope: 'USER',
        targets: ids,
        event: 'NOTIFICATION_CREATED',
        payload: {
            notificationId: notification.id,
            content,
            companyId: null,
            senderId,
            behavior,
            createdAt: notification.createdAt,
        },
    });

    return notification;
}

/* -------------------------------------------------------------------------- */
/* Admin context (strict)                                                      */
/* -------------------------------------------------------------------------- */

async function _getAdminContext(adminId, companyId) {
    // STRICT: on n'utilise PAS checkPermission (qui bypass COMPANY.<id>.*)
    const perms = await buildEffectiveCompanyPermissions(adminId, companyId || null);

    // Super = tickets all OU ADMIN.* (hasPermission gère ADMIN.*)
    const isSuper = hasPermission(perms, PERMISSIONS.TICKETS_ALL);

    const allowedCategories = new Set();
    for (const [cat, perm] of Object.entries(CATEGORY_PERMISSION_MAP)) {
        if (hasPermission(perms, perm)) allowedCategories.add(cat);
    }

    return { perms, isSuper, allowedCategories };
}

function _assertAdminHasAnyTicketScope(ctx) {
    const ok = ctx?.isSuper || (ctx?.allowedCategories && ctx.allowedCategories.size > 0);
    if (!ok) throw _httpError(403, "Accès interdit: permissions tickets manquantes.");
}

/**
 * Visibilité ticket:
 * - super: tous
 * - sinon:
 *   - non assigné + catégorie autorisée
 *   - assigné à moi
 */
async function _assertAdminCanViewTicket(adminId, ctx, ticket) {
    if (ctx.isSuper) return true;

    if (!ticket.assigneeId) {
        if (!ctx.allowedCategories.has(ticket.category)) {
            throw _httpError(403, "Accès interdit: catégorie non autorisée.");
        }
        return true;
    }

    if (ticket.assigneeId !== adminId) {
        throw _httpError(403, "Accès interdit: ticket assigné à un autre agent.");
    }

    return true;
}

async function _assertAdminIsParticipant(adminId, ticketId) {
    const existing = await prisma.ticketParticipant.findUnique({
        where: { ticketId_userId: { ticketId, userId: adminId } },
        select: { ticketId: true, userId: true },
    });
    if (!existing) throw _httpError(403, "Rejoindre le ticket est obligatoire avant de répondre.");
}

/* -------------------------------------------------------------------------- */
/* Status helpers                                                              */
/* -------------------------------------------------------------------------- */

function _computePostUserMessageStatus(ticket) {
    if (!ticket.assigneeId) return 'OPEN';
    if (!ticket.assigneeJoinedAt) return 'ASSIGNED';
    return 'WAITING_AGENT';
}

function _computePostReopenStatus(ticket) {
    if (!ticket.assigneeId) return 'OPEN';
    if (!ticket.assigneeJoinedAt) return 'ASSIGNED';
    return 'WAITING_AGENT';
}

/* -------------------------------------------------------------------------- */
/* Notifications tickets                                                       */
/* -------------------------------------------------------------------------- */

async function _notifyAdminsForNewTicket({ senderId, ticketId, category, subject }) {
    await ensureTicketAdminPermissionsExist();

    const actions = [
        '*',
        'ADMIN.*',
        PERMISSIONS.TICKETS_ALL,
        CATEGORY_PERMISSION_MAP[category],
    ].filter(Boolean);

    const admins = await prisma.user.findMany({
        where: {
            OR: [
                { permissions: { some: { action: { in: actions } } } },
                { roles: { some: { permissions: { some: { action: { in: actions } } } } } },
                { employments: { some: { rank: { permissionTemplates: { some: { action: { in: actions } } } } } } },
            ],
        },
        select: { id: true },
    });

    const recipientUserIds = Array.from(new Set(admins.map((u) => u.id)))
        .filter((id) => id !== senderId);

    await _createGatewayNotification({
        recipientUserIds,
        senderId,
        type: 'USER_SPECIFIC',
        behavior: 'PERMANENT',
        content: {
            title: 'Nouveau ticket',
            body: `[${category}] ${subject}`,
            ticketId,
            category,
        },
    });
}

async function _notifyUserForAdminMessage({ senderId, userId, ticketId, subject }) {
    await _createGatewayNotification({
        recipientUserIds: [userId],
        senderId,
        type: 'USER_SPECIFIC',
        behavior: 'PERMANENT',
        content: {
            title: 'Réponse à votre ticket',
            body: subject ? subject : 'Un agent a répondu à votre ticket.',
            ticketId,
        },
    });
}

async function _notifyUserForClosureRequest({ senderId, userId, ticketId }) {
    await _createGatewayNotification({
        recipientUserIds: [userId],
        senderId,
        type: 'USER_SPECIFIC',
        behavior: 'PERMANENT',
        content: {
            title: 'Demande de clôture',
            body: "Un agent a demandé la clôture. Sans réponse de votre part, le ticket se fermera automatiquement dans 24h.",
            ticketId,
        },
    });
}

async function _notifyAssigneeForUserMessage({ senderId, assigneeId, ticketId }) {
    await _createGatewayNotification({
        recipientUserIds: [assigneeId],
        senderId,
        type: 'USER_SPECIFIC',
        behavior: 'PERMANENT',
        content: {
            title: 'Nouveau message',
            body: `Le demandeur a envoyé un message sur le ticket #${ticketId}.`,
            ticketId,
        },
    });
}

/* -------------------------------------------------------------------------- */
/* User endpoints                                                              */
/* -------------------------------------------------------------------------- */

async function listMyTickets(userId, query) {
    const { page, pageSize, skip, take } = _parsePagination(query);

    const where = { createdById: userId };
    if (query?.status) where.status = String(query.status).toUpperCase();

    const [totalCount, data] = await Promise.all([
        prisma.ticket.count({ where }),
        prisma.ticket.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            skip,
            take,
            include: {
                assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
            },
        }),
    ]);

    return {
        data,
        pagination: {
            totalCount,
            currentPage: page,
            pageSize,
            totalPages: Math.ceil(totalCount / pageSize),
        },
    };
}

async function createMyTicket(userId, payload) {
    const category = String(payload?.category ?? '').toUpperCase();
    if (!CATEGORY_PERMISSION_MAP[category]) throw _httpError(400, 'Catégorie invalide.');

    const subject = String(payload?.subject ?? '').trim();
    if (!subject || subject.length < 3) throw _httpError(400, 'Sujet invalide (min 3 caractères).');
    if (subject.length > 120) throw _httpError(400, 'Sujet trop long (max 120).');

    const content = _normalizeContent(payload?.message);

    const created = await prisma.$transaction(async (tx) => {
        const ticket = await tx.ticket.create({
            data: {
                createdById: userId,
                category,
                subject,
                status: 'OPEN',
                lastMessageAt: new Date(),
            },
        });

        const message = await tx.ticketMessage.create({
            data: {
                ticketId: ticket.id,
                authorId: userId,
                kind: 'USER',
                content,
            },
            include: {
                author: { select: { id: true, name: true, username: true, imageUrl: true } },
            },
        });

        return { ticket, message };
    });

    // Notifie les admins (catégorie)
    await _notifyAdminsForNewTicket({
        senderId: userId,
        ticketId: created.ticket.id,
        category,
        subject,
    });

    return created;
}

async function getMyTicket(userId, ticketId) {
    const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
            assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
        },
    });
    if (!ticket) throw _httpError(404, "Ticket introuvable.");
    if (ticket.createdById !== userId) throw _httpError(403, "Accès interdit.");

    return ticket;
}

async function listMyTicketMessages(userId, ticketId, query) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, createdById: true } });
    if (!ticket) throw _httpError(404, "Ticket introuvable.");
    if (ticket.createdById !== userId) throw _httpError(403, "Accès interdit.");

    const { page, pageSize, skip, take } = _parsePagination(query);

    const [totalCount, data] = await Promise.all([
        prisma.ticketMessage.count({ where: { ticketId } }),
        prisma.ticketMessage.findMany({
            where: { ticketId },
            orderBy: { createdAt: 'asc' },
            skip,
            take,
            include: {
                author: { select: { id: true, name: true, username: true, imageUrl: true } },
            },
        }),
    ]);

    return {
        data,
        pagination: {
            totalCount,
            currentPage: page,
            pageSize,
            totalPages: Math.ceil(totalCount / pageSize),
        },
    };
}

async function postMyTicketMessage(userId, ticketId, payload) {
    const content = _normalizeContent(payload?.content);

    const result = await prisma.$transaction(async (tx) => {
        const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) throw _httpError(404, "Ticket introuvable.");
        if (ticket.createdById !== userId) throw _httpError(403, "Accès interdit.");
        if (ticket.status === 'CLOSED') throw _httpError(409, "Ticket fermé.");

        // Annule la demande de clôture si présente (réponse USER)
        if (ticket.status === 'CLOSURE_REQUESTED') {
            await ticketsQueueRedis.cancelAutoClose(ticket.id);
        }

        const message = await tx.ticketMessage.create({
            data: {
                ticketId,
                authorId: userId,
                kind: 'USER',
                content,
            },
            include: {
                author: { select: { id: true, name: true, username: true, imageUrl: true } },
            },
        });

        const newStatus = _computePostUserMessageStatus(ticket);

        const updatedTicket = await tx.ticket.update({
            where: { id: ticketId },
            data: {
                status: newStatus,
                lastMessageAt: new Date(),
                // reset closure state si on répond
                closureRequestedAt: null,
                closureRequestedById: null,
                closureDeadlineAt: null,
            },
            include: {
                assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
            },
        });

        return { ticket: updatedTicket, message };
    });

    // Notifie l'agent assigné du nouveau message
    if (result.ticket.assigneeId && result.ticket.assigneeId !== userId) {
        await _notifyAssigneeForUserMessage({
            senderId: userId,
            assigneeId: result.ticket.assigneeId,
            ticketId,
        });
    }

    return result;
}

async function closeMyTicket(userId, ticketId) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw _httpError(404, "Ticket introuvable.");
    if (ticket.createdById !== userId) throw _httpError(403, "Accès interdit.");
    if (ticket.status === 'CLOSED') throw _httpError(409, "Ticket déjà fermé.");

    await ticketsQueueRedis.cancelAutoClose(ticket.id);

    const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closureRequestedAt: null,
            closureRequestedById: null,
            closureDeadlineAt: null,
        },
        include: {
            assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
        },
    });

    return updated;
}

async function reopenMyTicket(userId, ticketId) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw _httpError(404, "Ticket introuvable.");
    if (ticket.createdById !== userId) throw _httpError(403, "Accès interdit.");
    if (ticket.status !== 'CLOSED') throw _httpError(409, "Le ticket n'est pas fermé.");

    const closedAtMs = ticket.closedAt ? new Date(ticket.closedAt).getTime() : 0;
    const nowMs = Date.now();
    if (!closedAtMs || nowMs - closedAtMs > MS_48H) {
        throw _httpError(409, "Réouverture impossible (ticket fermé depuis plus de 2 jours). Ouvrir un nouveau ticket.");
    }

    await ticketsQueueRedis.cancelAutoClose(ticket.id);

    const status = _computePostReopenStatus(ticket);

    const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
            status,
            closedAt: null,
            lastMessageAt: new Date(),
            closureRequestedAt: null,
            closureRequestedById: null,
            closureDeadlineAt: null,
        },
        include: {
            assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
        },
    });

    return updated;
}

/* -------------------------------------------------------------------------- */
/* Admin endpoints                                                             */
/* -------------------------------------------------------------------------- */

async function listAdminTickets(adminId, companyId, query) {
    const ctx = await _getAdminContext(adminId, companyId);
    _assertAdminHasAnyTicketScope(ctx);

    const { page, pageSize, skip, take } = _parsePagination(query);

    const status = query?.status ? String(query.status).toUpperCase() : null;
    const category = query?.category ? String(query.category).toUpperCase() : null;
    const assigned = query?.assigned ? String(query.assigned) : 'all';
    const search = query?.search ? String(query.search).trim() : '';

    const where = {};

    if (status) where.status = status;
    if (category) where.category = category;

    if (ctx.isSuper) {
        if (assigned === 'me') where.assigneeId = adminId;
        else if (assigned === 'unassigned') where.assigneeId = null;
        // all => pas de filtre
    } else {
        // non super: (unassigned + catégories autorisées) OR (assigné à moi)
        where.OR = [
            { assigneeId: null, category: { in: Array.from(ctx.allowedCategories) } },
            { assigneeId: adminId },
        ];
    }

    if (search) {
        where.AND = [
            ...(where.AND || []),
            {
                OR: [
                    { subject: { contains: search } },
                    { createdBy: { name: { contains: search } } },
                    { createdBy: { username: { contains: search } } },
                ],
            },
        ];
    }

    const [totalCount, data] = await Promise.all([
        prisma.ticket.count({ where }),
        prisma.ticket.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            skip,
            take,
            include: {
                createdBy: { select: { id: true, name: true, username: true, imageUrl: true } },
                assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
            },
        }),
    ]);

    return {
        data,
        pagination: {
            totalCount,
            currentPage: page,
            pageSize,
            totalPages: Math.ceil(totalCount / pageSize),
        },
    };
}

async function getAdminTicket(adminId, companyId, ticketId) {
    const ctx = await _getAdminContext(adminId, companyId);
    _assertAdminHasAnyTicketScope(ctx);

    const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
            createdBy: { select: { id: true, name: true, username: true, imageUrl: true } },
            assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
        },
    });
    if (!ticket) throw _httpError(404, "Ticket introuvable.");

    await _assertAdminCanViewTicket(adminId, ctx, ticket);
    return ticket;
}

async function listAdminTicketMessages(adminId, companyId, ticketId, query) {
    const ctx = await _getAdminContext(adminId, companyId);
    _assertAdminHasAnyTicketScope(ctx);

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw _httpError(404, "Ticket introuvable.");
    await _assertAdminCanViewTicket(adminId, ctx, ticket);

    const { page, pageSize, skip, take } = _parsePagination(query);

    const [totalCount, data] = await Promise.all([
        prisma.ticketMessage.count({ where: { ticketId } }),
        prisma.ticketMessage.findMany({
            where: { ticketId },
            orderBy: { createdAt: 'asc' },
            skip,
            take,
            include: {
                author: { select: { id: true, name: true, username: true, imageUrl: true } },
            },
        }),
    ]);

    return {
        data,
        pagination: {
            totalCount,
            currentPage: page,
            pageSize,
            totalPages: Math.ceil(totalCount / pageSize),
        },
    };
}

async function takeTicket(adminId, companyId, ticketId) {
    const ctx = await _getAdminContext(adminId, companyId);
    _assertAdminHasAnyTicketScope(ctx);

    const updated = await prisma.$transaction(async (tx) => {
        const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) throw _httpError(404, "Ticket introuvable.");

        await _assertAdminCanViewTicket(adminId, ctx, ticket);

        if (ticket.assigneeId) throw _httpError(409, "Ticket déjà assigné.");
        if (!ctx.isSuper && !ctx.allowedCategories.has(ticket.category)) {
            throw _httpError(403, "Accès interdit: catégorie non autorisée.");
        }

        // Auto-join: l'agent qui prend en charge rejoint automatiquement
        await tx.ticketParticipant.upsert({
            where: { ticketId_userId: { ticketId, userId: adminId } },
            update: {},
            create: { ticketId, userId: adminId, role: 'ADMIN' },
        });

        return tx.ticket.update({
            where: { id: ticketId },
            data: {
                assigneeId: adminId,
                assigneeJoinedAt: new Date(),
                status: 'WAITING_AGENT',
            },
            include: {
                createdBy: { select: { id: true, name: true, username: true, imageUrl: true } },
                assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
            },
        });
    });

    return updated;
}

async function joinTicket(adminId, companyId, ticketId) {
    const ctx = await _getAdminContext(adminId, companyId);
    _assertAdminHasAnyTicketScope(ctx);

    const updated = await prisma.$transaction(async (tx) => {
        const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) throw _httpError(404, "Ticket introuvable.");

        await _assertAdminCanViewTicket(adminId, ctx, ticket);

        if (ticket.status === 'CLOSED') throw _httpError(409, "Ticket fermé.");

        // participant admin
        await tx.ticketParticipant.upsert({
            where: { ticketId_userId: { ticketId, userId: adminId } },
            update: {},
            create: { ticketId, userId: adminId, role: 'ADMIN' },
        });

        // marque "prise en charge" (join)
        const joinedAt = ticket.assigneeId === adminId && !ticket.assigneeJoinedAt ? new Date() : ticket.assigneeJoinedAt;

        const nextStatus = (ticket.assigneeId && !joinedAt) ? 'ASSIGNED' : (ticket.status === 'OPEN' || ticket.status === 'ASSIGNED') ? 'WAITING_AGENT' : ticket.status;

        return tx.ticket.update({
            where: { id: ticketId },
            data: {
                assigneeJoinedAt: joinedAt || ticket.assigneeJoinedAt,
                status: nextStatus,
            },
            include: {
                createdBy: { select: { id: true, name: true, username: true, imageUrl: true } },
                assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
            },
        });
    });

    return updated;
}

async function postAdminTicketMessage(adminId, companyId, ticketId, payload) {
    const content = _normalizeContent(payload?.content);

    const ctx = await _getAdminContext(adminId, companyId);
    _assertAdminHasAnyTicketScope(ctx);

    const { message, updatedTicket, shouldNotifyUser } = await prisma.$transaction(async (tx) => {
        const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) throw _httpError(404, "Ticket introuvable.");

        await _assertAdminCanViewTicket(adminId, ctx, ticket);

        if (ticket.status === 'CLOSED') throw _httpError(409, "Ticket fermé.");

        // Auto-join si pas encore participant
        await tx.ticketParticipant.upsert({
            where: { ticketId_userId: { ticketId, userId: adminId } },
            update: {},
            create: { ticketId, userId: adminId, role: 'ADMIN' },
        });
        const needsJoinTimestamp = ticket.assigneeId === adminId && !ticket.assigneeJoinedAt;

        const created = await tx.ticketMessage.create({
            data: {
                ticketId,
                authorId: adminId,
                kind: 'ADMIN',
                content,
            },
            include: {
                author: { select: { id: true, name: true, username: true, imageUrl: true } },
            },
        });

        // Anti-spam notif user: seulement si pas déjà WAITING_USER ni CLOSURE_REQUESTED
        const notify = ticket.status !== 'WAITING_USER' && ticket.status !== 'CLOSURE_REQUESTED';

        const statusUpdate = ticket.status === 'CLOSURE_REQUESTED' ? 'CLOSURE_REQUESTED' : 'WAITING_USER';

        const updated = await tx.ticket.update({
            where: { id: ticketId },
            data: {
                status: statusUpdate,
                lastMessageAt: new Date(),
                ...(needsJoinTimestamp ? { assigneeJoinedAt: new Date() } : {}),
            },
            include: {
                assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
            },
        });

        return { message: created, updatedTicket: updated, shouldNotifyUser: notify };
    });

    if (shouldNotifyUser) {
        // Notif user (créateur)
        const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { createdById: true, subject: true } });
        if (t) {
            await _notifyUserForAdminMessage({
                senderId: adminId,
                userId: t.createdById,
                ticketId,
                subject: t.subject,
            });
        }
    }

    return { ticket: updatedTicket, message };
}

async function forceAssignTicket(adminId, companyId, ticketId, payload) {
    const ctx = await _getAdminContext(adminId, companyId);
    _assertAdminHasAnyTicketScope(ctx);

    // Seul super (ADMIN.* ou ADMIN.TICKETS.* via wildcard) peut forcer
    if (!ctx.isSuper) throw _httpError(403, "Accès interdit: assignation forcée réservée à ADMIN.* / ADMIN.TICKETS.*.");

    const assigneeIdRaw = payload?.assigneeId;
    const assigneeId = assigneeIdRaw === null ? null : Number.parseInt(assigneeIdRaw, 10);
    if (assigneeIdRaw !== null && (!Number.isInteger(assigneeId) || assigneeId <= 0)) {
        throw _httpError(400, "assigneeId invalide.");
    }

    const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
            assigneeId,
            assigneeJoinedAt: assigneeId ? null : null,
            status: assigneeId ? 'ASSIGNED' : 'OPEN',
        },
        include: {
            createdBy: { select: { id: true, name: true, username: true, imageUrl: true } },
            assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
        },
    });

    return updated;
}

async function requestClosure(adminId, companyId, ticketId) {
    const ctx = await _getAdminContext(adminId, companyId);
    _assertAdminHasAnyTicketScope(ctx);

    const now = new Date();
    const deadlineAt = new Date(now.getTime() + MS_24H);

    const updated = await prisma.$transaction(async (tx) => {
        const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) throw _httpError(404, "Ticket introuvable.");

        await _assertAdminCanViewTicket(adminId, ctx, ticket);

        // Seul assignee ou super peut demander clôture
        if (!ctx.isSuper && ticket.assigneeId !== adminId) {
            throw _httpError(403, "Accès interdit: seul l'agent assigné peut demander la clôture.");
        }

        if (ticket.status === 'CLOSED') throw _httpError(409, "Ticket déjà fermé.");
        if (ticket.status === 'CLOSURE_REQUESTED') throw _httpError(409, "Une demande de clôture est déjà en cours.");

        const updatedTicket = await tx.ticket.update({
            where: { id: ticketId },
            data: {
                status: 'CLOSURE_REQUESTED',
                closureRequestedAt: now,
                closureRequestedById: adminId,
                closureDeadlineAt: deadlineAt,
            },
            include: {
                assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
            },
        });

        return updatedTicket;
    });

    // (sécurité) annule un éventuel job précédent, puis planifie la fermeture automatique
    await ticketsQueueRedis.cancelAutoClose(updated.id);
    await ticketsQueueRedis.enqueueAutoClose({ ticketId: updated.id, deadlineAt });

    // Notifie le user
    const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { createdById: true } });
    if (t) {
        await _notifyUserForClosureRequest({
            senderId: adminId,
            userId: t.createdById,
            ticketId,
        });
    }

    return updated;
}

async function closeAdminTicket(adminId, companyId, ticketId) {
    const ctx = await _getAdminContext(adminId, companyId);
    _assertAdminHasAnyTicketScope(ctx);

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw _httpError(404, "Ticket introuvable.");
    await _assertAdminCanViewTicket(adminId, ctx, ticket);

    if (!ctx.isSuper && ticket.assigneeId !== adminId) {
        throw _httpError(403, "Seul l'agent assigné (ou super) peut fermer ce ticket.");
    }

    if (ticket.status === 'CLOSED') throw _httpError(409, "Ticket déjà fermé.");

    await ticketsQueueRedis.cancelAutoClose(ticket.id);

    const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closureRequestedAt: null,
            closureRequestedById: null,
            closureDeadlineAt: null,
        },
        include: {
            assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
        },
    });

    // Notifie le demandeur
    await _createGatewayNotification({
        recipientUserIds: [ticket.createdById],
        senderId: adminId,
        type: 'USER_SPECIFIC',
        behavior: 'PERMANENT',
        content: {
            title: 'Ticket fermé',
            body: 'Votre ticket a été fermé par un agent.',
            ticketId,
        },
    });

    return updated;
}

async function getRequesterProfile(adminId, companyId, ticketId) {
    const ctx = await _getAdminContext(adminId, companyId);
    _assertAdminHasAnyTicketScope(ctx);

    const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, createdById: true, assigneeId: true },
    });
    if (!ticket) throw _httpError(404, "Ticket introuvable.");

    const isAdminAll = hasPermission(ctx.perms, 'ADMIN.*');
    const isAssignee = ticket.assigneeId === adminId;

    if (!isAdminAll && !isAssignee) {
        throw _httpError(403, "Accès interdit: profil disponible uniquement pour l'agent assigné (ou ADMIN.*).");
    }

    const user = await prisma.user.findUnique({
        where: { id: ticket.createdById },
        select: {
            id: true,
            name: true,
            username: true,
            phoneNumber: true,
            iban: true,
            imageUrl: true,
            employments: {
                select: {
                    id: true,
                    status: true,
                    company: { select: { id: true, name: true } },
                    rank: { select: { id: true, name: true, position: true } },
                },
            },
        },
    });

    if (!user) throw _httpError(404, "Utilisateur introuvable.");
    return user;
}

module.exports = {
    ensureTicketAdminPermissionsExist,

    // user
    listMyTickets,
    createMyTicket,
    getMyTicket,
    listMyTicketMessages,
    postMyTicketMessage,
    closeMyTicket,
    reopenMyTicket,

    // admin
    listAdminTickets,
    getAdminTicket,
    listAdminTicketMessages,
    takeTicket,
    joinTicket,
    postAdminTicketMessage,
    forceAssignTicket,
    requestClosure,
    closeAdminTicket,
    getRequesterProfile,
};
