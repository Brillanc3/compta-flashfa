import React, { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getISOWeek, getISOWeekYear, format } from "date-fns";
import { Calendar } from "lucide-react";

import apiClient from "@/services/api";
import WeekSelector from "@/components/accounting/WeekSelector.jsx";

const money = (value) => {
    const n = Number(value || 0);
    return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " $";
};

const MyTurnoverWidget = ({ config = {} }) => {
    const enableCalendar = !!config.enableCalendar;
    const includePartnerServices = !!config.includePartnerServices;

    const now = new Date();
    const [mode, setMode] = useState("WEEK");
    const [weekState, setWeekState] = useState({
        year: getISOWeekYear(now),
        week: getISOWeek(now),
    });

    const [calendarOpen, setCalendarOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState(format(now, "yyyy-MM-dd"));

    const params = useMemo(() => {
        const base = enableCalendar && mode === "DAY"
            ? { mode: "DAY", date: selectedDay }
            : { mode: "WEEK", year: weekState.year, week: weekState.week };
        return { ...base, includePartnerServices };
    }, [enableCalendar, mode, selectedDay, weekState.year, weekState.week, includePartnerServices]);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["widget", "MY_TURNOVER", params],
        queryFn: async () => {
            const res = await apiClient.get("/employees/widgets/my_turnover", { params });
            return res.data;
        },
        staleTime: 30_000,
    });

    const totals = data?.totals || {};
    const byStatus = data?.byStatus || [];
    const period = data?.period || null;

    const onWeekChange = useCallback(({ year, week }) => {
        setWeekState((prev) => {
            if (prev.year === year && prev.week === week) return prev;
            return { year, week };
        });
        setMode("WEEK");
    }, []);

    const onPickDay = (e) => {
        setSelectedDay(e.target.value);
        setMode("DAY");
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-cca-textPrimary font-black text-sm uppercase tracking-widest opacity-80">Chiffre d&apos;Affaire</div>
                    <div className="text-[10px] text-cca-textSecondary font-bold uppercase tracking-tighter opacity-50 mt-1">
                        {period?.mode === "DAY"
                            ? `AUDIT JOURNALIER : ${period?.date || selectedDay}`
                            : `AUDIT HEBDOMADAIRE : SEM ${String(weekState.week).padStart(2, "0")} / ${weekState.year}`}
                    </div>
                </div>

                {enableCalendar && (
                    <button
                        onClick={() => setCalendarOpen((v) => !v)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cca-base/40 border border-cca-border/20 text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface/30 transition-all text-[10px] font-black uppercase tracking-widest"
                        title="Ouvrir/fermer le calendrier"
                    >
                        <Calendar size={14} />
                        <span>Filtres</span>
                    </button>
                )}
            </div>

            <div className="origin-top-left scale-[0.92] -ml-2 -mt-2">
                <WeekSelector onWeekChange={onWeekChange} />
            </div>

            {enableCalendar && calendarOpen && (
                <div className="bg-cca-base/60 border border-cca-border/20 backdrop-blur-md rounded-2xl p-4 flex flex-col gap-4 shadow-2xl">
                    <div className="flex items-center gap-2 p-1 bg-cca-base/40 rounded-xl border border-cca-border/10">
                        <button
                            onClick={() => setMode("WEEK")}
                            className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                                mode === "WEEK" ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-cca-textSecondary/60 hover:bg-cca-surface/20"
                            }`}
                        >
                            Semaine
                        </button>
                        <button
                            onClick={() => setMode("DAY")}
                            className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                                mode === "DAY" ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-cca-textSecondary/60 hover:bg-cca-surface/20"
                            }`}
                        >
                            Jour
                        </button>
                    </div>

                    {mode === "DAY" && (
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-cca-textSecondary/40 uppercase tracking-widest ml-1">Sélection Date</label>
                            <input
                                type="date"
                                value={selectedDay}
                                onChange={onPickDay}
                                className="bg-cca-base/40 border border-cca-border/20 rounded-xl px-4 py-3 text-sm text-cca-textPrimary font-bold outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all"
                            />
                        </div>
                    )}
                </div>
            )}

            <div className="bg-cca-base/40 border border-cca-border/20 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all">
                {isLoading && <div className="text-cca-textSecondary/40 italic text-[10px] uppercase font-black tracking-widest text-center py-6">Calcul en cours…</div>}
                {isError && <div className="text-rose-400 font-black text-[10px] uppercase text-center py-6">Échec de l&apos;audit financier</div>}

                {!isLoading && !isError && (
                    <>
                        {/* Montant principal : factures payées (+ partenaire si activé) */}
                        <div className="text-4xl font-black text-cca-textPrimary tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.05)]">{money(totals.amount)}</div>
                        <div className="mt-1 text-[10px] font-black uppercase text-cca-textSecondary/40 tracking-widest">
                            {totals.paidCount || 0} FACTURE(S) PAYÉE(S)
                            {includePartnerServices && totals.partnerCount > 0 && ` + ${totals.partnerCount} PRESTATION(S) PARTENAIRE`}
                        </div>

                        {/* 3 cartes statuts */}
                        <div className="mt-6 grid grid-cols-3 gap-3">
                            {/* Payées */}
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 group hover:bg-emerald-500/20 transition-all">
                                <div className="text-[9px] font-black uppercase text-emerald-500/60 tracking-widest mb-1">PAYÉES</div>
                                <div className="text-cca-textPrimary font-black text-lg group-hover:scale-105 transition-transform origin-left">{money(totals.paidAmount)}</div>
                                <div className="text-[9px] font-bold text-emerald-500/40 mt-1 uppercase leading-none">{totals.paidCount || 0} REÇU(S)</div>
                            </div>

                            {/* En attente */}
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 group hover:bg-amber-500/20 transition-all">
                                <div className="text-[9px] font-black uppercase text-amber-500/60 tracking-widest mb-1">EN ATTENTE</div>
                                <div className="text-cca-textPrimary font-black text-lg group-hover:scale-105 transition-transform origin-left">{money(totals.pendingAmount)}</div>
                                <div className="text-[9px] font-bold text-amber-500/40 mt-1 uppercase leading-none">{totals.pendingCount || 0} ATTENTE(S)</div>
                            </div>

                            {/* Annulées */}
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 group hover:bg-rose-500/20 transition-all">
                                <div className="text-[9px] font-black uppercase text-rose-500/60 tracking-widest mb-1">ANNULÉES</div>
                                <div className="text-cca-textPrimary font-black text-lg group-hover:scale-105 transition-transform origin-left">{money(totals.canceledAmount)}</div>
                                <div className="text-[9px] font-bold text-rose-500/40 mt-1 uppercase leading-none">{totals.canceledCount || 0} ANNULÉE(S)</div>
                            </div>
                        </div>

                        {/* Prestation partenaire (si activé) */}
                        {includePartnerServices && (totals.partnerAmount > 0 || totals.partnerCount > 0) && (
                            <div className="mt-3 bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4 group hover:bg-violet-500/20 transition-all">
                                <div className="text-[9px] font-black uppercase text-violet-500/60 tracking-widest mb-1">PRESTATIONS PARTENAIRE</div>
                                <div className="text-cca-textPrimary font-black text-lg group-hover:scale-105 transition-transform origin-left">{money(totals.partnerAmount)}</div>
                                <div className="text-[9px] font-bold text-violet-500/40 mt-1 uppercase leading-none">{totals.partnerCount || 0} PRESTATION(S)</div>
                            </div>
                        )}

                        {byStatus.length > 0 && (
                            <div className="mt-8">
                                <div className="text-[10px] font-black text-cca-textSecondary/40 uppercase tracking-[0.2em] mb-4 border-b border-cca-border/10 pb-2">RÉPARTITION PAR STATUT</div>
                                <div className="space-y-1.5">
                                    {byStatus.map((s) => (
                                        <div key={s.status} className="flex items-center justify-between bg-cca-base/40 border border-cca-border/20 rounded-xl px-4 py-3 hover:bg-cca-surface/20 transition-all group">
                                            <div className="text-[10px] font-black text-cca-textSecondary group-hover:text-brand-primary transition-colors uppercase tracking-widest">{s.status}</div>
                                            <div className="text-xs font-black text-cca-textPrimary">{money(s.amount)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default MyTurnoverWidget;
