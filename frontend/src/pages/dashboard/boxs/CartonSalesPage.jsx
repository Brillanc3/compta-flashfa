// frontend/src/pages/dashboard/boxs/CartonSalesPage.jsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import {
    endOfISOWeek,
    format,
    getISOWeek,
    getYear,
    setISOWeek,
    startOfISOWeek,
} from "date-fns";
import { fr } from "date-fns/locale";

import { useCompany } from "@/contexts/CompanyContext.jsx";
import { usePermissions } from "@/contexts/PermissionsContext.jsx";

import Spinner from "@/components/ui/Spinner";
import WeekSelector from "@/components/accounting/WeekSelector";
import Button from "@/components/ui/button";

import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";

import {
    fetchCartonSales,
    fetchCartonSalesSummary,
    updateCartonSale,
} from "@/services/boxsService";

const PERMISSIONS = {
    CARTON_SALES_VIEW: "BOXS.CARTON_SALES.VIEW",
    CARTON_SALES_EDIT: "BOXS.CARTON_SALES.EDIT",
};

function safeNumber(v) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
}

function weekParamsToRange({ year, week }) {
    const pivot = new Date(Number(year), 0, 4); // pivot ISO week
    const dateInWeek = setISOWeek(pivot, Number(week));
    const start = startOfISOWeek(dateInWeek);
    const end = endOfISOWeek(dateInWeek);

    return {
        // backend attend startDate/endDate
        startDate: format(start, "yyyy-MM-dd"),
        endDate: format(end, "yyyy-MM-dd"),
        start,
        end,
    };
}

