// /backend/src/modules/mycalendar/mycalendar.service.js
const prisma = require('../../db');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'mycalendar');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Get all relevant events for a user
 */
async function getEvents(userId, companyId) {
    return await prisma.myCalendarEvent.findMany({
        where: {
            OR: [
                { authorId: userId }, // Personal events
                { guests: { some: { userId, status: 'ACCEPTED' } } }, // Accepted shared events
                { companyId: companyId ? companyId : -1 }, // Company events
                { isPredefined: true } // Admin events
            ]
        },
        include: {
            category: true,
            author: { select: { id: true, name: true, username: true, imageUrl: true } },
            guests: {
                include: {
                    user: { select: { id: true, name: true, username: true, imageUrl: true } }
                }
            }
        },
        orderBy: { startTime: 'asc' }
    });
}

/**
 * Get pending invitations for a user
 */
async function getPendingInvitations(userId) {
    return await prisma.myCalendarGuest.findMany({
        where: { userId, status: 'PENDING' },
        include: {
            event: {
                include: {
                    author: { select: { id: true, name: true, username: true } }
                }
            }
        }
    });
}

/**
 * Create a new event
 */
async function createEvent(data, authorId, companyId = null) {
    const { title, description, startTime, endTime, color, repetition, categoryId, guests, isPredefined } = data;

    const event = await prisma.myCalendarEvent.create({
        data: {
            title,
            description,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            color,
            repetition,
            authorId,
            companyId: companyId || null,
            categoryId: (categoryId && categoryId !== "") ? parseInt(categoryId) : null,
            isPredefined: !!isPredefined
        }
    });

    // Handle guests if provided
    if (guests && Array.isArray(guests)) {
        for (const guestUsername of guests) {
            const guestUser = await prisma.user.findUnique({ where: { username: guestUsername } });
            if (guestUser && guestUser.id !== authorId) {
                await prisma.myCalendarGuest.create({
                    data: {
                        eventId: event.id,
                        userId: guestUser.id,
                        status: 'PENDING'
                    }
                });
            }
        }
    }

    return event;
}

/**
 * Update an event
 */
async function updateEvent(id, data, userId, companyId = null, isAdmin = false) {
    const event = await prisma.myCalendarEvent.findUnique({ where: { id: parseInt(id) } });
    if (!event) throw new Error("Événement introuvable");

    // Check permissions
    if (!isAdmin && event.authorId !== userId && event.companyId !== companyId) {
        throw new Error("Vous n'avez pas la permission de modifier cet événement");
    }

    if (event.isPredefined && !isAdmin) {
        throw new Error("Impossible de modifier un événement prédéfini");
    }

    const { title, description, startTime, endTime, color, repetition, categoryId } = data;

    return await prisma.myCalendarEvent.update({
        where: { id: parseInt(id) },
        data: {
            title,
            description,
            startTime: startTime ? new Date(startTime) : undefined,
            endTime: endTime ? new Date(endTime) : undefined,
            color,
            repetition,
            categoryId: (categoryId && categoryId !== "") ? parseInt(categoryId) : null
        }
    });
}

/**
 * Delete an event
 */
async function deleteEvent(id, userId, companyId = null, isAdmin = false) {
    const event = await prisma.myCalendarEvent.findUnique({ 
        where: { id: parseInt(id) },
        include: { guests: true }
    });
    if (!event) throw new Error("Événement introuvable");

    // If user is a guest but NOT the author and NOT a company admin
    const isGuest = event.guests.some(g => g.userId === userId);
    const isAuthor = event.authorId === userId;
    const isCompanyEvent = event.companyId && event.companyId === companyId;

    if (isGuest && !isAuthor && !isAdmin && !isCompanyEvent) {
        // Just remove the guest entry
        return await prisma.myCalendarGuest.delete({
            where: {
                eventId_userId: {
                    eventId: event.id,
                    userId: userId
                }
            }
        });
    }

    // Otherwise, perform full delete (only if author or admin)
    if (!isAdmin && !isAuthor && !isCompanyEvent) {
        throw new Error("Vous n'avez pas la permission de supprimer cet événement");
    }

    if (event.isPredefined && !isAdmin) {
        throw new Error("Impossible de supprimer un événement prédéfini");
    }

    // Delete image if exists
    if (event.imageUrl) {
        const imagePath = path.join(__dirname, '..', '..', '..', event.imageUrl.split('?')[0]);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
    }

    return await prisma.myCalendarEvent.delete({ where: { id: parseInt(id) } });
}

