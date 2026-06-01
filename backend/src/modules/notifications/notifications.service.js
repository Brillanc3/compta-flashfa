// /backend/src/modules/notifications/notifications.service.js

const prisma = require('../../db');
const { sendMessageToUsers } = require('../../services/webSocket.service');
const { emitGatewayEvent } =
    require('../../core/gateway/gateway.emitter');

/**
 * Service central pour la création de notifications.
 * @param {object} notificationData - Les données de la notification à créer.
 * @param {number[]} notificationData.recipientUserIds - Un tableau des ID des utilisateurs destinataires.
 * @param {object} notificationData.content - L'objet JSON du contenu (ex: { title, body }).
 * @param {string} notificationData.type - Le type de notif (SYSTEM, USER_SPECIFIC, etc.).
 * @param {string} notificationData.behavior - Le comportement (PERMANENT, BLOCKING, etc.).
 * @param {number|null} [notificationData.senderId] - L'ID de l'utilisateur qui envoie (optionnel).
 * @returns {Promise<object|undefined>} La notification créée ou undefined en cas d'erreur.
 */
async function createNotification(notificationData) {
    const {
        recipientUserIds,
        content,
        type,
        behavior,
        senderId = null,
    } = notificationData;

    if (!recipientUserIds || recipientUserIds.length === 0) {
        console.warn("[NotificationService] Tentative de création d'une notification sans destinataire.");
        return;
    }

    try {
        const { newNotification, recipientRows } = await prisma.$transaction(async (tx) => {
            const notification = await tx.notification.create({
                data: {
                    content: JSON.stringify(content),
                    type,
                    behavior,
                    senderId,
                }
            });

            const recipientsData = recipientUserIds.map(userId => ({
                notificationId: notification.id,
                userId: userId,
            }));

            await tx.notificationRecipient.createMany({
                data: recipientsData,
            });

            const recips = await tx.notificationRecipient.findMany({
                where: { notificationId: notification.id }
            });

            return { newNotification: notification, recipientRows: recips };
        });

        for (const recip of recipientRows) {
            emitGatewayEvent({
                scope: 'USER',
                targets: [recip.userId],
                event: 'NOTIFICATION_CREATED',
                payload: {
                    recipientId: recip.id,
                    notificationId: newNotification.id,
                    content: content,
                    behavior: newNotification.behavior,
                    createdAt: newNotification.createdAt,
                    senderId: newNotification.senderId,
                }
            });
        }

        console.log(`[NotificationService] Notification ID ${newNotification.id} créée pour ${recipientUserIds.length} utilisateur(s).`);
        return newNotification;

    } catch (error) {
        console.error("[NotificationService] Erreur lors de la création de la notification :", error);
    }
}

function uniqInts(list) {
    return [...new Set(list.map(Number).filter(Number.isFinite))];
}


async function sendNotificationService({
                                           senderId,
                                           companyId,
                                           targets,
                                           content,
                                           behavior,
                                       }) {
    /* ------------------------------------------------------------------ */
    /* 1️⃣ SÉCURITÉ : expéditeur = employé actif                          */
    /* ------------------------------------------------------------------ */

    if (
        !content ||
        typeof content !== "object" ||
        typeof content.title !== "string" ||
        typeof content.body !== "string"
    ) {
        const err = new Error("Contenu de notification invalide.");
        err.statusCode = 400;
        throw err;
    }

    const employment = await prisma.companyEmployee.findFirst({
        where: {
            userId: senderId,
            companyId,
            status: 'ACTIVE',
        },
        select: { id: true },
    });

    if (!employment) {
        const err = new Error(
            "Vous n'êtes pas employé actif de cette entreprise."
        );
        err.statusCode = 403;
        throw err;
    }

    /* ------------------------------------------------------------------ */
    /* 2️⃣ RÉSOLUTION DES DESTINATAIRES                                   */
    /* ------------------------------------------------------------------ */

    const recipientSet = new Set();

    for (const target of targets) {
        if (target.type === 'ALL') {
            const rows = await prisma.companyEmployee.findMany({
                where: { companyId, status: 'ACTIVE' },
                select: { userId: true },
            });
            rows.forEach(r => recipientSet.add(r.userId));
            continue;
        }

        if (target.type === 'USERS') {
            const rows = await prisma.companyEmployee.findMany({
                where: {
                    companyId,
                    status: 'ACTIVE',
                    userId: { in: target.ids },
                },
                select: { userId: true },
            });
            rows.forEach(r => recipientSet.add(r.userId));
            continue;
        }

        if (target.type === 'RANKS') {
            const rows = await prisma.companyEmployee.findMany({
                where: {
                    companyId,
                    status: 'ACTIVE',
                    rankId: { in: target.ids },
                },
                select: { userId: true },
            });
            rows.forEach(r => recipientSet.add(r.userId));
        }
    }

    const recipientUserIds = [...recipientSet];

    if (recipientUserIds.length === 0) {
        const err = new Error("Aucun destinataire valide trouvé.");
        err.statusCode = 404;
        throw err;
    }

    /* ------------------------------------------------------------------ */
    /* 3️⃣ PERSISTENCE TRANSACTIONNELLE                                   */
    /* ------------------------------------------------------------------ */

    const { notification, recipientRows } = await prisma.$transaction(async (tx) => {
        const notif = await tx.notification.create({
            data: {
                content: JSON.stringify({
                    title: content.title,
                    body: content.body,
                }),
                type: 'USER_SPECIFIC',
                behavior,
                senderId,
            },
        });

        // On insère et on récupère les lignes pour avoir les IDs
        await tx.notificationRecipient.createMany({
            data: recipientUserIds.map(userId => ({
                notificationId: notif.id,
                userId,
            })),
            skipDuplicates: true,
        });

        const recips = await tx.notificationRecipient.findMany({
            where: { notificationId: notif.id }
        });

        return { notification: notif, recipientRows: recips };
    });

    /* ------------------------------------------------------------------ */
    /* 4️⃣ EMISSION GATEWAY (TEMPS RÉEL)                                   */
    /* ------------------------------------------------------------------ */

    // On émet individuellement (ou on pourrait grouper, mais ici l'ID est spécifique par user)
    for (const recip of recipientRows) {
        emitGatewayEvent({
            scope: 'USER',
            targets: [recip.userId],
            event: 'NOTIFICATION_CREATED',
            payload: {
                recipientId: recip.id, // <--- IMPORTANT : l'ID qui permet d'acknowledge
                notificationId: notification.id,
                content: content,
                companyId,
                senderId,
                behavior,
                createdAt: notification.createdAt,
            },
        });
    }

    /* ------------------------------------------------------------------ */
    /* 5️⃣ RÉSULTAT                                                       */
    /* ------------------------------------------------------------------ */

    return {
        notificationId: notification.id,
        recipientCount: recipientUserIds.length,
    };
}

module.exports = {
    sendNotificationService,
};


module.exports = {
    createNotification,
    sendNotificationService
};