function uniqEmployeeOptions(rows) {
    const map = new Map();
    for (const row of rows) {
        const ce = row?.companyEmployee;
        const id = ce?.id ?? row?.companyEmployeeId;
        if (!id) continue;
        map.set(id, {
            id,
            name: ce?.user?.name ?? `Employé #${id}`,
            rankName: ce?.rank?.name ?? "",
        });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function groupByEmployee(rows) {
    const map = new Map();

    for (const row of rows) {
        const ce = row?.companyEmployee;
        const employeeId = ce?.id ?? row?.companyEmployeeId;
        if (!employeeId) continue;

        const name = ce?.user?.name ?? `Employé #${employeeId}`;
        const rankName = ce?.rank?.name ?? "";

        if (!map.has(employeeId)) {
            map.set(employeeId, {
                employeeId,
                name,
                rankName,
                rows: [],
                totalCartons: 0,
                totalAmount: 0,
            });
        }

        const g = map.get(employeeId);
        g.rows.push(row);
        g.totalCartons += Number(row?.cartonCount) || 0;
        g.totalAmount += safeNumber(row?.amount);
    }

    const groups = Array.from(map.values());

    groups.forEach((g) =>
        g.rows.sort(
            (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        )
    );

    groups.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return groups;
}

const CartonSalesPage = () => {
    const { activeCompanyId } = useCompany();
    const companyId = Number(activeCompanyId);

    const { has, isReady } = usePermissions();

    const canView = useMemo(() => {
        if (!companyId || !isReady) return false;
        return has(PERMISSIONS.CARTON_SALES_VIEW) || has(`BOXS.${companyId}.CARTON_SALES.VIEW`);
    }, [companyId, isReady, has]);

    const canEdit = useMemo(() => {
        if (!companyId || !isReady) return false;
        return has(PERMISSIONS.CARTON_SALES_EDIT) || has(`BOXS.${companyId}.CARTON_SALES.EDIT`);
    }, [companyId, isReady, has]);

    // Week selector: { year, week }
    const [weekParams, setWeekParams] = useState(() => {
        const now = new Date();
        return { year: getYear(now), week: getISOWeek(now) };
    });

    const { startDate, endDate, start, end } = useMemo(
        () => weekParamsToRange(weekParams),
        [weekParams]
    );

    // Filtres serveur (refetch)
    const [redistributionNumber, setRedistributionNumber] = useState("");
    const [minCartons, setMinCartons] = useState("");
    const [maxCartons, setMaxCartons] = useState("");

    // Filtres client (sans refetch)
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Employés tags
    const [employeeOptions, setEmployeeOptions] = useState([]);
    const [selectedEmployees, setSelectedEmployees] = useState([]);

    const onlyOneEmployeeId = useMemo(() => {
        return selectedEmployees.length === 1 ? selectedEmployees[0].id : null;
    }, [selectedEmployees]);

    // Data
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rows, setRows] = useState([]);

    // Summary
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [summary, setSummary] = useState({ count: 0, totalCartons: 0, totalAmount: 0 });

    // Edit modal
    const [editModal, setEditModal] = useState({ open: false, row: null });
    const [editForm, setEditForm] = useState({
        cartonCount: "",
        reason: "",
        redistributionNumber: "",
    });
    const [saving, setSaving] = useState(false);

    // Anti race
    const requestSeq = useRef(0);

    // Params stable (évite double reload)
    const paramsRef = useRef({
        companyId: null,
        startDate: null,
        endDate: null,
        redistributionNumber: "",
        minCartons: "",
        maxCartons: "",
        onlyOneEmployeeId: null,
    });

    useEffect(() => {
        paramsRef.current = {
            companyId,
            startDate,
            endDate,
            redistributionNumber,
            minCartons,
            maxCartons,
            onlyOneEmployeeId,
        };
    }, [
        companyId,
        startDate,
        endDate,
        redistributionNumber,
        minCartons,
        maxCartons,
        onlyOneEmployeeId,
    ]);

    // Debounce search (client only)
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    const load = useCallback(async (isRefresh = false) => {
        const p = paramsRef.current;
        if (!p.companyId) return;

        const seq = ++requestSeq.current;

        try {
            isRefresh ? setRefreshing(true) : setLoading(true);
            setSummaryLoading(true);

            const listFilters = {
                page: 1,
                limit: 5000,
                startDate: p.startDate,
                endDate: p.endDate,
                redistributionNumber: p.redistributionNumber || undefined,
                minCartons: p.minCartons !== "" ? Number(p.minCartons) : undefined,
                maxCartons: p.maxCartons !== "" ? Number(p.maxCartons) : undefined,
                companyEmployeeId: p.onlyOneEmployeeId ? Number(p.onlyOneEmployeeId) : undefined,
            };

            const summaryFilters = {
                startDate: p.startDate,
                endDate: p.endDate,
                companyEmployeeId: p.onlyOneEmployeeId ? Number(p.onlyOneEmployeeId) : undefined,
            };

            const [listRes, summaryRes] = await Promise.all([
                fetchCartonSales(listFilters),
                fetchCartonSalesSummary(summaryFilters),
            ]);

            if (seq !== requestSeq.current) return;

            const listData = Array.isArray(listRes?.data) ? listRes.data : [];
            setRows(listData);
            setEmployeeOptions(uniqEmployeeOptions(listData));

            setSummary({
                count: summaryRes?.count ?? 0,
                totalCartons: summaryRes?.totalCartons ?? 0,
                totalAmount: safeNumber(summaryRes?.totalAmount),
            });
        } catch (e) {
            console.error(e);
            toast.error("Impossible de charger les déclarations de cartons.");
        } finally {
            if (seq === requestSeq.current) {
                setLoading(false);
                setRefreshing(false);
                setSummaryLoading(false);
            }
        }
    }, []);

    // A) Semaine => reload immédiat (une seule fois)
    useEffect(() => {
        if (!companyId || !isReady || !canView) return;
        load(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId, isReady, canView, weekParams]);

    // B) Filtres serveur => debounce 350ms
    useEffect(() => {
        if (!companyId || !isReady || !canView) return;

        const t = setTimeout(() => load(false), 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId, isReady, canView, redistributionNumber, minCartons, maxCartons, selectedEmployees]);

    const filteredRows = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        const selectedIds = new Set(selectedEmployees.map((e) => e.id));
        const useEmployeeFilter = selectedIds.size > 0;

        return (rows || []).filter((row) => {
            const ce = row?.companyEmployee;
            const empId = ce?.id ?? row?.companyEmployeeId;

            if (useEmployeeFilter && empId && !selectedIds.has(empId)) return false;

            if (!q) return true;

            const name = (ce?.user?.name ?? "").toLowerCase();
            const reason = (row?.reason ?? "").toLowerCase();
            const redis = (row?.redistributionNumber ?? "").toLowerCase();
            const txn = String(row?.transactionId ?? "");

            return name.includes(q) || reason.includes(q) || redis.includes(q) || txn.includes(q);
        });
    }, [rows, debouncedSearch, selectedEmployees]);

    const groups = useMemo(() => groupByEmployee(filteredRows), [filteredRows]);

    const totalsDisplayed = useMemo(() => {
        const totalCartons = filteredRows.reduce((acc, r) => acc + (Number(r?.cartonCount) || 0), 0);
        const totalAmount = filteredRows.reduce((acc, r) => acc + safeNumber(r?.amount), 0);
        return { totalCartons, totalAmount };
    }, [filteredRows]);

    const resetFilters = () => {
        setSearch("");
        setRedistributionNumber("");
        setMinCartons("");
        setMaxCartons("");
        setSelectedEmployees([]);
    };

    const openEdit = (row) => {
        setEditModal({ open: true, row });
        setEditForm({
            cartonCount: String(row?.cartonCount ?? 0),
            reason: String(row?.reason ?? ""),
            redistributionNumber: String(row?.redistributionNumber ?? ""),
        });
    };

    const closeEdit = () => {
        if (saving) return;
        setEditModal({ open: false, row: null });
    };

    const saveEdit = async () => {
        const row = editModal.row;
        if (!row?.id) return;

        const cartonCount = parseInt(editForm.cartonCount, 10);
        if (!Number.isFinite(cartonCount) || cartonCount < 0) {
            toast.error("Cartons invalide.");
            return;
        }

        const reason = (editForm.reason || "").trim();
        if (!reason) {
            toast.error("Raison invalide.");
            return;
        }

        const redistributionNumber = (editForm.redistributionNumber || "").trim();

        try {
            setSaving(true);

            await updateCartonSale(row.id, {
                cartonCount,
                reason,
                redistributionNumber: redistributionNumber ? redistributionNumber : "", // backend => null si vide
            });

            toast.success("Déclaration mise à jour.");
            closeEdit();
            await load(true);
        } catch (e) {
            console.error(e);
            toast.error(e?.message || "Impossible de modifier la déclaration.");
        } finally {
            setSaving(false);
        }
    };

    if (!companyId) {
        return (
            <div className="p-4">
                <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 p-4 text-slate-200">
                    Aucune entreprise sélectionnée.
                </div>
            </div>
        );
    }

    if (!isReady) {
        return (
            <div className="p-4">
                <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 p-4 text-slate-200 flex items-center gap-3">
                    <Spinner />
                    <span>Chargement des accès...</span>
                </div>
            </div>
        );
    }

    if (!canView) {
        return (
            <div className="p-4">
                <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 p-4 text-slate-200">
                    Accès refusé.
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-wide">Déclarations cartons</h1>
                    <p className="text-slate-400 mt-1 text-sm">Vue hebdomadaire + récapitulatif par employé.</p>
                </div>

                <Button onClick={() => load(true)} disabled={loading || refreshing}>
                    {refreshing ? "Actualisation..." : "Rafraîchir"}
                </Button>
            </div>

            {/* Week selector */}
            <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 p-4 shadow-lg backdrop-blur-md">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <WeekSelector onWeekChange={setWeekParams} />
                    <div className="text-sm text-slate-300">
            <span className="font-semibold">
              {format(start, "PPP", { locale: fr })} → {format(end, "PPP", { locale: fr })}
            </span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 p-4 shadow-lg backdrop-blur-md space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-2">
                        <label className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 block">
                            Rechercher
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-lg bg-slate-900/60 border border-slate-700/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Employé, redistribution, raison…"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 block">
                            Employés (tags)
                        </label>
                        <Autocomplete
                            multiple
                            options={employeeOptions}
                            value={selectedEmployees}
                            onChange={(_, value) => setSelectedEmployees(Array.isArray(value) ? value : [])}
                            getOptionLabel={(opt) => (opt?.rankName ? `${opt.name} (${opt.rankName})` : opt?.name || "")}
                            filterSelectedOptions
                            renderTags={(tagValue, getTagProps) =>
                                tagValue.map((option, index) => (
                                    <Chip
                                        label={option?.rankName ? `${option.name} (${option.rankName})` : option?.name}
                                        {...getTagProps({ index })}
                                        key={option.id}
                                    />
                                ))
                            }
                            renderInput={(params) => <TextField {...params} placeholder="Sélectionner…" size="small" />}
                        />
                    </div>

                    <div>
                        <label className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 block">
                            Redistribution
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-lg bg-slate-900/60 border border-slate-700/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
                            value={redistributionNumber}
                            onChange={(e) => setRedistributionNumber(e.target.value)}
                            placeholder="ex: 42045"
                        />
                    </div>

                    <div>
                        <label className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 block">
                            Cartons min
                        </label>
                        <input
                            type="number"
                            min="0"
                            className="w-full rounded-lg bg-slate-900/60 border border-slate-700/80 px-3 py-2.5 text-sm text-slate-100"
                            value={minCartons}
                            onChange={(e) => setMinCartons(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 block">
                            Cartons max
                        </label>
                        <input
                            type="number"
                            min="0"
                            className="w-full rounded-lg bg-slate-900/60 border border-slate-700/80 px-3 py-2.5 text-sm text-slate-100"
                            value={maxCartons}
                            onChange={(e) => setMaxCartons(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button onClick={resetFilters} disabled={loading || refreshing}>
                        Réinitialiser
                    </Button>
                </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 p-4 shadow-lg backdrop-blur-md">
                {summaryLoading ? (
                    <div className="text-slate-300 flex items-center gap-2">
                        <Spinner />
                        <span>Chargement du résumé…</span>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div className="text-slate-200">
                            Déclarations : <span className="font-semibold">{summary.count}</span>
                        </div>
                        <div className="text-slate-200">
                            Total cartons : <span className="font-semibold">{summary.totalCartons}</span>
                        </div>
                        <div className="text-slate-200">
                            Total montant :{" "}
                            <span className="font-semibold">{safeNumber(summary.totalAmount).toFixed(2)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Totaux affichés */}
            <div className="text-xs text-slate-400">
                Affiché : cartons{" "}
                <span className="text-slate-200 font-semibold">{totalsDisplayed.totalCartons}</span> · montant{" "}
                <span className="text-slate-200 font-semibold">{totalsDisplayed.totalAmount.toFixed(2)}</span>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex justify-center py-10">
                    <Spinner />
                </div>
            ) : groups.length === 0 ? (
                <div className="text-center py-10 text-slate-400">Aucune déclaration.</div>
            ) : (
                <div className="space-y-6">
                    {groups.map((g) => (
                        <div
                            key={g.employeeId}
                            className="rounded-xl bg-slate-900/60 border border-slate-700/50 shadow-lg backdrop-blur-md overflow-hidden"
                        >
                            <div className="p-4 border-b border-slate-700/60 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                <div>
                                    <div className="text-white font-semibold text-lg">{g.name}</div>
                                    <div className="text-slate-400 text-sm">{g.rankName ? `Rang : ${g.rankName}` : "—"}</div>
                                </div>
                                <div className="flex flex-col md:items-end">
                                    <div className="text-slate-200">
                                        Total cartons : <span className="font-semibold">{g.totalCartons}</span>
                                    </div>
                                    <div className="text-slate-200">
                                        Total montant : <span className="font-semibold">{safeNumber(g.totalAmount).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="text-slate-300 bg-slate-900/60 border-b border-slate-700/70">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide border-r border-slate-700/40">
                                            Date
                                        </th>
                                        <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wide border-r border-slate-700/40">
                                            Cartons
                                        </th>
                                        <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wide border-r border-slate-700/40">
                                            Montant
                                        </th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide border-r border-slate-700/40">
                                            Redistribution
                                        </th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide border-r border-slate-700/40">
                                            Raison
                                        </th>
                                        <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wide border-r border-slate-700/40">
                                            Transaction
                                        </th>
                                        {canEdit && (
                                            <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">
                                                Actions
                                            </th>
                                        )}
                                    </tr>
                                    </thead>

                                    <tbody className="text-slate-100 divide-y divide-slate-700/60">
                                    {g.rows.map((row) => {
                                        const dt = row?.occurredAt ? new Date(row.occurredAt) : null;
                                        const amount = safeNumber(row?.amount);

                                        return (
                                            <tr key={row.id} className="hover:bg-slate-800/50 transition">
                                                <td className="px-4 py-3 text-slate-200">
                                                    {dt ? format(dt, "Pp", { locale: fr }) : "—"}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-cyan-300">
                                                    {row?.cartonCount ?? 0}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-green-300">
                                                    {amount.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3">{row?.redistributionNumber ?? "—"}</td>
                                                <td className="px-4 py-3 text-slate-300">{row?.reason ?? "—"}</td>
                                                <td className="px-4 py-3 text-right text-slate-300 font-mono">
                                                    {row?.transactionId ?? "—"}
                                                </td>

                                                {canEdit && (
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={() => openEdit(row)}
                                                            className="rounded-lg px-3 py-1.5 text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
                                                        >
                                                            Modifier
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            {editModal.open && (
                <div className="fixed inset-0 z-[95] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60" onClick={closeEdit} />
                    <div className="relative w-full max-w-lg mx-4 rounded-xl overflow-hidden bg-slate-900/90 border border-slate-700/60 backdrop-blur-xl shadow-2xl">
                        <div className="p-4 border-b border-slate-700/60">
                            <div className="text-white font-semibold text-lg">Modifier la déclaration</div>
                            <div className="text-slate-400 text-sm">
                                ID #{editModal.row?.id} • Transaction #{editModal.row?.transactionId}
                            </div>
                            <div className="text-slate-500 text-xs mt-1">
                                Champs modifiables : cartons, raison, redistribution.
                            </div>
                        </div>

                        <div className="p-4 space-y-3">
                            <div>
                                <label className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 block">
                                    Cartons
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editForm.cartonCount}
                                    onChange={(e) => setEditForm((f) => ({ ...f, cartonCount: e.target.value }))}
                                    className="w-full rounded-lg bg-slate-900/60 border border-slate-700/80 px-3 py-2.5 text-sm text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 block">
                                    Raison
                                </label>
                                <input
                                    type="text"
                                    value={editForm.reason}
                                    onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))}
                                    className="w-full rounded-lg bg-slate-900/60 border border-slate-700/80 px-3 py-2.5 text-sm text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 block">
                                    Redistribution
                                </label>
                                <input
                                    type="text"
                                    value={editForm.redistributionNumber}
                                    onChange={(e) =>
                                        setEditForm((f) => ({ ...f, redistributionNumber: e.target.value }))
                                    }
                                    className="w-full rounded-lg bg-slate-900/60 border border-slate-700/80 px-3 py-2.5 text-sm text-slate-100"
                                    placeholder="ex: 42045 (vide = supprimer)"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-700/60 flex justify-end gap-2">
                            <button
                                onClick={closeEdit}
                                disabled={saving}
                                className="rounded-lg px-4 py-2 text-sm font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition disabled:opacity-60"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={saveEdit}
                                disabled={saving}
                                className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition disabled:opacity-60"
                            >
                                {saving ? "Enregistrement..." : "Enregistrer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CartonSalesPage;