/**
 * Process and save event image (WebP)
 */
async function saveEventImage(eventId, fileData) {
    const event = await prisma.myCalendarEvent.findUnique({ where: { id: parseInt(eventId) } });
    if (!event) throw new Error("Événement introuvable");

    const filename = `${crypto.randomBytes(16).toString('hex')}.webp`;
    const relativePath = `uploads/mycalendar/${filename}`;
    const fullPath = path.join(__dirname, '..', '..', '..', relativePath);

    // Compress to WebP using sharp
    await sharp(await fileData.toBuffer())
        .webp({ quality: 80 })
        .toFile(fullPath);

    // Delete old image if exists
    if (event.imageUrl) {
        const oldPath = path.join(__dirname, '..', '..', '..', event.imageUrl.split('?')[0]);
        if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
        }
    }

    const imageUrl = `/${relativePath}?v=${Date.now()}`;
    return await prisma.myCalendarEvent.update({
        where: { id: event.id },
        data: { imageUrl }
    });
}

/**
 * Respond to an invitation
 */
async function respondToInvitation(invitationId, userId, status) {
    const invitation = await prisma.myCalendarGuest.findUnique({
        where: { id: parseInt(invitationId) }
    });

    if (!invitation || invitation.userId !== userId) {
        throw new Error("Invitation introuvable");
    }

    if (!['ACCEPTED', 'REFUSED'].includes(status)) {
        throw new Error("Statut invalide");
    }

    return await prisma.myCalendarGuest.update({
        where: { id: invitation.id },
        data: { status }
    });
}

/**
 * Share an event with a user
 */
async function shareEvent(eventId, username, authorId) {
    const event = await prisma.myCalendarEvent.findUnique({ where: { id: parseInt(eventId) } });
    if (!event || event.authorId !== authorId) {
        throw new Error("Événement introuvable ou vous n'êtes pas l'auteur");
    }

    const targetUser = await prisma.user.findUnique({ where: { username } });
    if (!targetUser) throw new Error("Utilisateur introuvable");

    if (targetUser.id === authorId) throw new Error("Vous ne pouvez pas vous partager un événement à vous-même");

    const existingGuest = await prisma.myCalendarGuest.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: targetUser.id } }
    });

    if (existingGuest) throw new Error("Cet utilisateur est déjà invité");

    return await prisma.myCalendarGuest.create({
        data: {
            eventId: event.id,
            userId: targetUser.id,
            status: 'PENDING'
        }
    });
}

/**
 * Categories CRUD
 */
async function getCategories(userId, companyId = null) {
    return await prisma.myCalendarCategory.findMany({
        where: {
            OR: [
                { userId },
                { companyId: companyId || -1 }
            ]
        },
        orderBy: { name: 'asc' }
    });
}

async function createCategory(data, userId, companyId = null) {
    return await prisma.myCalendarCategory.create({
        data: {
            name: data.name,
            color: data.color || '#FFFFFF',
            userId: companyId ? null : userId,
            companyId: companyId || null
        }
    });
}

async function deleteCategory(id, userId, companyId = null) {
    const category = await prisma.myCalendarCategory.findUnique({ where: { id: parseInt(id) } });
    if (!category) throw new Error("Catégorie introuvable");

    if (category.userId !== userId && category.companyId !== companyId) {
        throw new Error("Vous n'avez pas la permission de supprimer cette catégorie");
    }

    return await prisma.myCalendarCategory.delete({ where: { id: parseInt(id) } });
}

module.exports = {
    getEvents,
    getPendingInvitations,
    createEvent,
    updateEvent,
    deleteEvent,
    saveEventImage,
    respondToInvitation,
    shareEvent,
    getCategories,
    createCategory,
    deleteCategory
};
