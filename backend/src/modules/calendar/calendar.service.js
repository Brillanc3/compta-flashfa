// /backend/src/modules/calendar/calendar.service.js
const prisma = require('../../db');
const { hasPermission } = require('../../middleware/auth');
const { RRule } = require('rrule');
const { PERMISSIONS } = require('./calendar.permissions');
const { _sendSystemMessage } = require('../chat/chat.service');

// Helper pour formater une date ISO en date RRULE (YYYYMMDDTHHMMSSZ)
const toRruleDate = (date) => {
    if (!date) return '';
    const pad = (num) => num.toString().padStart(2, '0');
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
};

// Corrige la chaîne RRULE si elle contient une date ISO non conforme
const formatRruleString = (rruleString) => {
    if (!rruleString || !rruleString.includes('UNTIL')) return rruleString;
    const untilMatch = rruleString.match(/UNTIL=([^;]+)/);
    if (untilMatch && untilMatch[1] && untilMatch[1].includes('-')) {
        const date = new Date(untilMatch[1]);
        const correctedDate = toRruleDate(date);
        return rruleString.replace(untilMatch[1], correctedDate);
    }
    return rruleString;
};

// Agrège toutes les permissions d’un utilisateur
const aggregatePermissions = (actor) => {
    const permissions = new Set(actor?.permissions?.map(p => p.action) || []);
    actor?.roles?.forEach(role => {
        role?.permissions?.forEach(p => permissions.add(p.action));
    });
    return permissions;
};

/**
 * Récupère les événements en fonction des permissions et du scope.
 * viewMode:
 *  - 'ALL'  : voir tous les events de l'entreprise
 *  - 'SELF' : voir uniquement ses events (+ ceux ciblés par son rang)
 */
async function getEvents(actor, selectedCompanyId, filters, viewMode = 'SELF') {
    const { startDate, endDate } = filters;
    if (!startDate || !endDate) throw new Error("Les paramètres 'startDate' et 'endDate' sont requis.");

    const searchRange = { start: new Date(startDate), end: new Date(endDate) };
    const whereConditions = [];

    // 🌐 Événements personnels (hors entreprise) + événements système globaux
    whereConditions.push({ userId: actor.id, companyId: null });
    whereConditions.push({ createdBySystem: true, companyId: null });

    if (selectedCompanyId) {
        // 🔔 Toujours inclure les événements système de l’entreprise
        whereConditions.push({ createdBySystem: true, companyId: selectedCompanyId });

        if (viewMode === 'ALL') {
            // 👁️ ALL : services de tous les employés
            whereConditions.push({
                companyId: selectedCompanyId,
                createdBySystem: false,
            });
        } else {
            // 👤 SELF : ses propres events
            whereConditions.push({
                companyId: selectedCompanyId,
                createdBySystem: false,
                userId: actor.id,
            });

            // + events ciblés par son rang (si rankId)
            const actorCompanyRole = await prisma.companyEmployee.findUnique({
                where: { companyId_userId: { userId: actor.id, companyId: selectedCompanyId } },
                select: { rankId: true },
            });

            if (actorCompanyRole?.rankId) {
                whereConditions.push({
                    companyId: selectedCompanyId,
                    createdBySystem: false,
                    targetRoleId: actorCompanyRole.rankId,
                });
            }
        }
    }

    // --- Requête des événements potentiels ---
    const potentialEvents = await prisma.calendarEvent.findMany({
        where: {
            startTime: { lte: searchRange.end },
            OR: whereConditions,
        },
        include: { category: true, author: { select: { name: true } } },
    });

    // --- Expansion RRULE ---
    const finalEvents = [];
    for (const event of potentialEvents) {
        if (event.rrule) {
            try {
                const correctedRrule = formatRruleString(event.rrule);
                const rule = RRule.fromString(correctedRrule);
                rule.options.dtstart = new Date(event.startTime.toISOString());

                const occurrences = rule.between(
                    new Date(searchRange.start.toISOString()),
                    new Date(searchRange.end.toISOString()),
                    true
                );

                for (const occurrence of occurrences) {
                    const duration = event.endTime
                        ? event.endTime.getTime() - event.startTime.getTime()
                        : 0;

                    const occurrenceEndTime =
                        duration > 0 ? new Date(occurrence.getTime() + duration) : null;

                    finalEvents.push({
                        ...event,
                        id: `${event.id}-${occurrence.toISOString()}`,
                        startTime: occurrence,
                        endTime: occurrenceEndTime,
                    });
                }
            } catch (error) {
                console.error(`Erreur RRULE (${event.id}):`, error);
            }
        } else {
            if (!event.endTime || event.endTime >= searchRange.start) {
                finalEvents.push(event);
            }
        }
    }

    return finalEvents;
}

/**
 * Création d’un événement
 */
async function createEvent(actor, data) {
    const { companyId, targetRoleId, createdBySystem, userId: dataUserId } = data;
    const actorPermissions = aggregatePermissions(actor);
    let subjectId = dataUserId || actor.id;
    const finalCompanyId = companyId === undefined ? null : companyId;

    if (createdBySystem) {
        if (!hasPermission(actorPermissions, 'ADMIN.CALENDAR.MANAGE')) {
            throw new Error("Accès refusé : permission ADMIN.CALENDAR.MANAGE requise.");
        }
    } else if (finalCompanyId) {
        if (targetRoleId) {
            if (!hasPermission(actorPermissions, PERMISSIONS.MANAGE_ALL)) {
                throw new Error("Accès refusé : permission CALENDAR.MANAGE_ALL requise pour créer un événement de rôle.");
            }
        } else if (subjectId !== actor.id) {
            if (!hasPermission(actorPermissions, PERMISSIONS.MANAGE_ALL)) {
                throw new Error("Accès refusé : permission CALENDAR.MANAGE_ALL requise pour créer pour autrui.");
            }
        }
    }

    return _internal_createEvent(data, actor.id);
}

