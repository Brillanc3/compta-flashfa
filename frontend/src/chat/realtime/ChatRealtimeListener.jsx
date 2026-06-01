import { useEffect, useCallback, useRef, useState } from "react";
import { useChatStore } from "@/chat/store/useChatStore";
import { useWebSocket, OPCODES } from "@/contexts/WebSocketContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { queryClient } from "@/utils/queryClient";
import { getChannels, getTotalUnreadCounts } from "@/services/chatService";
import { useDmStore } from "@/chat/store/useDmStore";
import { useAudioNotification } from "@/hooks/useAudioNotification";
import { useQuery } from "@tanstack/react-query";
import { usePresenceStore } from '../store/usePresenceStore';
import { useTypingStore } from '../store/useTypingStore';


/**
 * ChatRealtimeListener
 * - Centralise tous les listeners WS du chat
 * - Gère JOIN / LEAVE des rooms
 * - Doit être monté UNE SEULE FOIS (ex: App.jsx)
 */
export default function ChatRealtimeListener() {
    const { subscribe, unsubscribe, send, connected } = useWebSocket();

    const { user, isAuthenticated } = useAuth();
    const { loading: _companyLoading, isAuthLoading } = useCompany();

    const activeChannelId = useChatStore((s) => s.activeChannelId);
    const initializedCompanyId = useChatStore((s) => s.initializedCompanyId);

    const { play } = useAudioNotification();

    // Ref pour éviter closure stale dans onMessageCreated
    const activeChannelIdRef = useRef(activeChannelId);
    useEffect(() => { activeChannelIdRef.current = activeChannelId; }, [activeChannelId]);

    // Debounce markAsRead pour les messages reçus dans le salon actif
    const markAsReadTimerRef = useRef(null);

    // Query toujours active (composant global) → refetchInterval fonctionne partout
    useQuery({
        queryKey: ["chat", "total-unread-counts"],
        queryFn: getTotalUnreadCounts,
        refetchInterval: 30_000,
        enabled: isAuthenticated && !!user?.id,
    });

    const appendMessageFromEvent =
        useChatStore((s) => s.appendMessageFromEvent);

    const updateMessageFromEvent =
        useChatStore((s) => s.updateMessageFromEvent);

    const deleteMessageFromEvent =
        useChatStore((s) => s.deleteMessageFromEvent);

    /**
     * Rooms join (salons visibles)
     */
    const joinedRoomsRef = useRef(new Set());

    /**
     * Liste de salons visibles (ids) — utilisée pour JOIN rooms même hors /dashboard/chat
     */
    const [visibleChannelIds, setVisibleChannelIds] = useState([]);

    /* =========================================================
       FETCH salons visibles (1) — sans toucher au store
       => permet d'activer le badge non-lu partout
    ========================================================= */
    useEffect(() => {
        if (!isAuthenticated || !user?.id) {
            setVisibleChannelIds([]);
            return;
        }

        if (isAuthLoading) return;

        const cid = Number(initializedCompanyId);
        if (!Number.isFinite(cid) || cid <= 0) {
            setVisibleChannelIds([]);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const raw = await getChannels(initializedCompanyId);
                const channels = Array.isArray(raw)
                    ? raw
                    : Array.isArray(raw?.channels)
                        ? raw.channels
                        : [];

                const ids = channels
                    .map((c) => (c?.id !== undefined && c?.id !== null ? String(c.id) : null))
                    .filter(Boolean);

                if (!cancelled) setVisibleChannelIds(ids);
            } catch {
                if (!cancelled) setVisibleChannelIds([]);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, user?.id, initializedCompanyId, isAuthLoading]);

    /* =========================================================
       Réinitialise les rooms trackées à la déconnexion
       → force un re-JOIN complet sur la prochaine reconnexion
       (le nouveau connectionId serveur ne connaît aucune room)
    ========================================================= */
    useEffect(() => {
        if (!connected) {
            joinedRoomsRef.current = new Set();
        }
    }, [connected]);

    /* =========================================================
       JOIN / LEAVE rooms (salons)
    ========================================================= */
    useEffect(() => {
        if (!connected) return;

        const desired = new Set(
            (visibleChannelIds || []).map((id) => `channel:${String(id)}`)
        );
        if (user?.id) {
            desired.add(`user:${user.id}`);
        }
        if (initializedCompanyId) {
            desired.add(`company:${initializedCompanyId}`);
        }

        const joined = joinedRoomsRef.current || new Set();

        // LEAVE rooms qui n'existent plus / changement company
        for (const room of joined) {
            if (!desired.has(room)) {
                // console.debug("[WS][CHAT] LEAVE", room);
                send(
                    OPCODES.DISPATCH,
                    { room, action: "leave" },
                    "ROOM_SUBSCRIBE"
                );
            }
        }

        // JOIN rooms manquantes
        for (const room of desired) {
            if (!joined.has(room)) {
                // console.debug("[WS][CHAT] JOIN", room);
                send(
                    OPCODES.DISPATCH,
                    { room, action: "join" },
                    "ROOM_SUBSCRIBE"
                );
            }
        }

        joinedRoomsRef.current = desired;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected, send, visibleChannelIds]);

    /* =========================================================
       CLEANUP GLOBAL (unmount)
    ========================================================= */
    useEffect(() => {
        return () => {
            const joined = joinedRoomsRef.current;
            if (!joined || joined.size === 0) return;

            for (const room of joined) {
                send(OPCODES.DISPATCH, { room, action: "leave" }, "ROOM_SUBSCRIBE");
            }

            joinedRoomsRef.current = new Set();
        };
    }, [send]);

    /* =========================================================
       DM MESSAGE CREATED
    ========================================================= */
    const onDmMessageCreated = useCallback((payload) => {
        if (!payload?.message) return;
        const msg = payload.message;
        const myUserId = user?.id;

        // Ignore if sent by myself
        if (payload.authorId !== undefined && myUserId !== undefined && Number(payload.authorId) === Number(myUserId)) {
            return;
        }

        useDmStore.getState().addMessage(msg.conversationId, msg);
        useDmStore.getState().loadConversations();

    }, [user?.id]);

    /* =========================================================
       MESSAGE CREATED
    ========================================================= */
    const onMessageCreated = useCallback((payload) => {
        if (!payload?.message) return;

        const msg = payload.message;
        const channelId = String(msg.channelId);

        // Ignore son propre WS (POST HTTP a déjà injecté)
        const myUserId = user?.id;
        if (
            payload.authorId !== undefined &&
            payload.authorId !== null &&
            myUserId !== undefined &&
            myUserId !== null &&
            Number(payload.authorId) === Number(myUserId)
        ) {
            return;
        }

        appendMessageFromEvent(channelId, msg);

        // Utilisateur déjà dans ce salon : marquer comme lu (debounce 800ms)
        // puis invalider le badge pour refléter l'état réel serveur
        if (String(channelId) === String(activeChannelIdRef.current)) {
            if (markAsReadTimerRef.current) clearTimeout(markAsReadTimerRef.current);
            markAsReadTimerRef.current = setTimeout(() => {
                useChatStore.getState().markAsRead(channelId).then(() => {
                    queryClient.invalidateQueries({ queryKey: ["chat", "total-unread-counts"] });
                });
            }, 800);
            return;
        }

        // Badge global non-lu (sidebar) — seulement pour les autres salons
        queryClient.invalidateQueries({ queryKey: ["chat", "total-unread-counts"] });

        // Sons de notification — passe channelId + categoryId pour le mute par scope
        const content = msg.content || '';
        const categoryId = msg.categoryId ? String(msg.categoryId) : null;
        const scopeIds = [channelId, categoryId].filter(Boolean);
        if (content.includes('@everyone')) {
            play('mention_everyone', scopeIds);
        } else if (myUserId && content.includes(`<@${myUserId}>`)) {
            play('mention_user', scopeIds);
        } else if (/<@&\d+>/.test(content)) {
            play('mention_rank', scopeIds);
        } else {
            play('message', scopeIds);
        }
    }, [appendMessageFromEvent, user?.id, play]);

    /* =========================================================
       Quand l'utilisateur ouvre un salon (read-state HTTP)
       => force refresh du badge (petit délai pour laisser l'API commit)
    ========================================================= */
    useEffect(() => {
        if (!activeChannelId) return;
        const t = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["chat", "total-unread-counts"] });
        }, 350);

        return () => clearTimeout(t);
    }, [activeChannelId]);

    /* =========================================================
       MESSAGE UPDATED
    ========================================================= */
    const onMessageUpdated = useCallback((payload) => {
        if (!payload?.message) return;

        const msg = payload.message;
        updateMessageFromEvent(String(msg.channelId), msg);
    }, [updateMessageFromEvent]);

    /* =========================================================
       MESSAGE DELETED
    ========================================================= */
    const onMessageDeleted = useCallback((payload) => {
        if (!payload?.channelId || !payload?.messageId) return;

        deleteMessageFromEvent(
            String(payload.channelId),
            String(payload.messageId)
        );
    }, [deleteMessageFromEvent]);

    /* =========================================================
       PRESENCE / TYPING / REACTION / PIN HANDLERS
    ========================================================= */
    const onPresenceUpdated = useCallback((payload) => {
        if (!payload?.userId) return;
        usePresenceStore.getState().updatePresence(payload.userId, {
            status: payload.status,
            customEmoji: payload.customEmoji,
            customText: payload.customText,
        });
    }, []);

    const onTypingStart = useCallback((payload) => {
        if (!payload?.channelId || !payload?.userId) return;
        useTypingStore.getState().startTyping(payload.channelId, payload.userId, payload.userName);
    }, []);

    const onTypingStop = useCallback((payload) => {
        if (!payload?.channelId || !payload?.userId) return;
        useTypingStore.getState().stopTyping(payload.channelId, payload.userId);
    }, []);

    const onReactionAdded = useCallback((payload) => {
        if (!payload?.channelId || !payload?.messageId || !payload?.emoji) return;
        useChatStore.getState().addReactionToMessage(payload.channelId, payload.messageId, {
            emoji: payload.emoji,
            userId: payload.userId,
            count: payload.count,
        });
    }, []);

    const onReactionRemoved = useCallback((payload) => {
        if (!payload?.channelId || !payload?.messageId || !payload?.emoji) return;
        useChatStore.getState().removeReactionFromMessage(payload.channelId, payload.messageId, payload.emoji, payload.userId);
    }, []);

    const onMessagePinned = useCallback((payload) => {
        if (!payload?.channelId || !payload?.messageId) return;
        useChatStore.getState().addPin(payload.channelId, payload);
    }, []);

    const onMessageUnpinned = useCallback((payload) => {
        if (!payload?.channelId || !payload?.messageId) return;
        useChatStore.getState().removePin(payload.channelId, payload.messageId);
    }, []);

    /* =========================================================
       SUBSCRIBE EVENTS
    ========================================================= */
    useEffect(() => {
        subscribe("CHAT_MESSAGE_CREATED", onMessageCreated);
        subscribe("CHAT_MESSAGE_UPDATED", onMessageUpdated);
        subscribe("CHAT_MESSAGE_DELETED", onMessageDeleted);
        subscribe("CHAT_DM_MESSAGE_CREATED", onDmMessageCreated);
        subscribe("CHAT_PRESENCE_UPDATED", onPresenceUpdated);
        subscribe("CHAT_TYPING_START", onTypingStart);
        subscribe("CHAT_TYPING_STOP", onTypingStop);
        subscribe("CHAT_REACTION_ADDED", onReactionAdded);
        subscribe("CHAT_REACTION_REMOVED", onReactionRemoved);
        subscribe("CHAT_MESSAGE_PINNED", onMessagePinned);
        subscribe("CHAT_MESSAGE_UNPINNED", onMessageUnpinned);

        return () => {
            unsubscribe("CHAT_MESSAGE_CREATED", onMessageCreated);
            unsubscribe("CHAT_MESSAGE_UPDATED", onMessageUpdated);
            unsubscribe("CHAT_MESSAGE_DELETED", onMessageDeleted);
            unsubscribe("CHAT_DM_MESSAGE_CREATED", onDmMessageCreated);
            unsubscribe("CHAT_PRESENCE_UPDATED", onPresenceUpdated);
            unsubscribe("CHAT_TYPING_START", onTypingStart);
            unsubscribe("CHAT_TYPING_STOP", onTypingStop);
            unsubscribe("CHAT_REACTION_ADDED", onReactionAdded);
            unsubscribe("CHAT_REACTION_REMOVED", onReactionRemoved);
            unsubscribe("CHAT_MESSAGE_PINNED", onMessagePinned);
            unsubscribe("CHAT_MESSAGE_UNPINNED", onMessageUnpinned);
        };
    }, [
        subscribe,
        unsubscribe,
        onMessageCreated,
        onMessageUpdated,
        onMessageDeleted,
        onDmMessageCreated,
        onPresenceUpdated,
        onTypingStart,
        onTypingStop,
        onReactionAdded,
        onReactionRemoved,
        onMessagePinned,
        onMessageUnpinned,
    ]);

    return null;
}