// frontend/src/hooks/useChatMessageWatcher.js
import { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";

/**
 * Écoute SSE: /api/chat/events -> messages en temps réel
 * - message-created
 * - message-edited
 * - message-deleted
 *
 * Fonctionne comme usePermissionWatcher :
 * - Une seule connexion globale
 * - Empêche les doublons (strict mode)
 * - Auto-reconnect géré par EventSource
 */
export default function useChatMessageWatcher(enabled = true) {
    const esRef = useRef(null);

    useEffect(() => {
        if (!enabled) {
            if (esRef.current) {
                try { esRef.current.close(); } catch { /* empty */ }
                esRef.current = null;
            }
            return;
        }

        // Déjà connecté → éviter plusieurs connexions
        if (esRef.current) return;

        const token = localStorage.getItem("accessToken");
        if (!token) return;

        const es = new EventSource(`/api/chat/events?token=${encodeURIComponent(token)}`);
        esRef.current = es;

        //
        // --- HANDLERS ---
        //

        // Nouveau message
        es.addEventListener("message-created", (e) => {
            let payload = {};
            try { payload = JSON.parse(e.data || "{}"); } catch { /* empty */ }

            const channelId = String(payload.channelId);
            if (!channelId) return;

            const normalized = {
                id: String(payload.id),
                channelId,
                content: payload.content,
                createdAt: payload.createdAt,
                editedAt: payload.editedAt,
                authorId: payload.author?.id ?? payload.authorId,
                authorName: payload.author?.name ?? "Utilisateur",
                authorAvatar: payload.author?.imageUrl ?? null,
            };

            useChatStore.setState((state) => {
                const prev = Array.isArray(state.messages[channelId])
                    ? state.messages[channelId]
                    : [];

                // éviter les doublons
                if (prev.some((m) => String(m.id) === normalized.id)) {
                    return state;
                }

                return {
                    messages: {
                        ...state.messages,
                        [channelId]: [...prev, normalized],
                    },
                };
            });
        });

        // Message édité
        es.addEventListener("message-edited", (e) => {
            let payload = {};
            try { payload = JSON.parse(e.data || "{}"); } catch { /* empty */ }

            const channelId = String(payload.channelId);
            if (!channelId) return;

            useChatStore.setState((state) => {
                const prev = state.messages[channelId] || [];

                const next = prev.map((m) =>
                    String(m.id) === String(payload.id)
                        ? { ...m, ...payload }
                        : m
                );

                return {
                    messages: {
                        ...state.messages,
                        [channelId]: next,
                    },
                };
            });
        });

        // Message supprimé
        es.addEventListener("message-deleted", (e) => {
            let payload = {};
            try { payload = JSON.parse(e.data || "{}"); } catch { /* empty */ }

            const channelId = String(payload.channelId);
            if (!channelId) return;

            useChatStore.setState((state) => {
                const prev = state.messages[channelId] || [];
                const next = prev.filter(
                    (m) => String(m.id) !== String(payload.id)
                );

                return {
                    messages: {
                        ...state.messages,
                        [channelId]: next,
                    },
                };
            });
        });

        es.addEventListener("ping", () => {});

        es.onerror = () => {
            console.warn("[SSE chat] erreur, tentative de reconnexion automatique…");
        };

        return () => {
            try { es.close(); } catch { /* empty */ }
            esRef.current = null;
        };
    }, [enabled]);
}
