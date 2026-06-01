// frontend/src/components/chat/ChatSidebar.jsx
import React, { useState } from "react";
import dayjs from "dayjs";
import { Bot, Plus, MessageSquarePlus, Hash, Users, ChevronLeft } from "lucide-react";
import Badge from "./SidebarBadge";

/* -------------------------------------------------------------------
 * Sidebar du chat
 * ------------------------------------------------------------------- */
export default function ChatSidebar({
                                        conversations,
                                        activeConversation,
                                        aiMessages,
                                        aiBusy,
                                        selectedCompany,
                                        _canManageTickets,
                                        onSelectConversation,
                                        onOpenDiscussion,
                                        onOpenTicket,
                                        onContextMenuConversation,
                                    }) {
    const [showTickets, setShowTickets] = useState(true);
    const [showDiscussions, setShowDiscussions] = useState(true);

    const grouped = {
        tickets: conversations.filter((c) => c.kind === "TICKET"),
        discussions: conversations.filter((c) => c.kind !== "TICKET"),
    };

    const isAIVisible = Boolean(selectedCompany?.id);

    return (
        <aside className="md:w-80 md:shrink-0">
            <div className="
                bg-slate-800/60 border border-slate-700 rounded-2xl
                overflow-hidden backdrop-blur-xl shadow-xl
            ">
                {/* Header */}
                <div className="p-3 flex items-center justify-between border-b border-slate-700">
                    <h2 className="text-sm font-semibold text-slate-200">Conversations</h2>

                    <div className="flex gap-2">
                        {/* Assistant IA */}
                        <button
                            onClick={() => onSelectConversation({ id: "AI", kind: "AI", title: "Assistant IA" })}
                            disabled={!isAIVisible}
                            className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600
                                       text-slate-100 disabled:opacity-50"
                            title={isAIVisible ? "Assistant IA" : "Entreprise requise"}
                        >
                            <Bot size={16} />
                        </button>

                        {/* Nouvelle discussion */}
                        <button
                            onClick={onOpenDiscussion}
                            disabled={!selectedCompany?.id}
                            className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600
                                       text-slate-100 disabled:opacity-50"
                            title="Nouvelle discussion"
                        >
                            <Plus size={16} />
                        </button>

                        {/* Nouveau ticket */}
                        <button
                            onClick={onOpenTicket}
                            className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
                            title="Ouvrir un ticket"
                        >
                            <MessageSquarePlus size={16} />
                        </button>
                    </div>
                </div>

                {/* Assistant IA preview */}
                {isAIVisible && (
                    <div className="p-2 border-b border-slate-700/60">
                        <button
                            onClick={() => onSelectConversation({ id: "AI", kind: "AI", title: "Assistant IA" })}
                            className={`
                                w-full text-left px-3 py-2 rounded-lg border transition
                                ${
                                activeConversation?.kind === "AI"
                                    ? "bg-slate-700/60 border-slate-600"
                                    : "bg-slate-900/30 border-slate-800 hover:bg-slate-800/40"
                            }
                            `}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm text-slate-100 flex items-center gap-2">
                                    <Bot size={14} className="text-slate-400" />
                                    <span>Assistant IA</span>
                                </div>
                                {aiBusy && <span className="animate-spin text-slate-400">⏳</span>}
                            </div>

                            <div className="text-xs text-slate-400 truncate mt-1">
                                {aiMessages.length
                                    ? aiMessages[aiMessages.length - 1]?.content
                                    : "Posez votre question…"}
                            </div>
                        </button>
                    </div>
                )}

                {/* ---------------- Tickets ---------------- */}
                <div className="p-2">
                    <button
                        onClick={() => setShowTickets((v) => !v)}
                        className="w-full flex items-center justify-between px-2 py-1
                                   text-[11px] uppercase tracking-wide text-slate-400 hover:text-slate-200"
                    >
                        <span>Tickets</span>
                        <ChevronLeft
                            size={14}
                            className={`transition-transform ${
                                showTickets ? "rotate-90" : "-rotate-90"
                            }`}
                        />
                    </button>

                    {showTickets && (
                        <ul className="space-y-1 mt-1">
                            {grouped.tickets.length === 0 && (
                                <li className="px-3 py-6 text-center text-sm text-slate-500">Aucun ticket</li>
                            )}

                            {grouped.tickets.map((c) => {
                                const closed = c.ticketStatus === "CLOSE";

                                return (
                                    <li
                                        key={c.id}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            onContextMenuConversation?.(e, c);
                                        }}
                                    >
                                        <button
                                            onClick={() => onSelectConversation(c)}
                                            className={`
                                                w-full text-left px-3 py-2 rounded-lg border transition
                                                ${
                                                activeConversation &&
                                                String(activeConversation.id) === String(c.id)
                                                    ? "bg-slate-700/60 border-slate-600"
                                                    : "bg-slate-900/30 border-slate-800 hover:bg-slate-800/40"
                                            }
                                            `}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-sm text-slate-100 flex items-center gap-2">
                                                    <Hash size={14} className="text-slate-400" />
                                                    <span className="truncate">
                                                        {c.title || `Ticket ${c.ticketCategory ?? ""}`}
                                                    </span>
                                                </div>
                                                <Badge color={closed ? "red" : "green"}>
                                                    {closed ? "Fermé" : "Ouvert"}
                                                </Badge>
                                            </div>

                                            {c.lastMessagePreview && (
                                                <div className="text-xs text-slate-400 truncate mt-1">
                                                    {c.lastMessagePreview}
                                                </div>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* ---------------- Discussions ---------------- */}
                <div className="p-2 border-t border-slate-700/60">
                    <button
                        onClick={() => setShowDiscussions((v) => !v)}
                        className="w-full flex items-center justify-between px-2 py-1
                                   text-[11px] uppercase tracking-wide text-slate-400 hover:text-slate-200"
                    >
                        <span>Discussions</span>
                        <ChevronLeft
                            size={14}
                            className={`transition-transform ${
                                showDiscussions ? "rotate-90" : "-rotate-90"
                            }`}
                        />
                    </button>

                    {showDiscussions && (
                        <ul className="space-y-1 mt-1">
                            {grouped.discussions.length === 0 && (
                                <li className="px-3 py-6 text-center text-sm text-slate-500">
                                    Aucune discussion
                                </li>
                            )}

                            {grouped.discussions.map((c) => (
                                <li
                                    key={c.id}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        onContextMenuConversation?.(e, c);
                                    }}
                                >
                                    <button
                                        onClick={() => onSelectConversation(c)}
                                        className={`
                                            w-full text-left px-3 py-2 rounded-lg border transition
                                            ${
                                            activeConversation &&
                                            String(activeConversation.id) === String(c.id)
                                                ? "bg-slate-700/60 border-slate-600"
                                                : "bg-slate-900/30 border-slate-800 hover:bg-slate-800/40"
                                        }
                                        `}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-sm text-slate-100 flex items-center gap-2">
                                                <Users size={14} className="text-slate-400" />
                                                <span className="truncate">
                                                    {c.title || "Discussion"}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {c.lastActivityAt
                                                    ? dayjs(c.lastActivityAt).format("DD/MM HH:mm")
                                                    : ""}
                                            </div>
                                        </div>

                                        {c.lastMessagePreview && (
                                            <div className="text-xs text-slate-400 truncate mt-1">
                                                {c.lastMessagePreview}
                                            </div>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </aside>
    );
}
