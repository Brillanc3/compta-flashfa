// frontend/src/pages/dashboard/tickets/TicketsPage.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import Modal from "@/components/Modal";
import Spinner from "@/components/ui/Spinner";
import { queryClient } from "@/utils/queryClient";

import {
    createMyTicket,
    listMyTickets,
    TICKET_CATEGORIES,
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

function categoryLabel(category) {
    switch (category) {
        case TICKET_CATEGORIES.BILLS:
            return "Facturation";
        case TICKET_CATEGORIES.SUPPORT:
            return "Support";
        case TICKET_CATEGORIES.OTHERS:
            return "Autre";
        default:
            return category || "-";
    }
}

export default function TicketsPage() {
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [form, setForm] = useState({
        category: TICKET_CATEGORIES.SUPPORT,
        subject: "",
        message: "",
    });

    const listQuery = useQuery({
        queryKey: ["tickets", "my", "list", { statusFilter, page, pageSize }],
        queryFn: () =>
            listMyTickets({
                page,
                pageSize,
                status: statusFilter === "ALL" ? undefined : statusFilter,
            }),
        staleTime: 10_000,
    });

    const tickets = listQuery.data?.data || [];
    const pagination = listQuery.data?.pagination;

    const canPrev = useMemo(() => (pagination?.currentPage || 1) > 1, [pagination?.currentPage]);
    const canNext = useMemo(() => {
        const cur = Number(pagination?.currentPage || 1);
        const total = Number(pagination?.totalPages || 1);
        return cur < total;
    }, [pagination?.currentPage, pagination?.totalPages]);

    const createMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                category: form.category,
                subject: form.subject,
                message: form.message,
            };
            return createMyTicket(payload);
        },
        onSuccess: async () => {
            toast.success("Ticket créé");
            setIsCreateOpen(false);
            setForm({ category: TICKET_CATEGORIES.SUPPORT, subject: "", message: "" });
            setPage(1);
            await queryClient.invalidateQueries({ queryKey: ["tickets", "my", "list"] });
        },
        onError: (e) => {
            toast.error(e?.response?.data?.message || e?.message || "Erreur création ticket");
        },
    });

    const submitCreate = (e) => {
        e.preventDefault();

        const subject = String(form.subject || "").trim();
        const message = String(form.message || "").trim();

        if (!subject || subject.length < 3) {
            toast.error("Sujet invalide (min 3 caractères).");
            return;
        }
        if (!message || message.length < 3) {
            toast.error("Message invalide (min 3 caractères).");
            return;
        }

        createMutation.mutate();
    };

    return (
        <div className="p-4 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-1">
                    <h1 className="text-xl font-semibold text-white">Tickets</h1>
                    <p className="text-sm text-slate-300">
                        Ouvre un ticket auprès d’un membre admin (facturation, support, ou autre).
                    </p>
                </div>

                <button
                    type="button"
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
                    onClick={() => setIsCreateOpen(true)}
                >
                    Nouveau ticket
                </button>
            </div>

            <div className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-sm text-slate-200">Mes tickets</div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <label className="text-xs text-slate-400">Statut</label>
                        <select
                            className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="ALL">Tous</option>
                            <option value={TICKET_STATUSES.OPEN}>Ouvert</option>
                            <option value={TICKET_STATUSES.ASSIGNED}>Assigné</option>
                            <option value={TICKET_STATUSES.WAITING_AGENT}>En attente agent</option>
                            <option value={TICKET_STATUSES.WAITING_USER}>En attente réponse</option>
                            <option value={TICKET_STATUSES.CLOSURE_REQUESTED}>Clôture demandée</option>
                            <option value={TICKET_STATUSES.CLOSED}>Fermé</option>
                        </select>
                    </div>
                </div>

                {listQuery.isLoading && (
                    <div className="p-6 flex items-center justify-center text-slate-300">
                        <Spinner />
                    </div>
                )}

                {listQuery.isError && (
                    <div className="p-4 text-red-300">
                        {listQuery.error?.response?.data?.message || listQuery.error?.message || "Erreur"}
                    </div>
                )}

                {!listQuery.isLoading && !listQuery.isError && tickets.length === 0 && (
                    <div className="p-4 text-slate-300">Aucun ticket.</div>
                )}

                {!listQuery.isLoading && !listQuery.isError && tickets.length > 0 && (
                    <>
                        {/* Mobile: cards */}
                        <div className="md:hidden divide-y divide-slate-800">
                            {tickets.map((t) => (
                                <div key={t.id} className="p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-medium text-slate-100 truncate">{t.subject || "-"}</div>
                                            <div className="text-xs text-slate-400">#{t.id}</div>
                                        </div>
                                        <StatusBadge status={t.status} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="space-y-1">
                                            <div className="text-xs text-slate-500">Catégorie</div>
                                            <div className="text-slate-200">{categoryLabel(t.category)}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-xs text-slate-500">Agent</div>
                                            <div className="text-slate-200">
                                                {t.assignee?.name || t.assignee?.username || (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-xs text-slate-400">{fmtDate(t.updatedAt)}</div>
                                        <Link
                                            to={`/dashboard/tickets/${t.id}`}
                                            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100"
                                        >
                                            Ouvrir
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop: table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-800/50 text-slate-200">
                                    <tr>
                                        <th className="text-left px-4 py-3">Sujet</th>
                                        <th className="text-left px-4 py-3">Catégorie</th>
                                        <th className="text-left px-4 py-3">Statut</th>
                                        <th className="text-left px-4 py-3">Agent</th>
                                        <th className="text-left px-4 py-3">MAJ</th>
                                        <th className="text-right px-4 py-3">Action</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-800">
                                    {tickets.map((t) => (
                                        <tr key={t.id} className="text-slate-200">
                                            <td className="px-4 py-3">
                                                <div className="font-medium">{t.subject || "-"}</div>
                                                <div className="text-xs text-slate-400">#{t.id}</div>
                                            </td>

                                            <td className="px-4 py-3 text-slate-300">{categoryLabel(t.category)}</td>

                                            <td className="px-4 py-3">
                                                <StatusBadge status={t.status} />
                                            </td>

                                            <td className="px-4 py-3 text-slate-300">
                                                {t.assignee?.name || t.assignee?.username || (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3 text-slate-300">{fmtDate(t.updatedAt)}</td>

                                            <td className="px-4 py-3">
                                                <div className="flex justify-end">
                                                    <Link
                                                        to={`/dashboard/tickets/${t.id}`}
                                                        className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100"
                                                    >
                                                        Ouvrir
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {!listQuery.isLoading && !listQuery.isError && pagination ? (
                    <div className="px-4 py-3 border-t border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="text-xs text-slate-400">
                            Page {pagination.currentPage} / {pagination.totalPages} — {pagination.totalCount} ticket(s)
                        </div>

                        <div className="grid grid-cols-2 sm:flex gap-2">
                            <button
                                className="w-full sm:w-auto px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 disabled:opacity-50"
                                disabled={!canPrev}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                Précédent
                            </button>
                            <button
                                className="w-full sm:w-auto px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 disabled:opacity-50"
                                disabled={!canNext}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Suivant
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>

            <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nouveau ticket">
                <form onSubmit={submitCreate} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-sm text-slate-200">Catégorie</label>
                            <select
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                                value={form.category}
                                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                            >
                                <option value={TICKET_CATEGORIES.BILLS}>Facturation</option>
                                <option value={TICKET_CATEGORIES.SUPPORT}>Support</option>
                                <option value={TICKET_CATEGORIES.OTHERS}>Autre</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm text-slate-200">Sujet</label>
                            <input
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                                value={form.subject}
                                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                                placeholder="Ex: Problème de facture…"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-slate-200">Message</label>
                        <textarea
                            className="w-full min-h-[140px] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                            value={form.message}
                            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                            placeholder="Décris ton besoin…"
                        />
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100"
                            onClick={() => setIsCreateOpen(false)}
                            disabled={createMutation.isPending}
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? "Création…" : "Créer"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
