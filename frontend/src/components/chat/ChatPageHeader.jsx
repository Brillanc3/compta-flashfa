// frontend/src/components/chat/ChatPageHeader.jsx
import React from "react";
import {
    ChevronLeft,
    ArrowRightLeft,
    CheckCircle2,
    Bot,
} from "lucide-react";

const TICKET_CATEGORIES = [
    "GENERAL",
    "BILLING",
    "TECHNICAL",
    "CONTACT",
    "OTHER",
];

/* -------------------------------------------------------------------
 * Header du Chat (titre, tags, actions ticket, retour mobile)
 * ------------------------------------------------------------------- */
export default function ChatPageHeader({
                                           activeConversation,
                                           ticketCategoryChoice,
                                           setTicketCategoryChoice,
                                           canManageTickets,
                                           onCloseTicket,
                                           onMigrateTicket,
                                           onBack,
                                       }) {
    if (!activeConversation) {
        return (
            <div className="
                p-3 border-b border-slate-700
                bg-slate-800/60 backdrop-blur-xl
                text-slate-300 text-sm
            ">
                Messages
            </div>
        );
    }

    const isAI = activeConversation.kind === "AI";
    const isTicket = activeConversation.kind === "TICKET";
    const closed = activeConversation.ticketStatus === "CLOSE";

    /* --------------------------------------------------------------
     * Titre dynamique
     * -------------------------------------------------------------- */
    const headerTitle = isAI
        ? "Assistant IA"
        : isTicket
            ? `${activeConversation.title || "Ticket"} • ${
                closed ? "Fermé" : "Ouvert"
            }`
            : activeConversation.title || "Discussion";

    /* --------------------------------------------------------------
     * Rendu
     * -------------------------------------------------------------- */
    return (
        <div
            className="
                p-3 flex items-center justify-between border-b border-slate-700
                bg-slate-800/60 backdrop-blur-xl shadow
            "
        >
            {/* -------------------- LEFT -------------------- */}
            <div className="flex items-center gap-2 overflow-hidden">
                {/* Bouton retour mobile */}
                <button
                    onClick={onBack}
                    className="md:hidden p-1.5 rounded-lg hover:bg-slate-700/60"
                    aria-label="Retour"
                >
                    <ChevronLeft size={18} />
                </button>

                {/* Titre */}
                <h2 className="
                    text-sm font-semibold text-slate-200 truncate
                ">
                    {headerTitle}
                </h2>

                {/* Tag IA */}
                {isAI && (
                    <span
                        className="
                            ml-2 text-[11px] px-2 py-0.5 rounded-full
                            bg-slate-700 text-slate-200 inline-flex items-center gap-1
                        "
                    >
                        <Bot size={12} className="text-slate-300" />
                        Local
                    </span>
                )}

                {/* Tag catégorie ticket */}
                {isTicket && activeConversation.ticketCategory && (
                    <span
                        className="
                            ml-2 text-[11px] px-2 py-0.5 rounded-full
                            bg-slate-700 text-slate-200 truncate
                        "
                    >
                        {activeConversation.ticketCategory}
                    </span>
                )}
            </div>

            {/* -------------------- RIGHT (ticket actions) -------------------- */}
            {isTicket && canManageTickets && (
                <div className="flex items-center gap-2">
                    {/* Sélecteur catégorie */}
                    {!closed && (
                        <select
                            className="
                                px-2 py-1 rounded-lg bg-slate-700 text-slate-100
                                border border-slate-600 text-xs
                            "
                            value={ticketCategoryChoice}
                            onChange={(e) => setTicketCategoryChoice(e.target.value)}
                        >
                            {TICKET_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Migrer ticket */}
                    {!closed && (
                        <button
                            onClick={() => onMigrateTicket(activeConversation, ticketCategoryChoice)}
                            className="
                                flex items-center gap-1 px-2 py-1 rounded-lg
                                bg-slate-700 hover:bg-slate-600 text-slate-100
                                text-xs
                            "
                            title="Migrer vers une autre catégorie"
                        >
                            <ArrowRightLeft size={14} />
                            Migrer
                        </button>
                    )}

                    {/* Clôturer ticket */}
                    {!closed && (
                        <button
                            onClick={() => onCloseTicket(activeConversation)}
                            className="
                                flex items-center gap-1 px-2 py-1 rounded-lg
                                bg-emerald-700 hover:bg-emerald-600 text-white
                                text-xs
                            "
                            title="Clôturer le ticket"
                        >
                            <CheckCircle2 size={14} />
                            Clôturer
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
