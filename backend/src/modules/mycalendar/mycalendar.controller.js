// /backend/src/modules/mycalendar/mycalendar.controller.js
const myCalendarService = require('./mycalendar.service');

async function getEvents(request, reply) {
    const userId = request.user.userId;
    const companyId = request.headers['x-company-id'] ? parseInt(request.headers['x-company-id']) : null;
    
    try {
        const events = await myCalendarService.getEvents(userId, companyId);
        return reply.send(events);
    } catch (error) {
        return reply.status(500).send({ message: error.message });
    }
}

async function getInvitations(request, reply) {
    const userId = request.user.userId;
    try {
        const invitations = await myCalendarService.getPendingInvitations(userId);
        return reply.send(invitations);
    } catch (error) {
        return reply.status(500).send({ message: error.message });
    }
}

async function createEvent(request, reply) {
    const userId = request.user.userId;
    const companyId = request.headers['x-company-id'] ? parseInt(request.headers['x-company-id']) : null;
    
    try {
        const event = await myCalendarService.createEvent(request.body, userId, companyId);
        return reply.status(201).send(event);
    } catch (error) {
        return reply.status(400).send({ message: error.message });
    }
}

async function updateEvent(request, reply) {
    const { id } = request.params;
    const userId = request.user.userId;
    const companyId = request.headers['x-company-id'] ? parseInt(request.headers['x-company-id']) : null;
    const isAdmin = request.user.permissions?.includes('ADMIN.MYCALENDAR.MANAGE');

    try {
        const event = await myCalendarService.updateEvent(id, request.body, userId, companyId, isAdmin);
        return reply.send(event);
    } catch (error) {
        return reply.status(400).send({ message: error.message });
    }
}

async function deleteEvent(request, reply) {
    const { id } = request.params;
    const userId = request.user.userId;
    const companyId = request.headers['x-company-id'] ? parseInt(request.headers['x-company-id']) : null;
    const isAdmin = request.user.permissions?.includes('ADMIN.MYCALENDAR.MANAGE');

    try {
        await myCalendarService.deleteEvent(id, userId, companyId, isAdmin);
        return reply.send({ message: "Événement supprimé" });
    } catch (error) {
        return reply.status(400).send({ message: error.message });
    }
}

async function uploadImage(request, reply) {
    const { id } = request.params;
    const data = await request.file();
    if (!data) return reply.status(400).send({ message: "Aucun fichier fourni" });

    try {
        const event = await myCalendarService.saveEventImage(id, data);
        return reply.send(event);
    } catch (error) {
        return reply.status(400).send({ message: error.message });
    }
}

async function respondInvitation(request, reply) {
    const { id } = request.params;
    const { status } = request.body;
    const userId = request.user.userId;

    try {
        const result = await myCalendarService.respondToInvitation(id, userId, status);
        return reply.send(result);
    } catch (error) {
        return reply.status(400).send({ message: error.message });
    }
}

async function shareEvent(request, reply) {
    const { id } = request.params;
    const { username } = request.body;
    const userId = request.user.userId;

    try {
        const result = await myCalendarService.shareEvent(id, username, userId);
        return reply.send(result);
    } catch (error) {
        return reply.status(400).send({ message: error.message });
    }
}

async function getCategories(request, reply) {
    const userId = request.user.userId;
    const companyId = request.headers['x-company-id'] ? parseInt(request.headers['x-company-id']) : null;

    try {
        const categories = await myCalendarService.getCategories(userId, companyId);
        return reply.send(categories);
    } catch (error) {
        return reply.status(500).send({ message: error.message });
    }
}

async function createCategory(request, reply) {
    const userId = request.user.userId;
    const companyId = request.headers['x-company-id'] ? parseInt(request.headers['x-company-id']) : null;

    try {
        const category = await myCalendarService.createCategory(request.body, userId, companyId);
        return reply.status(201).send(category);
    } catch (error) {
        return reply.status(400).send({ message: error.message });
    }
}

async function deleteCategory(request, reply) {
    const { id } = request.params;
    const userId = request.user.userId;
    const companyId = request.headers['x-company-id'] ? parseInt(request.headers['x-company-id']) : null;

    try {
        await myCalendarService.deleteCategory(id, userId, companyId);
        return reply.send({ message: "Catégorie supprimée" });
    } catch (error) {
        return reply.status(400).send({ message: error.message });
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
