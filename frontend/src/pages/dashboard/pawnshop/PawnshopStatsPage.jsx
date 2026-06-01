// frontend/src/pages/dashboard/pawnshop/PawnshopStatsPage.jsx

import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BarChart2 } from "lucide-react";

import { usePermissions } from "@/contexts/PermissionsContext.jsx";
import Spinner from "@/components/ui/Spinner";
import { getPurchaseStatsByEmployee } from "@/services/pawnshopService.js";

/* ---------- Utils ---------- */
function fmtMoney(v) {
    const n = Number(v ?? 0);
    return Number.isFinite(n)
        ? n.toLocaleString("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 2 })
        : "0,00 $US";
}

/* ---------- Glass UI ---------- */
function GlassCard({ title, subtitle, right, children, className = "" }) {
    return (
        <div className={["relative rounded-3xl p-6 overflow-hidden bg-cca-surface/30 border border-cca-border/40 backdrop-blur-2xl shadow-2xl shadow-black/30", className].join(" ")}>
            <div className="pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light [background:radial-gradient(circle_at_top_left,rgba(99,102,241,0.15),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(8,47,73,0.40),transparent_55%)]" />
            {(title || right) && (
                <div className="relative flex items-start justify-between gap-4 mb-4">
                    <div>
                        {title && <div className="text-xl font-bold text-cca-textPrimary">{title}</div>}
                        {subtitle && <div className="text-sm text-cca-textSecondary/40 mt-1">{subtitle}</div>}
                    </div>
                    {right ? <div className="shrink-0">{right}</div> : null}
                </div>
            )}
            <div className="relative">{children}</div>
        </div>
    );
}

function GlassButton({ children, className = "", ...props }) {
    return (
        <button className={["px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 bg-cca-base/40 hover:bg-cca-base/60 border border-cca-border/40 backdrop-blur-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed", className].join(" ")} {...props}>
            {children}
        </button>
    );
}

function GlassInput({ className = "", ...props }) {
    return (
        <input className={["w-full px-4 py-2 rounded-xl text-sm bg-cca-base/40 border border-cca-border/40 text-cca-textPrimary placeholder:text-cca-textSecondary/40 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60 transition-all", className].join(" ")} {...props} />
    );
}

/* ---------- Page ---------- */
export default function PawnshopStatsPage() {
    const { has, isReady } = usePermissions();
    const canViewAll = has("PAWNSHOP.PURCHASES.VIEW_ALL");

    const [dateStart, setDateStart] = useState("");
    const [dateEnd, setDateEnd] = useState("");
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);

    async function onLoad(start, end) {
        setLoading(true);
        try {
            const data = await getPurchaseStatsByEmployee({
                dateStart: (start ?? dateStart) || undefined,
                dateEnd: (end ?? dateEnd) || undefined,
            });
            setStats(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error(err?.response?.data?.message || "Erreur lors du chargement.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (isReady && canViewAll) onLoad();
    }, [isReady, canViewAll]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!isReady) return <div className="p-8 text-cca-textSecondary/40 text-center">Chargement…</div>;

    if (!canViewAll) {
        return (
            <div className="p-8 text-cca-textSecondary/40 text-center">
                Accès refusé.
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <GlassCard title="Classement vendeurs" subtitle="Total achats validés par employé">
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-3 items-end">
                        <div>
                            <div className="text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/40 mb-1">Début</div>
                            <GlassInput type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-44" />
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-widest font-black text-cca-textSecondary/40 mb-1">Fin</div>
                            <GlassInput type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-44" />
                        </div>
                        <GlassButton onClick={() => onLoad()} disabled={loading} type="button" className="bg-indigo-600/20 hover:bg-indigo-600/30">
                            <BarChart2 size={16} />
                            {loading ? "Chargement…" : "Calculer"}
                        </GlassButton>
                    </div>

                    {loading && <div className="flex justify-center py-8"><Spinner /></div>}

                    {!loading && stats === null && (
                        <div className="text-cca-textSecondary/40 text-sm">Sélectionnez une période puis cliquez sur Calculer.</div>
                    )}

                    {!loading && stats !== null && (
                        stats.length === 0 ? (
                            <div className="text-cca-textSecondary/40 text-sm">Aucun achat validé sur cette période.</div>
                        ) : (
                            <div className="overflow-x-auto rounded-2xl border border-cca-border/40">
                                <table className="min-w-full text-sm text-cca-textPrimary border-separate border-spacing-0">
                                    <thead className="bg-cca-base/80">
                                        <tr>
                                            <th className="py-3 px-4 text-left text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/60 border-b border-cca-border/30">#</th>
                                            <th className="py-3 px-4 text-left text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/60 border-b border-cca-border/30">Vendeur</th>
                                            <th className="py-3 px-4 text-right text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/60 border-b border-cca-border/30">Feuilles</th>
                                            <th className="py-3 px-4 text-right text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/60 border-b border-cca-border/30">Total achat</th>
                                            <th className="py-3 px-4 text-right text-[9px] font-black uppercase tracking-widest text-cca-textSecondary/60 border-b border-cca-border/30">Total revente</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-cca-border/30">
                                        {stats.map((row, idx) => (
                                            <tr key={row.employeeId} className="hover:bg-cca-surface/30 transition-all">
                                                <td className="py-3 px-4 font-black text-cca-textSecondary/60">#{idx + 1}</td>
                                                <td className="py-3 px-4 font-semibold">{row.employee?.user?.name || `Employé #${row.employeeId}`}</td>
                                                <td className="py-3 px-4 text-right font-mono">{row.purchaseCount}</td>
                                                <td className="py-3 px-4 text-right font-mono text-amber-300">{fmtMoney(row.totalBuyAmount)}</td>
                                                <td className="py-3 px-4 text-right font-mono text-emerald-400">{fmtMoney(row.totalResaleAmount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>
            </GlassCard>
        </div>
    );
}
