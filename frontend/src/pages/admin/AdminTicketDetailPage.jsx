// frontend/src/pages/admin/AdminTicketDetailPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import Modal from "@/components/Modal";
import Spinner from "@/components/ui/Spinner";
import { queryClient } from "@/utils/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";

import {
    closeAdminTicket,
    getAdminTicket,
    getTicketRequesterProfile,
    listAdminTicketMessages,
    postAdminTicketMessage,
    requestTicketClosure,
    takeTicket,
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
        [TICKET_STATUSES.WAITING_USER]: { label: "En attente user", cls: "bg-emerald-600/20 text-emerald-200" },
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
    const name = m?.author?.name || m?.author?.username || (isMe ? "Moi" : "User");
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

function categoryLabel(category) {
    switch (String(category || "").toUpperCase()) {
        case "BILLS":
            return "Facturation";
        case "SUPPORT":
            return "Support";
        case "OTHERS":
            return "Autre";
        default:
            return category || "-";
    }
}

export default function AdminTicketDetailPage() {
    const navigate = useNavigate();
    const { ticketId } = useParams();
    const { user } = useAuth();
    const { has } = usePermissions();

    const id = useMemo(() => {
        const n = parseInt(ticketId, 10);
        return Number.isInteger(n) ? n : null;
    }, [ticketId]);

    const meId = user?.id;

    const [message, setMessage] = useState("");
    const bottomRef = useRef(null);

    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [profile, setProfile] = useState(null);

    const ticketQuery = useQuery({
        queryKey: ["tickets", "admin", "detail", id],
        enabled: !!id,
        queryFn: () => getAdminTicket(id),
        staleTime: 0,
        refetchInterval: 3_000,
    });

    const messagesQuery = useQuery({
        queryKey: ["tickets", "admin", "messages", id],
        enabled: !!id,
        queryFn: () => listAdminTicketMessages(id, { page: 1, pageSize: 200 }),
        staleTime: 0,
        refetchInterval: 3_000,
    });

    const ticket = ticketQuery.data?.ticket || ticketQuery.data;
    const messages = messagesQuery.data?.data || [];

    const isClosed = String(ticket?.status || "").toUpperCase() === TICKET_STATUSES.CLOSED;
    const isClosureRequested = String(ticket?.status || "").toUpperCase() === TICKET_STATUSES.CLOSURE_REQUESTED;

    const isAssigneeMe = ticket?.assigneeId && meId && Number(ticket.assigneeId) === Number(meId);
    const isUnassigned = !ticket?.assigneeId;

    const canRequestClosure = isAssigneeMe || has("ADMIN.*") || has("ADMIN.TICKETS.*");
    const canClose = isAssigneeMe || has("ADMIN.*") || has("ADMIN.TICKETS.*");

    useEffect(() => {
        if (!bottomRef.current) return;
        bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages.length]);

    const takeMutation = useMutation({
        mutationFn: async () => takeTicket(id),
        onSuccess: async () => {
            toast.success("Ticket pris en charge");
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["tickets", "admin", "detail", id] }),
                queryClient.invalidateQueries({ queryKey: ["tickets", "admin", "list"] }),
            ]);
        },
        onError: (e) => toast.error(e?.response?.data?.message || e?.message || "Erreur prise en charge"),
    });

    const closeMutation = useMutation({
        mutationFn: async () => closeAdminTicket(id),
        onSuccess: async () => {
            toast.success("Ticket fermé");
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["tickets", "admin", "detail", id] }),
                queryClient.invalidateQueries({ queryKey: ["tickets", "admin", "list"] }),
            ]);
        },
        onError: (e) => toast.error(e?.response?.data?.message || e?.message || "Erreur fermeture"),
    });

    const postMutation = useMutation({
        mutationFn: async () => postAdminTicketMessage(id, { content: message }),
        onSuccess: async () => {
            setMessage("");
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["tickets", "admin", "messages", id] }),
                queryClient.invalidateQueries({ queryKey: ["tickets", "admin", "detail", id] }),
                queryClient.invalidateQueries({ queryKey: ["tickets", "admin", "list"] }),
            ]);
        },
        onError: (e) => {
            const msg = e?.response?.data?.message || e?.message || "Erreur envoi message";
            toast.error(msg);
        },
    });

    const closureMutation = useMutation({
        mutationFn: async () => requestTicketClosure(id),
        onSuccess: async () => {
            toast.success("Demande de clôture envoyée");
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["tickets", "admin", "detail", id] }),
                queryClient.invalidateQueries({ queryKey: ["tickets", "admin", "list"] }),
            ]);
        },
        onError: (e) => toast.error(e?.response?.data?.message || e?.message || "Erreur demande clôture"),
    });

    const openProfile = async () => {
        try {
            const data = await getTicketRequesterProfile(id);
            setProfile(data);
            setIsProfileOpen(true);
        } catch (e) {
            toast.error(e?.response?.data?.message || e?.message || "Erreur profil");
        }
    };

    const submit = (e) => {
        e.preventDefault();
        const txt = String(message || "").trim();
        if (!txt) return;
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
                        <span className="text-xs text-slate-400">
                            Catégorie: {categoryLabel(ticket?.category)}
                        </span>
                        <span className="text-xs text-slate-400">
                            MAJ: {fmtDate(ticket?.updatedAt)}
                        </span>
                    </div>

                    {isUnassigned && (
                        <div className="mt-2 text-sm text-slate-200 bg-slate-800/40 border border-slate-700 rounded-lg px-3 py-2">
                            En attente d’un agent de liaison.
                        </div>
                    )}

                    {!isUnassigned && ticket?.assigneeJoinedAt === null && (
                        <div className="mt-2 text-sm text-indigo-200 bg-indigo-600/10 border border-indigo-600/20 rounded-lg px-3 py-2">
                            Assigné, en attente de prise en charge (join).
                        </div>
                    )}

                    {isClosureRequested && (
                        <div className="mt-2 text-sm text-orange-200 bg-orange-600/10 border border-orange-600/20 rounded-lg px-3 py-2">
                            Demande de clôture active. Le ticket se fermera automatiquement après 24h sans réponse du user.
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <button
                        type="button"
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm disabled:opacity-50"
                        onClick={openProfile}
                        disabled={ticketQuery.isLoading}
                    >
                        Profil user
                    </button>

                    {isUnassigned && (
                        <button
                            type="button"
                            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
                            disabled={takeMutation.isPending || ticketQuery.isLoading}
                            onClick={() => takeMutation.mutate()}
                        >
                            {takeMutation.isPending ? "…" : "Prendre en charge"}
                        </button>
                    )}

                    {!isClosed && (
                        <button
                            type="button"
                            className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm disabled:opacity-50"
                            disabled={!canRequestClosure || closureMutation.isPending || ticketQuery.isLoading}
                            onClick={() => closureMutation.mutate()}
                            title={!canRequestClosure ? "Réservé à l'assigné (ou super)" : ""}
                        >
                            {closureMutation.isPending ? "…" : "Demander clôture"}
                        </button>
                    )}

                    {!isClosed && (
                        <button
                            type="button"
                            className="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm disabled:opacity-50"
                            disabled={!canClose || closeMutation.isPending || ticketQuery.isLoading}
                            onClick={() => closeMutation.mutate()}
                            title={!canClose ? "Réservé à l'assigné (ou super)" : ""}
                        >
                            {closeMutation.isPending ? "…" : "Fermer ticket"}
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
                                    const isMe = meId && Number(m?.authorId) === Number(meId);
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
                                    disabled={isClosed || postMutation.isPending}
                                />
                                <button
                                    type="submit"
                                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
                                    disabled={isClosed || postMutation.isPending || String(message || "").trim().length === 0}
                                >
                                    {postMutation.isPending ? "Envoi…" : "Envoyer"}
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>

            <div className="text-xs text-slate-500">
                <Link className="underline hover:text-slate-300" to="/admin/tickets">
                    Retour à l’inbox
                </Link>
            </div>

            <Modal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} title="Profil utilisateur">
                {!profile ? (
                    <div className="py-10 flex justify-center">
                        <Spinner />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center text-slate-300">
                                {profile.imageUrl ? (
                                    <img src={profile.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-sm">?</span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-100 truncate">
                                    {profile.name || profile.username || "Utilisateur"}
                                </div>
                                <div className="text-xs text-slate-400 truncate">@{profile.username || "—"}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                                <div className="text-xs text-slate-500">Téléphone</div>
                                <div className="text-slate-100 break-words">{profile.phoneNumber || "—"}</div>
                            </div>
                            <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                                <div className="text-xs text-slate-500">IBAN</div>
                                <div className="text-slate-100 break-words">{profile.iban || "—"}</div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-xs text-slate-400">Employments</div>
                            {Array.isArray(profile.employments) && profile.employments.length > 0 ? (
                                <div className="space-y-2">
                                    {profile.employments.map((e) => (
                                        <div key={e.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                                            <div className="text-sm text-slate-100">
                                                {e.company?.name || "Company"} — {e.rank?.name || "Rang"}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                status: {e.status || "—"} • position: {e.rank?.position ?? "—"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-slate-300">Aucun employment.</div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
