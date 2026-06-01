/**
 * backend/src/events/chat.events.js
 * SSE for Chat — messages + channels + permissions
 */

"use strict";

const jwt = require("jsonwebtoken");
const prisma = require("../db");
const eventBus = require("../lib/eventBusRedis");

const {
    resolvePermissionsForChannel,
} = require("../modules/chat/chat.permissionResolver");

const { EVENTS } = require("../modules/chat/chat.events");

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async function chatEventsRoute(fastify) {
    fastify.get("/chat/events", async (request, reply) => {
        const token = request.query.token;

        if (!token) {
            reply.code(401).send({ message: "Token missing" });
            return;
        }

        // Validate JWT
        let payload;
        try {
            payload = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            reply.code(401).send({ message: "Invalid token" });
            return;
        }

        const userId = payload.userId;
        if (!userId) {
            reply.code(401).send({ message: "Invalid user" });
            return;
        }

        //
        // SSE initialization
        //
        reply.raw.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        });

        if (reply.raw.flushHeaders) reply.raw.flushHeaders();

        function send(event, data = {}) {
            try {
                reply.raw.write(
                    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
                );
            } catch (err) {
                fastify.log.warn("[CHAT SSE] write error:", err?.message);
            }
        }

        // Signal ready
        send("ready", {});

        //
        // ===== HANDLERS: MESSAGES =====
        //
        async function onMessageCreated(data) {
            try {
                const { channelId } = data;
                const perms = await resolvePermissionsForChannel({
                    userId,
                    channelId,
                    prisma,
                });

                if (perms.can.viewChannel) {
                    send("message-created", data);
                }
            } catch (err) {
                fastify.log.warn(
                    "[CHAT SSE] onMessageCreated error:",
                    err?.message
                );
            }
        }

        async function onMessageUpdated(data) {
            try {
                const { channelId } = data;
                const perms = await resolvePermissionsForChannel({
                    userId,
                    channelId,
                    prisma,
                });

                if (perms.can.viewChannel) {
                    send("message-updated", data);
                }
            } catch (err) {
                fastify.log.warn(
                    "[CHAT SSE] onMessageUpdated error:",
                    err?.message
                );
            }
        }

        async function onMessageDeleted(data) {
            try {
                const { channelId } = data;
                const perms = await resolvePermissionsForChannel({
                    userId,
                    channelId,
                    prisma,
                });

                if (perms.can.viewChannel) {
                    send("message-deleted", data);
                }
            } catch (err) {
                fastify.log.warn(
                    "[CHAT SSE] onMessageDeleted error:",
                    err?.message
                );
            }
        }

        //
        // ===== HANDLERS: CHANNELS =====
        //

        // Création : l’utilisateur reçoit uniquement s’il peut voir le canal
        async function onChannelCreated(data) {
            try {
                const { channel } = data;
                if (!channel || !channel.id) return;

                const channelId = String(channel.id);

                const perms = await resolvePermissionsForChannel({
                    userId,
                    channelId,
                    prisma,
                });

                if (perms.can.viewChannel) {
                    send("channel-created", data);
                }
            } catch (err) {
                fastify.log.warn(
                    "[CHAT SSE] onChannelCreated error:",
                    err?.message
                );
            }
        }

        // Update : idem, uniquement si l’utilisateur voit le canal
        async function onChannelUpdated(data) {
            try {
                const { channelId } = data;
                if (!channelId) return;

                const perms = await resolvePermissionsForChannel({
                    userId,
                    channelId,
                    prisma,
                });

                if (perms.can.viewChannel) {
                    send("channel-updated", data);
                }
            } catch (err) {
                fastify.log.warn(
                    "[CHAT SSE] onChannelUpdated error:",
                    err?.message
                );
            }
        }

        // Delete :
        // - On NE peut PLUS recalculer les permissions (canal supprimé).
        // - On envoie l'event tel quel ; le frontend ignora si le salon n'existe pas dans son store.
        async function onChannelDeleted(data) {
            try {
                send("channel-deleted", data);
            } catch (err) {
                fastify.log.warn(
                    "[CHAT SSE] onChannelDeleted error:",
                    err?.message
                );
            }
        }

        //
        // ===== HANDLERS: CATEGORIES =====
        //
        async function onCategoryCreated(data) {
            try {
                send("category-created", data);
            } catch (err) {
                fastify.log.warn("[CHAT SSE] onCategoryCreated error:", err?.message);
            }
        }

        async function onCategoryUpdated(data) {
            try {
                send("category-updated", data);
            } catch (err) {
                fastify.log.warn("[CHAT SSE] onCategoryUpdated error:", err?.message);
            }
        }

        async function onCategoryDeleted(data) {
            try {
                send("category-deleted", data);
            } catch (err) {
                fastify.log.warn("[CHAT SSE] onCategoryDeleted error:", err?.message);
            }
        }

        async function onCategoryPermissionsUpdated(data) {
            try {
                send("category-permissions-updated", data);
            } catch (err) {
                fastify.log.warn("[CHAT SSE] onCategoryPermissionsUpdated error:", err?.message);
            }
        }

        //
        // ===== HANDLERS: PERMISSIONS =====
        //
        async function onPermissionsUpdated(data) {
            try {
                const { channelId } = data;
                if (!channelId) return;

                const perms = await resolvePermissionsForChannel({
                    userId,
                    channelId,
                    prisma,
                });

                if (perms.can.viewChannel) {
                    send("permissions-updated", data);
                } else {
                    // Optionnel : on pourrait aussi notifier le front qu'il a perdu l'accès
                    // en envoyant quand même un event, à traiter côté UI.
                }
            } catch (err) {
                fastify.log.warn(
                    "[CHAT SSE] onPermissionsUpdated error:",
                    err?.message
                );
            }
        }

        //
        // ===== SUBSCRIPTIONS =====
        //
        eventBus.on(EVENTS.MESSAGE_CREATED, onMessageCreated);
        eventBus.on(EVENTS.MESSAGE_UPDATED, onMessageUpdated);
        eventBus.on(EVENTS.MESSAGE_DELETED, onMessageDeleted);

        eventBus.on(EVENTS.CHANNEL_CREATED, onChannelCreated);
        eventBus.on(EVENTS.CHANNEL_UPDATED, onChannelUpdated);
        eventBus.on(EVENTS.CHANNEL_DELETED, onChannelDeleted);

        eventBus.on(EVENTS.PERMISSIONS_UPDATED, onPermissionsUpdated);

        eventBus.on(EVENTS.CATEGORY_CREATED, onCategoryCreated);
        eventBus.on(EVENTS.CATEGORY_UPDATED, onCategoryUpdated);
        eventBus.on(EVENTS.CATEGORY_DELETED, onCategoryDeleted);
        eventBus.on(EVENTS.CATEGORY_PERMISSIONS_UPDATED, onCategoryPermissionsUpdated);

        //
        // KeepAlive
        //
        const keepAlive = setInterval(() => {
            send("ping", {});
        }, 30000);

        //
        // Cleanup
        //
        function cleanup() {
            clearInterval(keepAlive);

            eventBus.off(EVENTS.MESSAGE_CREATED, onMessageCreated);
            eventBus.off(EVENTS.MESSAGE_UPDATED, onMessageUpdated);
            eventBus.off(EVENTS.MESSAGE_DELETED, onMessageDeleted);

            eventBus.off(EVENTS.CHANNEL_CREATED, onChannelCreated);
            eventBus.off(EVENTS.CHANNEL_UPDATED, onChannelUpdated);
            eventBus.off(EVENTS.CHANNEL_DELETED, onChannelDeleted);

            eventBus.off(EVENTS.PERMISSIONS_UPDATED, onPermissionsUpdated);

            eventBus.off(EVENTS.CATEGORY_CREATED, onCategoryCreated);
            eventBus.off(EVENTS.CATEGORY_UPDATED, onCategoryUpdated);
            eventBus.off(EVENTS.CATEGORY_DELETED, onCategoryDeleted);
            eventBus.off(EVENTS.CATEGORY_PERMISSIONS_UPDATED, onCategoryPermissionsUpdated);

            try {
                reply.raw.end();
            } catch {}
        }

        request.raw.on("close", cleanup);
        request.raw.on("aborted", cleanup);
    });
};
