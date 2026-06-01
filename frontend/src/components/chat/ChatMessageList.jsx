// frontend/src/components/chat/ChatMessageList.jsx
import React, { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

/**
 * Composant d'affichage de la zone de messages
 * - auto-scroll au bas
 * - glass theme
 * - overflow dynamique (pas de scroll quand vide)
 */
export default function ChatMessageList({
                                            activeConversation,
                                            messages,
                                            aiMessages,
                                            loading,
                                            selfUserId,
                                            onContextMenuMessage,
                                        }) {
    const containerRef = useRef(null);

    /* -------------------------------------------------------
     * Auto-scroll lorsque messages changent
     * ------------------------------------------------------- */
    useEffect(() => {
        if (!containerRef.current) return;
        setTimeout(() => {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: "smooth",
            });
        }, 10);
    }, [messages, aiMessages, activeConversation]);

    /* -------------------------------------------------------
     * Détermination du scroll dynamique
     * ------------------------------------------------------- */
    const hasMessages =
        activeConversation?.kind === "AI"
            ? aiMessages.length > 0
            : messages.length > 0;

    /* -------------------------------------------------------
     * Cas : aucune conversation sélectionnée
     * ------------------------------------------------------- */
    if (!activeConversation) {
        return (
            <div className="
                flex-1 grid place-items-center
                text-slate-400 text-sm
                bg-slate-900/30 backdrop-blur-xl
            ">
                Sélectionnez une conversation ou utilisez l’Assistant IA.
            </div>
        );
    }

    /* -------------------------------------------------------
     * Cas : chargement des messages
     * ------------------------------------------------------- */
    if (loading && activeConversation.kind !== "AI") {
        return (
            <div className="
                flex-1 grid place-items-center
                text-slate-400 text-sm
                bg-slate-900/30 backdrop-blur-xl
            ">
                Chargement…
            </div>
        );
    }

    /* -------------------------------------------------------
     * Rendu principal
     * ------------------------------------------------------- */
    return (
        <div
            ref={containerRef}
            className={`
                flex-1 p-3 space-y-3 transition-all
                bg-slate-900/30 backdrop-blur-xl

                ${
                hasMessages
                    ? "overflow-y-auto glass-scroll"
                    : "overflow-hidden"
            }
            `}
        >
            {/* IA */}
            {activeConversation.kind === "AI" &&
                aiMessages.map((m) => (
                    <MessageBubble
                        key={m.id}
                        message={m}
                        selfUserId={selfUserId}
                        onContextMenu={onContextMenuMessage}
                    />
                ))}

            {/* Conversations réelles */}
            {activeConversation.kind !== "AI" &&
                messages.map((m) => (
                    <MessageBubble
                        key={m.id}
                        message={m}
                        selfUserId={selfUserId}
                        onContextMenu={onContextMenuMessage}
                    />
                ))}

            {/* Ancre bas pour auto-scroll */}
            <div id="chat-bottom" />
        </div>
    );
}
