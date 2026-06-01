// frontend/src/pages/dashboard/partners/PartnerDetailPage.jsx

import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import {
    format,
    endOfISOWeek,
    getISOWeek,
    getISOWeekYear,
    setISOWeek,
    startOfISOWeek,
} from "date-fns";
import { Pencil, Check, X, ChevronLeft, Plus } from "lucide-react";

import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/contexts/PermissionsContext";

import WeekSelector from "@/components/accounting/WeekSelector";

import {
    getPartner,
    updatePartner,
    getWeeklySummary,
    updateServiceRendered,
    getFullRenderedServices,
} from "@/services/partnershipService";

const PartnerDetailPage = () => {
    const { partnerId } = useParams();
    const queryClient = useQueryClient();

    const { activeCompanyId, selectedCompany } = useCompany();
    const companyId = activeCompanyId ?? selectedCompany?.id ?? null;

    const { isReady: permsReady, isLoading: permsLoading, has } = usePermissions();

    const canAccess = useMemo(() => permsReady && has("PARTENARIAT.ACCESS"), [permsReady, has]);
    const canViewPartner = useMemo(
        () => canAccess && has("PARTENARIAT.PARTNER.LIST"),
        [canAccess, has]
    );
    const canUpdatePartner = useMemo(
        () => canAccess && has("PARTENARIAT.PARTNER.UPDATE"),
        [canAccess, has]
    );

    const canViewWeekly = useMemo(
        () => canAccess && has("PARTENARIAT.WEEKLY_TOTAL.VIEW"),
        [canAccess, has]
    );

    const canListRendered = useMemo(
        () => canAccess && has("PARTENARIAT.SERVICE_RENDERED.LIST"),
        [canAccess, has]
    );
    const canUpdateRendered = useMemo(
        () => canAccess && has("PARTENARIAT.SERVICE_RENDERED.UPDATE"),
        [canAccess, has]
    );
    const canCreateRendered = useMemo(
        () => canAccess && has("PARTENARIAT.SERVICE_RENDERED.CREATE"),
        [canAccess, has]
    );

    const canGoServices = useMemo(
        () => canAccess && has("PARTENARIAT.SERVICE_TYPE.LIST"),
        [canAccess, has]
    );

    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState("");

    // WeekSelector pilote {year, week} en ISO week
    const [selectedWeek, setSelectedWeek] = useState(() => {
        const now = new Date();
        return { year: getISOWeekYear(now), week: getISOWeek(now) };
    });

    const weekRange = useMemo(() => {
        // 4 janvier est toujours dans la semaine ISO 1 de l'année ISO
        const base = new Date(selectedWeek.year, 0, 4);
        const dateInWeek = setISOWeek(base, selectedWeek.week);

        const start = startOfISOWeek(dateInWeek);
        const end = endOfISOWeek(dateInWeek);

        return {
            start,
            end,
            from: format(start, "yyyy-MM-dd"),
            to: format(end, "yyyy-MM-dd"),
            key: `${selectedWeek.year}-W${String(selectedWeek.week).padStart(2, "0")}`,
        };
    }, [selectedWeek.year, selectedWeek.week]);

    const [qtyDraft, setQtyDraft] = useState({}); // { [renderedId]: number|string }

    const { data: partner, isLoading: partnerLoading } = useQuery({
        queryKey: ["partner", partnerId],
        queryFn: () => getPartner(partnerId),
        enabled: Boolean(partnerId) && permsReady && canViewPartner,
    });

    const { data: summary } = useQuery({
        queryKey: ["partner-summary", partnerId, weekRange.key],
        queryFn: () =>
            getWeeklySummary({
                partnerId,
                from: weekRange.from,
                to: weekRange.to,
                includeEmployees: true,
            }),
        enabled: Boolean(partnerId) && permsReady && canViewWeekly,
    });

    const { data: services = [], isLoading: renderedLoading } = useQuery({
        queryKey: ["partner-services", partnerId, weekRange.key],
        queryFn: () =>
            getFullRenderedServices({
                partnerId,
                from: weekRange.from,
                to: weekRange.to,
            }),
        enabled: Boolean(partnerId) && permsReady && canListRendered,
        onSuccess: (rows) => {
            const next = {};
            (rows || []).forEach((r) => {
                next[r.id] = r.quantity;
            });
            setQtyDraft(next);
        },
    });

    const updatePartnerMutation = useMutation({
        mutationFn: (data) => updatePartner(partnerId, data),
        onSuccess: () => {
            toast.success("Nom modifié");
            queryClient.invalidateQueries({ queryKey: ["partner", partnerId] });
            setIsEditingName(false);
        },
        onError: () => toast.error("Impossible de modifier le partenaire"),
    });

    const updateServiceMutation = useMutation({
        mutationFn: ({ id, quantity }) => updateServiceRendered(id, { quantity }),
        onSuccess: () => {
            toast.success("Mise à jour appliquée");
            queryClient.invalidateQueries({ queryKey: ["partner-services", partnerId] });
            queryClient.invalidateQueries({ queryKey: ["partner-summary", partnerId] });
        },
        onError: () => toast.error("Impossible de mettre à jour la prestation"),
    });

    if (!companyId) {
        return (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-slate-300">
                Aucune entreprise sélectionnée.
            </div>
        );
    }

    if (permsLoading || !permsReady) {
        return (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-slate-300">
                Chargement des droits…
            </div>
        );
    }

    if (!canAccess || !canViewPartner) {
        return (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <h1 className="text-xl font-semibold text-white">Partenaire</h1>
                <p className="mt-2 text-sm text-slate-400">
                    Accès refusé : permissions requises{" "}
                    <span className="text-slate-200">PARTENARIAT.ACCESS</span> /{" "}
                    <span className="text-slate-200">PARTENARIAT.PARTNER.LIST</span>.
                </p>
                <div className="mt-4">
                    <Link
                        to="/dashboard/partners"
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700"
                    >
                        <ChevronLeft size={18} />
                        Retour
                    </Link>
                </div>
            </div>
        );
    }

    if (partnerLoading) return <div className="p-6 text-slate-300">Chargement…</div>;
    if (!partner) return <div className="p-6 text-red-300">Partenaire introuvable.</div>;

    const saveName = () => {
        const name = newName.trim();
        if (!name) return toast.error("Nom invalide");
        updatePartnerMutation.mutate({ name });
    };

    const commitQuantity = (rowId) => {
        if (!canUpdateRendered) return;
        const raw = qtyDraft[rowId];
        const num = Number(raw);
        if (!Number.isFinite(num) || num < 0) return toast.error("Quantité invalide");
        updateServiceMutation.mutate({ id: rowId, quantity: num });
    };

    return (
        <div className="space-y-8 text-white">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    <Link
                        to="/dashboard/partners"
                        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition mb-3"
                    >
                        <ChevronLeft size={18} />
                        <span className="text-sm">Retour</span>
                    </Link>

                    {!isEditingName ? (
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl md:text-3xl font-bold truncate">{partner.name}</h1>
                            {canUpdatePartner && (
                                <button
                                    onClick={() => {
                                        setIsEditingName(true);
                                        setNewName(partner.name);
                                    }}
                                    className="text-slate-300 hover:text-white transition"
                                    title="Renommer"
                                >
                                    <Pencil size={18} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <input
                                className="bg-slate-950/40 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                autoFocus
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && saveName()}
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500"
                                    onClick={saveName}
                                >
                                    <Check size={18} />
                                    Enregistrer
                                </button>
                                <button
                                    className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700"
                                    onClick={() => setIsEditingName(false)}
                                >
                                    <X size={18} />
                                    Annuler
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    {canGoServices && (
                        <Link
                            to={`/dashboard/partners/${partnerId}/services`}
                            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium shadow-sm shadow-indigo-900/30 hover:bg-indigo-500"
                        >
                            Gérer les services
                        </Link>
                    )}

                    {canCreateRendered && (
                        <Link
                            to={`/dashboard/partners/${partnerId}/render`}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-700"
                        >
                            <Plus size={18} />
                            Nouvelle prestation
                        </Link>
                    )}
                </div>
            </div>

            {/* Week selector (ISO week) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <WeekSelector onWeekChange={setSelectedWeek} />

                <div className="text-center md:text-right">
                    <div className="text-sm md:text-base font-semibold">
                        <span className="text-slate-300">
                            {dayjs(weekRange.start).format("DD MMM")} → {dayjs(weekRange.end).format("DD MMM")}
                        </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                        Période: {weekRange.from} → {weekRange.to}
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <h2 className="text-base font-semibold mb-2">Résumé de la semaine</h2>

                {!canViewWeekly ? (
                    <p className="text-sm text-slate-400">
                        Permission manquante : <span className="text-slate-200">PARTENARIAT.WEEKLY_TOTAL.VIEW</span>.
                    </p>
                ) : summary?.[0] ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                            <div className="text-xs text-slate-400">Prestations</div>
                            <div className="mt-1 text-2xl font-semibold">{summary[0].servicesCount}</div>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                            <div className="text-xs text-slate-400">Montant total</div>
                            <div className="mt-1 text-2xl font-semibold">{summary[0].totalAmount} $</div>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-slate-400">Aucune prestation cette semaine.</p>
                )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="text-base font-semibold">Prestations de la semaine</h2>
                    {canListRendered && !canUpdateRendered && (
                        <span className="text-xs text-slate-400">Lecture seule</span>
                    )}
                </div>

                {!canListRendered ? (
                    <p className="text-sm text-slate-400">
                        Permission manquante :{" "}
                        <span className="text-slate-200">PARTENARIAT.SERVICE_RENDERED.LIST</span>.
                    </p>
                ) : renderedLoading ? (
                    <div className="text-sm text-slate-300">Chargement…</div>
                ) : (
                    <div className="space-y-4">
                        {/* Mobile cards */}
                        <div className="md:hidden space-y-3">
                            {services.length === 0 ? (
                                <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-4 text-center text-sm text-slate-400">
                                    Aucune prestation enregistrée.
                                </div>
                            ) : (
                                services.map((srv) => (
                                    <div key={srv.id} className="rounded-xl border border-slate-800 bg-slate-950/20 p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold truncate">
                                                    {srv.serviceType?.name || "—"}
                                                </div>
                                                <div className="mt-0.5 text-xs text-slate-400 truncate">
                                                    {srv.user?.name || "N/A"}
                                                </div>
                                            </div>

                                            <div className="shrink-0 text-right">
                                                <div className="text-sm font-semibold">{srv.total} $</div>
                                                <div className="mt-0.5 text-xs text-slate-400">
                                                    {dayjs(srv.date).format("DD/MM HH:mm")}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-between gap-3">
                                            <div className="text-xs text-slate-400">Quantité</div>
                                            {canUpdateRendered ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={qtyDraft[srv.id] ?? srv.quantity}
                                                    onChange={(e) =>
                                                        setQtyDraft((prev) => ({
                                                            ...prev,
                                                            [srv.id]: e.target.value,
                                                        }))
                                                    }
                                                    onBlur={() => commitQuantity(srv.id)}
                                                    onKeyDown={(e) => e.key === "Enter" && commitQuantity(srv.id)}
                                                    className="w-24 bg-slate-950/40 border border-slate-800 rounded-lg px-2 py-1 text-right outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            ) : (
                                                <div className="text-sm">{srv.quantity}</div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800">
                            <table className="min-w-[720px] w-full text-sm">
                                <thead className="bg-slate-950/40 border-b border-slate-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-slate-300">Service</th>
                                    <th className="px-4 py-3 text-left text-slate-300">Employé</th>
                                    <th className="px-4 py-3 text-right text-slate-300">Quantité</th>
                                    <th className="px-4 py-3 text-right text-slate-300">Montant</th>
                                    <th className="px-4 py-3 text-right text-slate-300">Date</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                {services.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                            Aucune prestation enregistrée.
                                        </td>
                                    </tr>
                                ) : (
                                    services.map((srv) => (
                                        <tr key={srv.id} className="hover:bg-slate-950/20 transition">
                                            <td className="px-4 py-3">{srv.serviceType?.name}</td>
                                            <td className="px-4 py-3">{srv.user?.name || "N/A"}</td>
                                            <td className="px-4 py-3 text-right">
                                                {canUpdateRendered ? (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={qtyDraft[srv.id] ?? srv.quantity}
                                                        onChange={(e) =>
                                                            setQtyDraft((prev) => ({
                                                                ...prev,
                                                                [srv.id]: e.target.value,
                                                            }))
                                                        }
                                                        onBlur={() => commitQuantity(srv.id)}
                                                        className="w-20 bg-slate-950/40 border border-slate-800 rounded-lg px-2 py-1 text-right outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                ) : (
                                                    srv.quantity
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">{srv.total} $</td>
                                            <td className="px-4 py-3 text-right">
                                                {dayjs(srv.date).format("DD/MM HH:mm")}
                                            </td>
                                        </tr>
                                    ))
                                )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PartnerDetailPage;
