// /backend/src/modules/calendar/calendar.controller.js
const service = require('./calendar.service');
const prisma = require('../../db');

// Helper pour charger l'acteur avec ses permissions directes ET celles de ses rôles
const loadActor = async (userId) => {
    return prisma.user.findUnique({
        where: { id: userId },
        include: {
            permissions: true,
            roles: { include: { permissions: true } }
        }
    });
};

const getEvents = async (request, reply) => {
    try {
        const actor = await loadActor(request.user.userId);

        const companyId = request.companyId ?? (
            request.headers['x-company-id'] ? parseInt(request.headers['x-company-id'], 10) : null
        );

        const viewMode = request.calendarViewMode || 'SELF';

        const events = await service.getEvents(actor, companyId, request.query, viewMode);
        reply.send(events);
    } catch (error) {
        request.log.error({ msg: "Erreur getEvents", error: error.message });
        reply.code(500).send({ message: error.message });
    }
};

const createEvent = async (request, reply) => {
    try {
        const actor = await loadActor(request.user.userId);
        // Le service attend l'acteur et l'objet de données complet (request.body)
        const event = await service.createEvent(actor, request.body);
        reply.code(201).send(event);
    } catch (error) {
        request.log.error({ msg: "Erreur createEvent", error: error.message, body: request.body });
        reply.code(400).send({ message: error.message });
    }
};

const updateEvent = async (request, reply) => {
    try {
        const actor = await loadActor(request.user.userId);
        const eventId = parseInt(request.params.eventId, 10);
        const event = await service.updateEvent(actor, eventId, request.body);
        reply.send(event);
    } catch (error) {
        request.log.error({ msg: "Erreur updateEvent", error: error.message });
        reply.code(403).send({ message: error.message });
    }
};

const finishEvent = async (request, reply) => {
    try {
        const actor = await loadActor(request.user.userId);
        const eventId = parseInt(request.params.eventId, 10);
        const event = await service.finishEvent(actor, eventId);
        reply.send(event);
    } catch (error) {
        request.log.error({ msg: "Erreur finishEvent", error: error.message });
        reply.code(403).send({ message: error.message });
    }
};

const deleteEvent = async (request, reply) => {
    try {
        const actor = await loadActor(request.user.userId);
        const eventId = parseInt(request.params.eventId, 10);
        await service.deleteEvent(actor, eventId);
        reply.code(204).send();
    } catch (error) {
        request.log.error({ msg: "Erreur deleteEvent", error: error.message });
        reply.code(403).send({ message: error.message });
    }
};

const getCategories = async (request, reply) => {
    try {
        // companyId reste requis dans l'URL pour les catégories
        const companyId = parseInt(request.headers['x-company-id'], 10);
        if (!companyId) return reply.code(400).send({ message: "L'ID de l'entreprise est requis."});
        const categories = await service.getCategories(companyId);
        reply.send(categories);
    } catch (error) {
        request.log.error({ msg: "Erreur getCategories", error: error.message });
        reply.code(500).send({ message: error.message });
    }
};

const createCategory = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        if (!companyId) return reply.code(400).send({ message: "L'ID de l'entreprise est requis."});
        const category = await service.createCategory(companyId, request.body);
        reply.code(201).send(category);
    } catch (error) {
        request.log.error({ msg: "Erreur createCategory", error: error.message });
        reply.code(400).send({ message: error.message });
    }
};

const updateCategory = async (request, reply) => {
    try {
        const categoryId = parseInt(request.params.categoryId, 10);
        // TODO: Ajouter une vérification que la catégorie appartient bien à companyId si nécessaire
        const category = await service.updateCategory(categoryId, request.body);
        reply.send(category);
    } catch (error) {
        request.log.error({ msg: "Erreur updateCategory", error: error.message });
        reply.code(400).send({ message: error.message });
    }
};

const deleteCategory = async (request, reply) => {
    try {
        const categoryId = parseInt(request.params.categoryId, 10);
        // TODO: Ajouter une vérification que la catégorie appartient bien à companyId si nécessaire
        await service.deleteCategory(categoryId);
        reply.code(204).send();
    } catch (error) {
        request.log.error({ msg: "Erreur deleteCategory", error: error.message });
        reply.code(400).send({ message: error.message });
    }
};

module.exports = {
    getEvents, createEvent, updateEvent, finishEvent, deleteEvent,
    getCategories, createCategory, updateCategory, deleteCategory,
};