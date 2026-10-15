// /backend/src/modules/mycalendar/mycalendar.controller.js
const prisma = require('../../db');
const myCalendarService = require('./mycalendar.service');
const { buildEffectiveCompanyPermissions, hasPermission } = require('../../middleware/auth');

const ADMIN_PERMISSION = 'ADMIN.MYCALENDAR.MANAGE';

/**
 * Résout le contexte de la requête à partir de la base, jamais du JWT seul :
 * - companyId : l'en-tête x-company-id n'est retenu que si l'utilisateur
 *   est employé actif de l'entreprise (ou admin plateforme).
 * - isAdmin : permission ADMIN.MYCALENDAR.MANAGE (ou wildcard ADMIN.*).
 * Lance une erreur avec statusCode si l'accès est refusé.
 */
async function resolveContext(request) {
    if (request.user?.isApiKey || !request.user?.userId) {
        const err = new Error("Le calendrier personnel n'est pas accessible par clé API.");
        err.statusCode = 403;
        throw err;
    }

    const userId = request.user.userId;
    const permissions = await buildEffectiveCompanyPermissions(userId, null);
    const isAdmin = hasPermission(permissions, ADMIN_PERMISSION);

    const rawCompanyId = request.headers['x-company-id'];
    if (rawCompanyId === undefined || rawCompanyId === '' || rawCompanyId === 'null') {
        return { userId, companyId: null, isAdmin };
    }

    const companyId = Number.parseInt(rawCompanyId, 10);
    if (!Number.isInteger(companyId) || companyId <= 0) {
        const err = new Error("ID d'entreprise invalide.");
        err.statusCode = 400;
        throw err;
    }

    if (!isAdmin) {
        const employment = await prisma.companyEmployee.findFirst({
            where: { companyId, userId, status: 'ACTIVE' },
            select: { id: true },
        });
        if (!employment) {
            const err = new Error("Vous n'êtes pas membre de cette entreprise.");
            err.statusCode = 403;
            throw err;
        }
    }

    return { userId, companyId, isAdmin };
}

function sendError(reply, error, fallbackStatus) {
    return reply.status(error.statusCode || fallbackStatus).send({ message: error.message });
}

async function getEvents(request, reply) {
    try {
        const { userId, companyId } = await resolveContext(request);
        const events = await myCalendarService.getEvents(userId, companyId);
        return reply.send(events);
    } catch (error) {
        return sendError(reply, error, 500);
    }
}

async function getInvitations(request, reply) {
    try {
        const { userId } = await resolveContext(request);
        const invitations = await myCalendarService.getPendingInvitations(userId);
        return reply.send(invitations);
    } catch (error) {
        return sendError(reply, error, 500);
    }
}

async function createEvent(request, reply) {
    try {
        const { userId, companyId, isAdmin } = await resolveContext(request);
        const event = await myCalendarService.createEvent(request.body, userId, companyId, isAdmin);
        return reply.status(201).send(event);
    } catch (error) {
        return sendError(reply, error, 400);
    }
}

async function updateEvent(request, reply) {
    const { id } = request.params;

    try {
        const { userId, companyId, isAdmin } = await resolveContext(request);
        const event = await myCalendarService.updateEvent(id, request.body, userId, companyId, isAdmin);
        return reply.send(event);
    } catch (error) {
        return sendError(reply, error, 400);
    }
}

async function deleteEvent(request, reply) {
    const { id } = request.params;

    try {
        const { userId, companyId, isAdmin } = await resolveContext(request);
        await myCalendarService.deleteEvent(id, userId, companyId, isAdmin);
        return reply.send({ message: "Événement supprimé" });
    } catch (error) {
        return sendError(reply, error, 400);
    }
}

async function uploadImage(request, reply) {
    const { id } = request.params;

    try {
        const { userId, companyId, isAdmin } = await resolveContext(request);
        const data = await request.file();
        if (!data) return reply.status(400).send({ message: "Aucun fichier fourni" });

        const event = await myCalendarService.saveEventImage(id, data, userId, companyId, isAdmin);
        return reply.send(event);
    } catch (error) {
        return sendError(reply, error, 400);
    }
}

async function respondInvitation(request, reply) {
    const { id } = request.params;
    const { status } = request.body;
    try {
        const { userId } = await resolveContext(request);
        const result = await myCalendarService.respondToInvitation(id, userId, status);
        return reply.send(result);
    } catch (error) {
        return sendError(reply, error, 400);
    }
}

async function shareEvent(request, reply) {
    const { id } = request.params;
    const { username } = request.body;
    try {
        const { userId } = await resolveContext(request);
        const result = await myCalendarService.shareEvent(id, username, userId);
        return reply.send(result);
    } catch (error) {
        return sendError(reply, error, 400);
    }
}

async function getCategories(request, reply) {
    try {
        const { userId, companyId } = await resolveContext(request);
        const categories = await myCalendarService.getCategories(userId, companyId);
        return reply.send(categories);
    } catch (error) {
        return sendError(reply, error, 500);
    }
}

async function createCategory(request, reply) {
    try {
        const { userId, companyId } = await resolveContext(request);
        const category = await myCalendarService.createCategory(request.body, userId, companyId);
        return reply.status(201).send(category);
    } catch (error) {
        return sendError(reply, error, 400);
    }
}

async function deleteCategory(request, reply) {
    const { id } = request.params;
    try {
        const { userId, companyId } = await resolveContext(request);
        await myCalendarService.deleteCategory(id, userId, companyId);
        return reply.send({ message: "Catégorie supprimée" });
    } catch (error) {
        return sendError(reply, error, 400);
    }
}

module.exports = {
    getEvents,
    getInvitations,
    createEvent,
    updateEvent,
    deleteEvent,
    uploadImage,
    respondInvitation,
    shareEvent,
    getCategories,
    createCategory,
    deleteCategory
};
