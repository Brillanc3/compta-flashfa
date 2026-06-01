// frontend/src/pages/admin/AdminTicketsPage.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import Spinner from "@/components/ui/Spinner";

import {
    listAdminTickets,
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

export default function AdminTicketsPage() {
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const [category, setCategory] = useState("ALL");
    const [status, setStatus] = useState("ALL");
    const [assigned, setAssigned] = useState("all"); // all | me | unassigned (super only, backend ignore for non-super)
    const [search, setSearch] = useState("");

    const q = useQuery({
        queryKey: ["tickets", "admin", "list", { page, pageSize, category, status, assigned, search }],
        queryFn: () =>
            listAdminTickets({
                page,
                pageSize,
                category: category === "ALL" ? undefined : category,
                status: status === "ALL" ? undefined : status,
                assigned,
                search: search.trim() || undefined,
            }),
        staleTime: 8_000,
    });

    const tickets = q.data?.data || [];
    const pagination = q.data?.pagination;

    const canPrev = useMemo(() => (pagination?.currentPage || 1) > 1, [pagination?.currentPage]);
    const canNext = useMemo(() => {
        const cur = Number(pagination?.currentPage || 1);
        const total = Number(pagination?.totalPages || 1);
        return cur < total;
    }, [pagination?.currentPage, pagination?.totalPages]);

    return (
        <div className="p-4 sm:p-6 space-y-5">
            <div className="space-y-1">
                <h1 className="text-xl font-semibold text-white">Tickets</h1>
                <p className="text-sm text-slate-300">
                    Inbox admin : tickets non assignés (catégories autorisées) + tickets assignés à toi.
                </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="space-y-1">
                            <div className="text-xs text-slate-400">Recherche</div>
                            <input
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                                placeholder="Sujet / user…"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="text-xs text-slate-400">Catégorie</div>
                            <select
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                                value={category}
                                onChange={(e) => {
                                    setCategory(e.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="ALL">Toutes</option>
                                <option value={TICKET_CATEGORIES.BILLS}>Facturation</option>
                                <option value={TICKET_CATEGORIES.SUPPORT}>Support</option>
                                <option value={TICKET_CATEGORIES.OTHERS}>Autre</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <div className="text-xs text-slate-400">Statut</div>
                            <select
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                                value={status}
                                onChange={(e) => {
                                    setStatus(e.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="ALL">Tous</option>
                                <option value={TICKET_STATUSES.OPEN}>Ouvert</option>
                                <option value={TICKET_STATUSES.ASSIGNED}>Assigné</option>
                                <option value={TICKET_STATUSES.WAITING_AGENT}>En attente agent</option>
                                <option value={TICKET_STATUSES.WAITING_USER}>En attente user</option>
                                <option value={TICKET_STATUSES.CLOSURE_REQUESTED}>Clôture demandée</option>
                                <option value={TICKET_STATUSES.CLOSED}>Fermé</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <div className="text-xs text-slate-400">Assignation</div>
                            <select
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                                value={assigned}
                                onChange={(e) => {
                                    setAssigned(e.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="all">Tous (si super)</option>
                                <option value="me">Assignés à moi</option>
                                <option value="unassigned">Non assignés</option>
                            </select>
                            <div className="text-[11px] text-slate-500">
                                Les filtres “Tous / non assignés” ne s’appliquent pleinement que pour ADMIN.* / ADMIN.TICKETS.*
                            </div>
                        </div>
                    </div>
                </div>

                {q.isLoading && (
                    <div className="p-6 flex items-center justify-center text-slate-300">
                        <Spinner />
                    </div>
                )}

                {q.isError && (
                    <div className="p-4 text-red-300">
                        {q.error?.response?.data?.message || q.error?.message || "Erreur"}
                    </div>
                )}

                {!q.isLoading && !q.isError && tickets.length === 0 && (
                    <div className="p-4 text-slate-300">Aucun ticket.</div>
                )}

                {!q.isLoading && !q.isError && tickets.length > 0 && (
                    <>
                        {/* Mobile: cards */}
                        <div className="md:hidden divide-y divide-slate-800">
                            {tickets.map((t) => (
                                <div key={t.id} className="p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-medium text-slate-100 truncate">{t.subject || "-"}</div>
                                            <div className="text-xs text-slate-400">
                                                #{t.id} • {categoryLabel(t.category)}
                                            </div>
                                        </div>
                                        <StatusBadge status={t.status} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="space-y-1">
                                            <div className="text-xs text-slate-500">Demandeur</div>
                                            <div className="text-slate-200 truncate">
                                                {t.createdBy?.name || t.createdBy?.username || "—"}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="text-xs text-slate-500">Agent</div>
                                            <div className="text-slate-200 truncate">
                                                {t.assignee?.name || t.assignee?.username || (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-xs text-slate-400">{fmtDate(t.updatedAt)}</div>
                                        <Link
                                            to={`/admin/tickets/${t.id}`}
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
                                        <th className="text-left px-4 py-3">Demandeur</th>
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
                                                {t.createdBy?.name || t.createdBy?.username || "—"}
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
                                                        to={`/admin/tickets/${t.id}`}
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

                {!q.isLoading && !q.isError && pagination ? (
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
        </div>
    );
}
