// frontend/src/pages/dashboard/products/ProductDeclarationsWeeklySummaryPage.jsx

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import Spinner from "@/components/ui/Spinner";
import Button from "@/components/ui/button";
import { useCompany } from "@/contexts/CompanyContext.jsx";

import { fetchWeeklyDeclarationsSummary } from "@/services/productsService";

/* ---------------- ISO WEEK helpers (for default value) ---------------- */

function pad2(n) {
    return String(n).padStart(2, "0");
}

function getISOWeekYearAndWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7; // Mon=1..Sun=7
    d.setUTCDate(d.getUTCDate() + (4 - day)); // Thursday
    const isoYear = d.getUTCFullYear();

    const firstThu = new Date(Date.UTC(isoYear, 0, 4));
    const firstThuDay = firstThu.getUTCDay() || 7;
    firstThu.setUTCDate(firstThu.getUTCDate() + (4 - firstThuDay));

    const diffMs = d.getTime() - firstThu.getTime();
    const isoWeek = 1 + Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

    return { isoYear, isoWeek };
}

function weekInputValueFromDate(date) {
    const { isoYear, isoWeek } = getISOWeekYearAndWeek(date);
    return `${isoYear}-W${pad2(isoWeek)}`;
}

/* ---------------- UI wrappers (same “glass” vibe) ---------------- */

function GlassSection({ title, children }) {
    return (
        <div className="relative overflow-hidden rounded-xl bg-cca-surface border border-cca-border shadow-2xl shadow-black/40 p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-sm font-semibold text-cca-textPrimary tracking-wide">{title}</h2>
            </div>
            {children}
        </div>
    );
}

function GlassCard({ children }) {
    return (
        <div className="relative overflow-hidden rounded-xl bg-cca-surface border border-cca-border shadow-xl shadow-black/40">
            {children}
        </div>
    );
}

/* ---------------- Page ---------------- */

