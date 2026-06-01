// /backend/src/lib/ticketsQueueRedis.js
//
// BullMQ - Queue dédiée aux tickets (auto-close après demande de clôture).
//
// IMPORTANT (architecture shards) :
// - Le PRODUCER (enqueue/cancel) peut tourner dans un shard "server".
// - Le WORKER doit tourner dans le shard "master" (stable long-terme).
// => Le worker est démarré explicitement via startWorker() (pas d'auto-start au require).
//

const IORedis = require('ioredis');
const { Queue, Worker } = require('bullmq');
const prisma = require('../db');
const { emitGatewayEvent } = require('../core/gateway/gateway.emitter');

const REDIS_URL = process.env.REDIS_URL;
const QUEUE_NAME = 'tickets-queue';
const INACTIVITY_MS = parseInt(process.env.TICKET_INACTIVITY_DAYS || '7', 10) * 24 * 60 * 60 * 1000;

const ioredisOpts = { 
    maxRetriesPerRequest: null
};
const prefix = process.env.ENV === 'dev' ? 'dev:bull' : 'bull';

// Producer (toujours dispo)
const producerClient = new IORedis(REDIS_URL, ioredisOpts);
const queue = new Queue(QUEUE_NAME, { connection: producerClient, prefix });

// Worker (master only)
let worker = null;
let workerClient = null;
let workerStarted = false;

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

async function createUserNotification({ recipientUserIds, content, type, behavior, senderId }) {
    if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) return;

    const notification = await prisma.$transaction(async (tx) => {
        const notif = await tx.notification.create({
            data: {
                content: JSON.stringify(content),
                type,
                behavior,
                senderId: senderId ?? null,
            },
        });

        await tx.notificationRecipient.createMany({
            data: recipientUserIds.map((userId) => ({
                notificationId: notif.id,
                userId,
            })),
        });

        return notif;
    });

    // Front écoute NOTIFICATION_CREATED via Gateway WS
    emitGatewayEvent({
        scope: 'USER',
        targets: recipientUserIds,
        event: 'NOTIFICATION_CREATED',
        payload: {
            notificationId: notification.id,
            content,
            companyId: null,
            senderId: senderId ?? null,
            behavior,
            createdAt: notification.createdAt,
        },
    });

    return notification;
}

/* -------------------------------------------------------------------------- */
/* Worker                                                                      */
/* -------------------------------------------------------------------------- */

function _jobIdForAutoClose(ticketId) {
    return `ticket:${ticketId}:autoClose`;
}

async function startWorker() {
    if (workerStarted) return;
    workerStarted = true;

    workerClient = new IORedis(REDIS_URL, ioredisOpts);

    worker = new Worker(
        QUEUE_NAME,
        async (job) => {
            if (job.name === 'AUTO_CLOSE_INACTIVE_SWEEP') {
                const threshold = new Date(Date.now() - INACTIVITY_MS);
                const staleTickets = await prisma.ticket.findMany({
                    where: {
                        status: 'WAITING_USER',
                        lastMessageAt: { lt: threshold },
                    },
                    select: { id: true, createdById: true, assigneeId: true },
                });

                await Promise.all(staleTickets.map(async (t) => {
                    await prisma.ticket.update({
                        where: { id: t.id },
                        data: {
                            status: 'CLOSED',
                            closedAt: new Date(),
                            closureRequestedAt: null,
                            closureRequestedById: null,
                            closureDeadlineAt: null,
                        },
                    });
                    await createUserNotification({
                        recipientUserIds: [t.createdById],
                        senderId: t.assigneeId ?? null,
                        type: 'USER_SPECIFIC',
                        behavior: 'PERMANENT',
                        content: {
                            title: 'Ticket fermé',
                            body: `Le ticket #${t.id} a été fermé automatiquement (inactivité prolongée).`,
                            ticketId: t.id,
                        },
                    });
                }));

                console.log(`[tickets-queue] sweep closed ${staleTickets.length} inactive tickets`);
                return;
            }

            const { ticketId } = job.data || {};
            if (!ticketId) throw new Error('Missing ticketId in job data');

            const ticket = await prisma.ticket.findUnique({
                where: { id: ticketId },
                select: {
                    id: true,
                    status: true,
                    createdById: true,
                    assigneeId: true,
                    closureRequestedById: true,
                    closureDeadlineAt: true,
                },
            });

            if (!ticket) return;

            // Ne ferme que les tickets en demande de clôture
            if (ticket.status !== 'CLOSURE_REQUESTED') return;

            const now = new Date();
            if (ticket.closureDeadlineAt && ticket.closureDeadlineAt.getTime() > now.getTime()) return;

            const updated = await prisma.ticket.update({
                where: { id: ticketId },
                data: {
                    status: 'CLOSED',
                    closedAt: now,
                    closureRequestedAt: null,
                    closureRequestedById: null,
                    closureDeadlineAt: null,
                },
            });

            // Notifie le demandeur (USER)
            await createUserNotification({
                recipientUserIds: [ticket.createdById],
                senderId: ticket.closureRequestedById ?? ticket.assigneeId ?? null,
                type: 'USER_SPECIFIC',
                behavior: 'PERMANENT',
                content: {
                    title: 'Ticket fermé',
                    body: "Le ticket a été fermé automatiquement (aucune réponse dans les 24h).",
                    ticketId: updated.id,
                },
            });
        },
        { connection: workerClient, concurrency: 2, prefix }
    );

    // Cron sweep: ferme les tickets WAITING_USER inactifs
    await queue.add('AUTO_CLOSE_INACTIVE_SWEEP', {}, {
        repeat: { every: 60 * 60 * 1000 }, // toutes les heures
        removeOnComplete: true,
        removeOnFail: false,
    });

    worker.on('failed', (job, err) => {
        console.error('[tickets-queue] job failed', job?.id, err);
    });

    console.log('[tickets-queue] worker started');
}

/* -------------------------------------------------------------------------- */
/* Producer API                                                                */
/* -------------------------------------------------------------------------- */

async function enqueueAutoClose({ ticketId, deadlineAt }) {
    if (!ticketId) throw new Error('ticketId is required');
    const deadline = new Date(deadlineAt);
    const delay = Math.max(0, deadline.getTime() - Date.now());

    return queue.add(
        'AUTO_CLOSE_TICKET',
        { ticketId },
        {
            jobId: _jobIdForAutoClose(ticketId),
            delay,
            removeOnComplete: true,
            removeOnFail: false,
        }
    );
}

async function cancelAutoClose(ticketId) {
    if (!ticketId) return;
    try {
        await queue.remove(_jobIdForAutoClose(ticketId));
    } catch (e) {
        // ignore not found / already processed
    }
}

async function close() {
    try { if (worker) await worker.close(); } catch (e) {}
    try { if (queue) await queue.close(); } catch (e) {}
    try { if (producerClient) await producerClient.quit(); } catch (e) {}
    try { if (workerClient) await workerClient.quit(); } catch (e) {}
}

module.exports = {
    startWorker,
    enqueueAutoClose,
    cancelAutoClose,
    close,
    _internal: { queue },
};
