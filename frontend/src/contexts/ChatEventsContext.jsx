// frontend/src/contexts/ChatEventsContext.jsx

import React, { createContext, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/chat/store/useChatStore";
import * as chatApi from "@/services/chatService";

// eslint-disable-next-line react-refresh/only-export-components
export const ChatEventsContext = createContext({
    connected: false,
    lastEvent: null,
    lastPermissionsEvent: null,       // { channelId, updated, ts }
    lastCategoryPermissionsEvent: null, // { categoryId, updated, ts }
});

export function ChatEventsProvider({ children }) {
    const [connected, setConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState(null);
    const [lastPermissionsEvent, setLastPermissionsEvent] = useState(null);
    const [lastCategoryPermissionsEvent, setLastCategoryPermissionsEvent] = useState(null);
    const esRef = useRef(null);

    // Normalise un message unique
    const normalizeMessage = (raw) => ({
        id: String(raw.id),
        channelId: String(raw.channelId),
        content: raw.content,
        createdAt: raw.createdAt,
        editedAt: raw.editedAt,
        authorId: raw.authorId ?? raw.author?.id,
        authorName: raw.author?.name || raw.authorName || "Utilisateur",
        authorAvatar: raw.author?.imageUrl || raw.authorAvatar || null,
    });

    useEffect(() => {
        if (esRef.current) return;

        const token = localStorage.getItem("accessToken");
        if (!token) return;

        const es = new EventSource(`/api/chat/events?token=${encodeURIComponent(token)}`);
        esRef.current = es;

        //
        // READY
        //
        es.addEventListener("ready", () => {
            setConnected(true);
            setLastEvent("ready");
            console.debug("[CHAT SSE] connected");
        });

        //
        // PING
        //
        es.addEventListener("ping", () => {
            setLastEvent("ping");
        });

        // =========================================================
        // MESSAGE CREATED
        // =========================================================
        es.addEventListener("message-created", (e) => {
            let payload;
            try {
                payload = JSON.parse(e.data);
            } catch {
                return;
            }

            if (!payload?.message) return;
            const msg = normalizeMessage(payload.message);
            const channelId = msg.channelId;

            useChatStore.setState((state) => {
                const prev = state.messages[channelId] || [];
                return {
                    messages: {
                        ...state.messages,
                        [channelId]: [...prev, msg],
                    },
                };
            });

            setLastEvent("message-created");
        });

        // =========================================================
        // MESSAGE UPDATED
        // =========================================================
        es.addEventListener("message-updated", (e) => {
            let payload;
            try {
                payload = JSON.parse(e.data);
            } catch {
                return;
            }

            if (!payload?.message) return;

            const msg = normalizeMessage(payload.message);
            const channelId = msg.channelId;

            useChatStore.setState((state) => {
                const prev = state.messages[channelId] || [];
                return {
                    messages: {
                        ...state.messages,
                        [channelId]: prev.map((m) =>
                            m.id === msg.id ? { ...m, ...msg } : m
                        ),
                    },
                };
            });

            setLastEvent("message-updated");
        });

        // =========================================================
        // MESSAGE DELETED
        // =========================================================
        es.addEventListener("message-deleted", (e) => {
            let payload;
            try {
                payload = JSON.parse(e.data);
            } catch {
                return;
            }

            const channelId = String(payload.channelId);
            const messageId = String(payload.messageId);

            useChatStore.setState((state) => {
                const prev = state.messages[channelId] || [];
                return {
                    messages: {
                        ...state.messages,
                        [channelId]: prev.filter((m) => m.id !== messageId),
                    },
                };
            });

            setLastEvent("message-deleted");
        });

        // =========================================================
        // CHANNEL CREATED
        // =========================================================
        es.addEventListener("channel-created", (e) => {
            let payload;
            try {
                payload = JSON.parse(e.data);
            } catch {
                return;
            }

            const channel = payload?.channel;
            if (!channel || !channel.id) return;

            const channelId = String(channel.id);

            useChatStore.setState((state) => {
                const exists = state.channels.some(
                    (c) => String(c.id) === channelId
                );
                if (exists) return {};

                return { channels: [...state.channels, channel] };
            });

            setLastEvent("channel-created");
        });

        // =========================================================
        // CHANNEL UPDATED
        // =========================================================
        es.addEventListener("channel-updated", (e) => {
            let payload;
            try {
                payload = JSON.parse(e.data);
            } catch {
                return;
            }

            const channelId = payload?.channelId;
            const updates = payload?.updates;
            if (!channelId || !updates) return;

            const id = String(channelId);

            useChatStore.setState((state) => {
                const updatedChannels = state.channels.map((c) =>
                    String(c.id) === id ? { ...c, ...updates } : c
                );

                const isActive =
                    state.activeChannel &&
                    String(state.activeChannel.id) === id;

                return {
                    channels: updatedChannels,
                    activeChannel: isActive
                        ? { ...state.activeChannel, ...updates }
                        : state.activeChannel,
                };
            });

            setLastEvent("channel-updated");
        });

        // =========================================================
        // CHANNEL DELETED
        // =========================================================
        es.addEventListener("channel-deleted", (e) => {
            let payload;
            try {
                payload = JSON.parse(e.data);
            } catch {
                return;
            }

            const channelId = payload?.channelId;
            if (!channelId) return;

            const id = String(channelId);

            useChatStore.setState((state) => {
                const filtered = state.channels.filter(
                    (c) => String(c.id) !== id
                );

                const messages = { ...state.messages };
                delete messages[id];

                const isActive =
                    String(state.activeChannelId) === id;

                return {
                    channels: filtered,
                    messages,
                    activeChannelId: isActive ? null : state.activeChannelId,
                    activeChannel: isActive ? null : state.activeChannel,
                };
            });

            setLastEvent("channel-deleted");
        });

        // =========================================================
        // PERMISSIONS UPDATED (OPTION A — LOGIQUE DISCORD-LIKE)
        // =========================================================
        es.addEventListener("permissions-updated", async (e) => {
            let payload;
            try {
                payload = JSON.parse(e.data);
            } catch {
                return;
            }

            const channelId = String(payload.channelId);
            if (!channelId) return;

            try {
                // 1. Recharger mes permissions à jour
                const perms = await chatApi.getMyPermissions(channelId);

                const canView = !!(
                    perms?.can?.viewChannel || perms?.VIEW_CHANNEL
                );

                const canSend = !!(
                    perms?.can?.sendMessages || perms?.SEND_MESSAGES
                );

                // 2. Mise à jour locale
                useChatStore.setState((state) => ({
                    permissionsByChannel: {
                        ...state.permissionsByChannel,
                        [channelId]: { canView, canSend },
                    },
                }));

                // 3. Vérifier si l'utilisateur GAGNE l'accès
                const state = useChatStore.getState();
                const alreadyExists = state.channels.some(
                    (c) => String(c.id) === channelId
                );

                if (canView && !alreadyExists) {
                    // 4. Charger le channel et l'ajouter
                    const channel = await chatApi.getChannel(channelId);
                    if (channel && channel.id) {
                        useChatStore.setState((state) => ({
                            channels: [...state.channels, channel],
                        }));
                    }
                }

                // 5. Vérifier si l'utilisateur PERD l'accès
                if (!canView && alreadyExists) {
                    useChatStore.setState((state) => {
                        const filtered = state.channels.filter(
                            (c) => String(c.id) !== channelId
                        );

                        const messages = { ...state.messages };
                        delete messages[channelId];

                        const isActive =
                            String(state.activeChannelId) === channelId;

                        return {
                            channels: filtered,
                            messages,
                            activeChannelId: isActive
                                ? null
                                : state.activeChannelId,
                            activeChannel: isActive
                                ? null
                                : state.activeChannel,
                        };
                    });
                }
            } catch (err) {
                console.warn("[CHAT SSE] permissions-updated handler error:", err);
            }

            setLastPermissionsEvent({ channelId, updated: payload?.updated, ts: Date.now() });
            setLastEvent("permissions-updated");
        });

        // =========================================================
        // CATEGORY CREATED
        // =========================================================
        es.addEventListener("category-created", (e) => {
            let payload;
            try {
                payload = JSON.parse(e.data);
            } catch {
                return;
            }

            const category = payload?.category;
            if (!category || !category.id) return;

            const catId = String(category.id);

            useChatStore.setState((state) => {
                const exists = state.categories.some((c) => String(c.id) === catId);
                if (exists) return {};
                return { categories: [...state.categories, category] };
            });

            setLastEvent("category-created");
        });

        // =========================================================
        // CATEGORY UPDATED
        // =========================================================
        es.addEventListener("category-updated", (e) => {
            let payload;
            try {
                payload = JSON.parse(e.data);
            } catch {
                return;
            }

            const categoryId = payload?.categoryId;
            const updates = payload?.updates;
            if (!categoryId || !updates) return;

            const id = String(categoryId);

            useChatStore.setState((state) => ({
                categories: state.categories.map((c) =>
                    String(c.id) === id ? { ...c, ...updates } : c
                ),
            }));

            setLastEvent("category-updated");
        });

        // =========================================================
        // CATEGORY DELETED
        // =========================================================
        es.addEventListener("category-deleted", (e) => {
            let payload;
            try {
                payload = JSON.parse(e.data);
            } catch {
                return;
            }

            const categoryId = payload?.categoryId;
            if (!categoryId) return;

            const id = String(categoryId);

            useChatStore.setState((state) => ({
                categories: state.categories.filter((c) => String(c.id) !== id),
                channels: state.channels.map((ch) =>
                    String(ch.categoryId) === id ? { ...ch, categoryId: null } : ch
                ),
            }));

            setLastEvent("category-deleted");
        });

        // =========================================================
        // CATEGORY PERMISSIONS UPDATED
        // =========================================================
        es.addEventListener("category-permissions-updated", async (e) => {
            let payload;
            try {
                payload = JSON.parse(e.data);
            } catch {
                return;
            }

            const categoryId = String(payload?.categoryId);
            if (!categoryId) return;

            try {
                const state = useChatStore.getState();
                const channelsInCategory = state.channels.filter(
                    (ch) => String(ch.categoryId) === categoryId
                );

                await Promise.all(
                    channelsInCategory.map(async (ch) => {
                        const channelId = String(ch.id);
                        const perms = await chatApi.getMyPermissions(channelId);

                        const canView = !!(perms?.can?.viewChannel || perms?.VIEW_CHANNEL);
                        const canSend = !!(perms?.can?.sendMessages || perms?.SEND_MESSAGES);

                        useChatStore.setState((s) => ({
                            permissionsByChannel: {
                                ...s.permissionsByChannel,
                                [channelId]: { canView, canSend },
                            },
                        }));

                        const current = useChatStore.getState();
                        const alreadyInList = current.channels.some(
                            (c) => String(c.id) === channelId
                        );

                        if (canView && !alreadyInList) {
                            const channel = await chatApi.getChannel(channelId);
                            if (channel?.id) {
                                useChatStore.setState((s) => ({
                                    channels: [...s.channels, channel],
                                }));
                            }
                        }

                        if (!canView && alreadyInList) {
                            useChatStore.setState((s) => {
                                const filtered = s.channels.filter(
                                    (c) => String(c.id) !== channelId
                                );
                                const messages = { ...s.messages };
                                delete messages[channelId];
                                const isActive = String(s.activeChannelId) === channelId;
                                return {
                                    channels: filtered,
                                    messages,
                                    activeChannelId: isActive ? null : s.activeChannelId,
                                    activeChannel: isActive ? null : s.activeChannel,
                                };
                            });
                        }
                    })
                );
            } catch (err) {
                console.warn("[CHAT SSE] category-permissions-updated handler error:", err);
            }

            setLastCategoryPermissionsEvent({ categoryId, updated: payload?.updated, ts: Date.now() });
            setLastEvent("category-permissions-updated");
        });

        //
        // ERROR
        //
        es.onerror = () => {
            console.warn("[CHAT SSE] connection error");
            setConnected(false);
        };

        //
        // CLEANUP
        //
        return () => {
            try {
                es.close();
            } catch { /* empty */ }
            esRef.current = null;
            setConnected(false);
        };
    }, []);

    return (
        <ChatEventsContext.Provider value={{ connected, lastEvent, lastPermissionsEvent, lastCategoryPermissionsEvent }}>
            {children}
        </ChatEventsContext.Provider>
    );
}