export default function ProductDeclarationsWeeklySummaryPage() {
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;

    const [weekValue, setWeekValue] = useState(() => weekInputValueFromDate(new Date()));
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);

    const [mode, setMode] = useState("SELF");
    const [range, setRange] = useState({ startDate: null, endDate: null });

    // items: flat list
    // [{ employeeId, employeeName, productId, productName, productIsActive, totalQuantity }]
    const [items, setItems] = useState([]);

    const toNumber = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    const load = async () => {
        if (!companyId) return;

        try {
            setLoading(true);
            const data = await fetchWeeklyDeclarationsSummary(companyId, { week: weekValue });

            setMode(data?.mode || "SELF");
            setRange(data?.range || { startDate: null, endDate: null });
            setItems(Array.isArray(data?.items) ? data.items : []);
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors du chargement du récapitulatif hebdomadaire.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!companyId) return;
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId, weekValue]);

    const grouped = useMemo(() => {
        // group by employee
        const map = new Map();

        for (const it of items) {
            const employeeId = Number(it.employeeId);
            const productId = Number(it.productId);

            const employeeName = it.employeeName || `Employé #${employeeId}`;
            const productName = it.productName || `Produit #${productId}`;
            const productIsActive = it.productIsActive ?? true;
            const totalQuantity = toNumber(it.totalQuantity);

            if (!map.has(employeeId)) {
                map.set(employeeId, {
                    employeeId,
                    employeeName,
                    totalQuantity: 0,
                    products: [],
                });
            }

            const entry = map.get(employeeId);
            entry.totalQuantity += totalQuantity;
            entry.products.push({
                productId,
                productName,
                productIsActive,
                totalQuantity,
            });
        }

        // sort products per employee
        for (const entry of map.values()) {
            entry.products.sort((a, b) => a.productName.localeCompare(b.productName));
        }

        // to array + sort employees
        const out = Array.from(map.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
        return out;
    }, [items]);

    const filteredGrouped = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return grouped;

        return grouped
            .map((u) => {
                const matchUser = u.employeeName.toLowerCase().includes(q) || String(u.employeeId).includes(q);

                const products = u.products.filter((p) => {
                    return (
                        p.productName.toLowerCase().includes(q) ||
                        String(p.productId).includes(q)
                    );
                });

                if (matchUser) return u;
                if (products.length === 0) return null;

                return { ...u, products };
            })
            .filter(Boolean);
    }, [grouped, search]);

    const stats = useMemo(() => {
        const usersCount = filteredGrouped.length;
        const linesCount = filteredGrouped.reduce((acc, u) => acc + u.products.length, 0);
        const grandTotal = filteredGrouped.reduce((acc, u) => acc + toNumber(u.totalQuantity), 0);
        return { usersCount, linesCount, grandTotal };
    }, [filteredGrouped]);

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-cca-textPrimary">Récapitulatif hebdomadaire</h1>
                    <p className="text-sm text-cca-textSecondary mt-1">
                        Quantités totales par employé et par produit (semaine ISO). Mode: {mode}
                        {range?.startDate && range?.endDate ? ` — Période: ${range.startDate} → ${range.endDate}` : ""}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        onClick={load}
                        className="bg-indigo-600 hover:bg-indigo-700"
                        disabled={loading}
                    >
                        Actualiser
                    </Button>
                </div>
            </div>

            <GlassSection title="Sélection et recherche">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wide text-cca-textSecondary block">
                            Semaine
                        </label>
                        <input
                            type="week"
                            value={weekValue}
                            onChange={(e) => setWeekValue(e.target.value)}
                            className="w-full rounded-lg bg-cca-base border border-cca-border
                         px-3 py-2.5 text-sm text-cca-textPrimary focus:border-indigo-400 outline-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wide text-cca-textSecondary block">
                            Recherche (employé / produit)
                        </label>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Ex: Alice ou Carton"
                            className="w-full rounded-lg bg-cca-base border border-cca-border
                         px-3 py-2.5 text-sm text-cca-textPrimary focus:border-indigo-400 outline-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wide text-cca-textSecondary block">
                            Résumé
                        </label>
                        <div className="rounded-lg bg-cca-base border border-cca-border px-3 py-2.5 text-sm text-cca-textPrimary">
                            {loading
                                ? "Chargement…"
                                : `${stats.usersCount} employés • ${stats.linesCount} lignes • Total: ${stats.grandTotal.toFixed(2)}`}
                        </div>
                    </div>
                </div>
            </GlassSection>

            {loading ? (
                <div className="flex justify-center py-10">
                    <Spinner />
                </div>
            ) : filteredGrouped.length === 0 ? (
                <GlassCard>
                    <div className="p-6 text-cca-textSecondary text-center">
                        Aucun résultat pour la semaine sélectionnée.
                    </div>
                </GlassCard>
            ) : (
                <div className="space-y-4">
                    {filteredGrouped.map((u) => (
                        <GlassCard key={u.employeeId}>
                            <div className="p-4 md:p-5 border-b border-cca-border flex items-start justify-between gap-4">
                                <div>
                                    <div className="text-cca-textPrimary font-semibold">
                                        {u.employeeName}
                                        <span className="text-xs text-cca-textSecondary font-normal ml-2">#{u.employeeId}</span>
                                    </div>
                                    <div className="text-xs text-cca-textSecondary mt-1">
                                        {u.products.length} produit(s) — Total semaine:{" "}
                                        <span className="text-cca-textPrimary font-semibold">{toNumber(u.totalQuantity).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-cca-textSecondary">
                                    <thead className="bg-cca-base text-cca-textPrimary">
                                    <tr>
                                        <th className="p-3 text-left whitespace-nowrap">Produit</th>
                                        <th className="p-3 text-center whitespace-nowrap">Statut</th>
                                        <th className="p-3 text-right whitespace-nowrap">Quantité totale</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {u.products.map((p) => (
                                        <tr
                                            key={`${u.employeeId}:${p.productId}`}
                                            className="border-b border-cca-border hover:bg-cca-base/40 transition"
                                        >
                                            <td className="p-3">
                                                <div className="text-cca-textPrimary font-medium">{p.productName}</div>
                                                <div className="text-xs text-cca-textSecondary">Produit #{p.productId}</div>
                                            </td>
                                            <td className="p-3 text-center">
                          <span
                              className={
                                  "text-[11px] px-2 py-0.5 rounded-full border " +
                                  (p.productIsActive
                                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                      : "bg-amber-500/10 text-amber-300 border-amber-500/30")
                              }
                          >
                            {p.productIsActive ? "Actif" : "Désactivé"}
                          </span>
                                            </td>
                                            <td className="p-3 text-right font-semibold text-cca-textPrimary">
                                                {toNumber(p.totalQuantity).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}
        </div>
    );
}
