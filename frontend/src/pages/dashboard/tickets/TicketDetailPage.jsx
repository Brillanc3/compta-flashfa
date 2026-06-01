// frontend/src/pages/dashboard/tickets/TicketDetailPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import Spinner from "@/components/ui/Spinner";
import { queryClient } from "@/utils/queryClient";

import {
    closeMyTicket,
    getMyTicket,
    listMyTicketMessages,
    postMyTicketMessage,
    reopenMyTicket,
    TICKET_STATUSES,
} from "@/services/ticketsService";

function fmtDate(d) {
    if (!d) return "-";
    try {
        return new Date(d).toLocaleString("fr-FR");
    } catch {
        return String(d);
    }
}

function StatusBadge({ status }) {
    const map = {
        [TICKET_STATUSES.OPEN]: { label: "Ouvert", cls: "bg-slate-600/20 text-slate-200" },
        [TICKET_STATUSES.ASSIGNED]: { label: "Assigné", cls: "bg-indigo-600/20 text-indigo-200" },
        [TICKET_STATUSES.WAITING_AGENT]: { label: "En attente agent", cls: "bg-yellow-600/20 text-yellow-200" },
        [TICKET_STATUSES.WAITING_USER]: { label: "En attente réponse", cls: "bg-emerald-600/20 text-emerald-200" },
        [TICKET_STATUSES.CLOSURE_REQUESTED]: { label: "Clôture demandée", cls: "bg-orange-600/20 text-orange-200" },
        [TICKET_STATUSES.CLOSED]: { label: "Fermé", cls: "bg-slate-700/40 text-slate-300" },
    };

    const it = map[String(status || "").toUpperCase()] || {
        label: status || "-",
        cls: "bg-slate-700/40 text-slate-200",
    };

    return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${it.cls}`}>
            {it.label}
        </span>
    );
}

function MessageBubble({ m, isMe }) {
    const name = m?.author?.name || m?.author?.username || (isMe ? "Moi" : "Admin");
    return (
        <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
            <div
                className={[
                    "max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 border",
                    isMe
                        ? "bg-indigo-600/15 border-indigo-600/30 text-slate-100"
                        : "bg-slate-900/60 border-slate-700 text-slate-100",
                ].join(" ")}
            >
                <div className="text-[11px] text-slate-400 flex items-center justify-between gap-3">
                    <span className="truncate">{name}</span>
                    <span className="shrink-0">{fmtDate(m.createdAt)}</span>
                </div>
                <div className="mt-1 whitespace-pre-wrap break-words text-sm">{m.content}</div>
            </div>
        </div>
    );
}

export default function TicketDetailPage() {
    const navigate = useNavigate();
    const { ticketId } = useParams();

    const id = useMemo(() => {
        const n = parseInt(ticketId, 10);
        return Number.isInteger(n) ? n : null;
    }, [ticketId]);

    const [message, setMessage] = useState("");
    const bottomRef = useRef(null);

    const ticketQuery = useQuery({
        queryKey: ["tickets", "my", "detail", id],
        enabled: !!id,
        queryFn: () => getMyTicket(id),
        staleTime: 10_000,
    });

    const messagesQuery = useQuery({
        queryKey: ["tickets", "my", "messages", id],
        enabled: !!id,
        queryFn: () => listMyTicketMessages(id, { page: 1, pageSize: 200 }),
        staleTime: 5_000,
    });

    const ticket = ticketQuery.data?.ticket || ticketQuery.data;
    const messages = messagesQuery.data?.data || [];

    // Scroll bottom on load/update
    useEffect(() => {
        if (!bottomRef.current) return;
        bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages.length]);

    const postMutation = useMutation({
        mutationFn: async () => postMyTicketMessage(id, { content: message }),
        onSuccess: async () => {
            setMessage("");
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["tickets", "my", "messages", id] }),
                queryClient.invalidateQueries({ queryKey: ["tickets", "my", "detail", id] }),
                queryClient.invalidateQueries({ queryKey: ["tickets", "my", "list"] }),
            ]);
        },
        onError: (e) => {
            toast.error(e?.response?.data?.message || e?.message || "Erreur envoi message");
        },
    });

    const closeMutation = useMutation({
        mutationFn: async () => closeMyTicket(id),
        onSuccess: async () => {
            toast.success("Ticket fermé");
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["tickets", "my", "detail", id] }),
                queryClient.invalidateQueries({ queryKey: ["tickets", "my", "list"] }),
            ]);
        },
        onError: (e) => toast.error(e?.response?.data?.message || e?.message || "Erreur fermeture"),
    });

    const reopenMutation = useMutation({
        mutationFn: async () => reopenMyTicket(id),
        onSuccess: async () => {
            toast.success("Ticket réouvert");
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["tickets", "my", "detail", id] }),
                queryClient.invalidateQueries({ queryKey: ["tickets", "my", "messages", id] }),
                queryClient.invalidateQueries({ queryKey: ["tickets", "my", "list"] }),
            ]);
        },
        onError: (e) => {
            const msg = e?.response?.data?.message || e?.message || "Erreur réouverture";
            toast.error(msg);
        },
    });

    const canSend = useMemo(() => {
        const tStatus = String(ticket?.status || "").toUpperCase();
        return tStatus !== TICKET_STATUSES.CLOSED;
    }, [ticket?.status]);

    const isClosed = String(ticket?.status || "").toUpperCase() === TICKET_STATUSES.CLOSED;
    const isClosureRequested = String(ticket?.status || "").toUpperCase() === TICKET_STATUSES.CLOSURE_REQUESTED;

    const submit = (e) => {
        e.preventDefault();
        const txt = String(message || "").trim();
        if (!txt || txt.length < 1) return;
        postMutation.mutate();
    };

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="text-sm text-slate-300 hover:text-white"
                            onClick={() => navigate(-1)}
                        >
                            ← Retour
                        </button>
                        <span className="text-xs text-slate-500">#{id || "-"}</span>
                    </div>

                    <h1 className="mt-2 text-lg sm:text-xl font-semibold text-white truncate">
                        {ticket?.subject || "Ticket"}
                    </h1>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={ticket?.status} />
                        <span className="text-xs text-slate-400">MAJ: {fmtDate(ticket?.updatedAt)}</span>
                    </div>

                    {isClosureRequested && (
                        <div className="mt-2 text-sm text-orange-200 bg-orange-600/10 border border-orange-600/20 rounded-lg px-3 py-2">
                            Un admin a demandé la clôture. Si tu ne réponds pas, le ticket se fermera automatiquement.
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    {!isClosed ? (
                        <button
                            type="button"
                            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm disabled:opacity-50"
                            disabled={closeMutation.isPending || ticketQuery.isLoading}
                            onClick={() => closeMutation.mutate()}
                        >
                            Fermer
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
                            disabled={reopenMutation.isPending || ticketQuery.isLoading}
                            onClick={() => reopenMutation.mutate()}
                        >
                            Réouvrir
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden flex flex-col min-h-[60vh]">
                {(ticketQuery.isLoading || messagesQuery.isLoading) && (
                    <div className="p-6 flex items-center justify-center text-slate-300">
                        <Spinner />
                    </div>
                )}

                {(ticketQuery.isError || messagesQuery.isError) && (
                    <div className="p-4 text-red-300">
                        {ticketQuery.error?.response?.data?.message ||
                            messagesQuery.error?.response?.data?.message ||
                            ticketQuery.error?.message ||
                            messagesQuery.error?.message ||
                            "Erreur"}
                    </div>
                )}

                {!ticketQuery.isLoading && !messagesQuery.isLoading && !ticketQuery.isError && !messagesQuery.isError && (
                    <>
                        <div className="p-4 space-y-3 overflow-y-auto flex-1">
                            {messages.length === 0 ? (
                                <div className="text-slate-300 text-sm">Aucun message.</div>
                            ) : (
                                messages.map((m) => {
                                    const isMe = m?.authorId === ticket?.createdById;
                                    return <MessageBubble key={m.id} m={m} isMe={isMe} />;
                                })
                            )}
                            <div ref={bottomRef} />
                        </div>

                        <div className="border-t border-slate-700 p-3">
                            <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
                                <textarea
                                    className="w-full min-h-[44px] max-h-[140px] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                                    placeholder={isClosed ? "Ticket fermé" : "Écris un message…"}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    disabled={!canSend || postMutation.isPending}
                                />
                                <button
                                    type="submit"
                                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
                                    disabled={!canSend || postMutation.isPending || String(message || "").trim().length === 0}
                                >
                                    {postMutation.isPending ? "Envoi…" : "Envoyer"}
                                </button>
                            </form>
                            <div className="mt-2 text-xs text-slate-500">
                                {isClosed
                                    ? "Ce ticket est fermé."
                                    : "Astuce : tu peux envoyer plusieurs messages, l’admin ne recevra pas de spam de notifications côté user."}
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="text-xs text-slate-500">
                <Link className="underline hover:text-slate-300" to="/dashboard/tickets">
                    Retour à la liste
                </Link>
            </div>
        </div>
    );
}