/**
 * Mise à jour d’un événement
 */
async function updateEvent(actor, eventId, data) {
    const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new Error("Événement introuvable.");

    const actorPermissions = aggregatePermissions(actor);
    const isAdmin = hasPermission(actorPermissions, 'ADMIN.CALENDAR.MANAGE');
    const canManageAll = hasPermission(actorPermissions, PERMISSIONS.MANAGE_ALL);

    if (event.createdBySystem && !isAdmin) {
        throw new Error("Accès refusé : les événements système ne peuvent être modifiés que par un admin.");
    }

    if (!isAdmin && !canManageAll && event.authorId !== actor.id) {
        throw new Error("Accès refusé : seul l'auteur, un manager ou un admin peut modifier cet événement.");
    }

    return _internal_updateEvent(eventId, data);
}

/**
 * Termine un événement (définit endTime à maintenant)
 */
async function finishEvent(actor, eventId) {
    const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new Error("Événement introuvable.");

    const actorPermissions = aggregatePermissions(actor);
    const isAdmin = hasPermission(actorPermissions, 'ADMIN.CALENDAR.MANAGE');
    const canManageAll = hasPermission(actorPermissions, PERMISSIONS.MANAGE_ALL);

    if (event.createdBySystem && !isAdmin) {
        throw new Error("Accès refusé : les événements système ne peuvent être terminés que par un admin.");
    }

    if (!isAdmin && !canManageAll && event.authorId !== actor.id) {
        throw new Error("Accès refusé : seul l'auteur, un manager ou un admin peut terminer cet événement.");
    }

    return prisma.calendarEvent.update({
        where: { id: eventId },
        data: { endTime: new Date() }
    });
}

/**
 * Suppression d’un événement
 */
async function deleteEvent(actor, eventId) {
    const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new Error("Événement introuvable.");

    const actorPermissions = aggregatePermissions(actor);
    const isAdmin = hasPermission(actorPermissions, 'ADMIN.CALENDAR.MANAGE');
    const canManageAll = hasPermission(actorPermissions, PERMISSIONS.MANAGE_ALL);

    if (event.createdBySystem && !isAdmin) {
        throw new Error("Accès refusé : les événements système ne peuvent être supprimés que par un admin.");
    }

    if (!isAdmin && !canManageAll && event.authorId !== actor.id) {
        throw new Error("Accès refusé : seul l'auteur, un manager ou un admin peut supprimer cet événement.");
    }

    return _internal_deleteEvent(eventId);
}

// --- Fonctions internes (SANS permissions, utilisées par les handlers) ---
function _internal_createEvent(data, authorId) {
    const { companyId, targetRoleId, createdBySystem, userId: dataUserId, ...coreData } = data;
    const subjectId = dataUserId || authorId;
    const finalCompanyId = companyId === undefined || companyId === null ? null : parseInt(companyId, 10);
    const finalTargetRoleId = targetRoleId === undefined || targetRoleId === null ? null : parseInt(targetRoleId, 10);
    const finalCategoryId = coreData.categoryId === undefined || coreData.categoryId === null ? null : parseInt(coreData.categoryId, 10);

    const prismaData = {
        title: coreData.title,
        description: coreData.description || null,
        startTime: new Date(coreData.startTime),
        endTime: coreData.endTime ? new Date(coreData.endTime) : null,
        isAllDay: coreData.isAllDay || false,
        rrule: coreData.rrule || null,
        categoryId: finalCategoryId,
        createdBySystem: !!createdBySystem,
        companyId: finalCompanyId,
        targetRoleId: finalTargetRoleId,
        userId: subjectId,
        authorId: authorId,
    };

    if (!prismaData.title || !prismaData.startTime) throw new Error("Données invalides internes : titre ou startTime manquant.");
    if (prismaData.endTime && prismaData.endTime < prismaData.startTime) throw new Error("La date de fin ne peut pas être antérieure à la date de début.");

    return prisma.calendarEvent.create({ data: prismaData });
}

async function _internal_updateEvent(eventId, data) {
    const { companyId, targetRoleId, userId, authorId, createdBySystem, ...updateData } = data;
    return prisma.calendarEvent.update({ where: { id: eventId }, data: updateData });
}

async function _internal_deleteEvent(eventId) {
    return prisma.calendarEvent.delete({ where: { id: eventId } });
}

// --- Services Catégories ---
async function getCategories(companyId) {
    if (!companyId) return [];
    return prisma.eventCategory.findMany({ where: { companyId } });
}
async function createCategory(companyId, data) {
    if (!companyId) throw new Error("L'ID de l'entreprise est requis pour créer une catégorie.");
    return prisma.eventCategory.create({ data: { ...data, companyId } });
}
async function updateCategory(categoryId, data) {
    return prisma.eventCategory.update({ where: { id: categoryId }, data });
}
async function deleteCategory(categoryId) {
    return prisma.eventCategory.delete({ where: { id: categoryId } });
}

module.exports = {
    getEvents,
    createEvent,
    updateEvent,
    finishEvent,
    deleteEvent,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    _internal_createEvent,
    _internal_updateEvent,
    _internal_deleteEvent,
};
