// frontend/src/pages/dashboard/TransactionJournalPage.jsx

import React, { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { getWeek, getYear } from "date-fns";

import { useCompany } from "@/contexts/CompanyContext.jsx";
import { useWebSocket } from "@/contexts/WebSocketContext";

import Spinner from "@/components/ui/Spinner";
import WeekSelector from "@/components/accounting/WeekSelector";
import TransactionCharts from "@/components/accounting/TransactionCharts";
import TransactionList from "@/components/accounting/TransactionList";
import { motion, AnimatePresence  } from 'framer-motion';

import { getJournalSummary, getTransactionCategories } from "@/services/comptabiliteService";

/* ============================================================================
   Journal des transactions
   - REST: getJournalSummary / getTransactionCategories
   - WS: TRANSACTION_CREATED (buffer si pause/filtre/semaine différente)
   - UI: mobile proche de la page facture
   - FIX MOBILE: overflow-x-hidden + min-w-0 pour éviter le débordement à droite
============================================================================ */

export default function TransactionJournalPage() {
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;

    const { subscribe, unsubscribe } = useWebSocket();

    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);

    const [weekParams, setWeekParams] = useState(() => {
        const now = new Date();
        return {
            year: getYear(now),
            week: getWeek(now, { weekStartsOn: 1 }),
        };
    });

    const [filters, setFilters] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [pageError, setPageError] = useState(null);

    // Mobile chart toggle
    const [showChart, setShowChart] = useState(true);

    // Live WS buffering
    const [livePaused, setLivePaused] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const liveBufferRef = useRef([]);

    const handleWeekChange = useCallback((params) => {
        setWeekParams(params);
        setLivePaused(true);
    }, []);

    const handleFilterChange = useCallback((newFilters) => {
        setFilters((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(newFilters)) return prev;
            setLivePaused(true);
            return newFilters;
        });
    }, []);

    const fetchAllTransactions = useCallback(async () => {
        if (!companyId) return;

        setIsLoading(true);
        setPageError(null);

        try {
            const data = await getJournalSummary(companyId, weekParams, filters);
            setTransactions(Array.isArray(data) ? data : []);

            liveBufferRef.current = [];
            setPendingCount(0);
        } catch (error) {
            const message = error?.response?.data?.message || "Une erreur inconnue est survenue.";
            setPageError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, [companyId, weekParams, filters]);

    useEffect(() => {
        if (!companyId) return;
        fetchAllTransactions();
    }, [companyId, fetchAllTransactions]);

    useEffect(() => {
        if (!companyId) return;

        getTransactionCategories()
            .then((res) => setCategories(Array.isArray(res) ? res : []))
            .catch(() => toast.error("Impossible de charger les catégories."));
    }, [companyId]);

    const handleTransactionUpdate = useCallback((updatedTx) => {
        if (!updatedTx?.id) return;
        setTransactions((prev) => prev.map((tx) => (tx.id === updatedTx.id ? updatedTx : tx)));
    }, []);

    // WS: TRANSACTION_CREATED
    useEffect(() => {
        if (!companyId) return;

        const onTransactionCreated = (payload) => {
            try {
                if (!payload) return;
                if (payload.companyId !== companyId) return;

                const txDate = payload.date ? new Date(payload.date) : null;
                const txWeek = txDate ? getWeek(txDate, { weekStartsOn: 1 }) : null;
                const txYear = txDate ? getYear(txDate) : null;

                const isSameSelectedWeek =
                    txWeek !== null &&
                    txYear !== null &&
                    txWeek === weekParams.week &&
                    txYear === weekParams.year;

                const hasActiveFilters = filters && Object.keys(filters).length > 0;

                if (!isSameSelectedWeek || livePaused || hasActiveFilters) {
                    liveBufferRef.current.push(payload);
                    setPendingCount(liveBufferRef.current.length);
                    return;
                }

                setTransactions((prev) => [payload, ...prev]);
            } catch (err) {
                console.error("[Transactions][WS] handler error:", err);
            }
        };

        subscribe("TRANSACTION_CREATED", onTransactionCreated);
        return () => unsubscribe("TRANSACTION_CREATED", onTransactionCreated);
    }, [companyId, weekParams, filters, livePaused, subscribe, unsubscribe]);

    const applyLiveBuffer = useCallback(() => {
        const buf = liveBufferRef.current;
        if (!buf || buf.length === 0) return;

        const toInsert = [...buf].reverse();
        setTransactions((prev) => [...toInsert, ...prev]);

        liveBufferRef.current = [];
        setPendingCount(0);
        setLivePaused(false);
    }, []);

    if (pageError) {
        return (
            <div className="bg-cca-surface/80 backdrop-blur-xl border border-cca-border/70 shadow-xl shadow-black/40 rounded-xl p-6 sm:p-10 text-center">
                <h2 className="text-xl sm:text-2xl font-bold text-red-400 mb-3 sm:mb-4">Accès Refusé</h2>
                <p className="text-cca-textSecondary text-sm sm:text-base">{pageError}</p>
            </div>
        );
    }

    return (
        // FIX MOBILE: empêche tout débordement horizontal au niveau page
        <div className="space-y-6 overflow-x-hidden max-w-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
                <div className="space-y-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold text-cca-textPrimary">Journal de Transaction</h1>
                    <div className="text-xs text-cca-textSecondary/40">Transactions de votre entreprise (semaine sélectionnée).</div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowChart((v) => !v)}
                        className="px-4 py-2 rounded-lg bg-cca-surface border border-cca-border text-cca-textPrimary text-sm font-medium hover:bg-brand-primary/10 transition-all active:scale-95 flex items-center gap-2"
                    >
                        {showChart ? "Masquer Analyses" : "Afficher Analyses"}
                    </button>
                    <button
                        onClick={() => setLivePaused((v) => !v)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${livePaused ? "bg-cca-base/40 text-cca-textSecondary/60" : "bg-emerald-600 text-white hover:bg-emerald-500"
                            }`}
                    >
                        {livePaused ? "Reprendre" : "Pause live"}
                    </button>
                </div>
            </div>

            {/* Pending WS */}
            {pendingCount > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-600/20 border border-indigo-500/40 min-w-0">
                    <span className="text-indigo-200 text-sm min-w-0 break-words">
                        {pendingCount} mise(s) à jour en attente
                    </span>
                    <button
                        onClick={applyLiveBuffer}
                        className="shrink-0 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
                    >
                        Afficher
                    </button>
                </div>
            )}

            {/* Week + Stats */}
            <div className="flex flex-col gap-6 min-w-0">
                <div className="space-y-4 min-w-0">
                    <div
                        className="relative overflow-hidden rounded-xl bg-gradient-to-r
                            from-cca-base/80 via-cca-surface/90 to-cca-base/80
                            border border-cca-border/70 shadow-lg shadow-black/40 min-w-0"
                    >
                        <div
                            className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen
                                [background:
                                    radial-gradient(circle_at_top,_rgba(79,70,229,0.35),_transparent_55%),
                                    radial-gradient(circle_at_bottom,_rgba(8,47,73,0.6),_transparent_55%)
                                ]"
                        />
                        <div className="relative p-4 md:p-5 space-y-3 min-w-0">
                            <div className="text-sm font-semibold text-cca-textPrimary/80 tracking-wide flex items-center gap-2 min-w-0">
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs text-indigo-300 border border-indigo-500/40 shrink-0">
                                    W
                                </span>
                                Semaine
                            </div>
                            <div className="text-xs text-cca-textSecondary/40">Sélection de la semaine affichée.</div>

                            <div className="rounded-xl border border-cca-border/60 bg-cca-base/40 p-3 min-w-0">
                                <WeekSelector onWeekChange={handleWeekChange} />
                            </div>
                        </div>
                    </div>
                    {showChart && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="min-w-0 overflow-visible"
                        >
                            <div className="bg-cca-surface/30 border border-cca-border p-4 rounded-2xl shadow-lg backdrop-blur-xl">
                                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 mb-4 ml-2">Analyse des flux</h2>
                                <div className="min-w-0">
                                    {isLoading && transactions.length === 0 ? (
                                        <div className="flex justify-center py-10">
                                            <Spinner />
                                        </div>
                                    ) : (
                                        <TransactionCharts transactions={transactions} />
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Content container */}
            <div className="relative rounded-2xl bg-cca-surface/20 border border-cca-border backdrop-blur-xl shadow-2xl shadow-black/40 min-w-0 overflow-hidden">
                {/* Subtle loading overlay */}
                <AnimatePresence>
                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-20 bg-cca-base/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none"
                        >
                            <div className="bg-cca-surface/80 border border-cca-border px-4 py-2 rounded-full flex items-center gap-3 shadow-2xl animate-pulse">
                                <Spinner size="sm" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textPrimary">Sinc. Audit...</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className={`p-2 sm:p-4 min-w-0 transition-all duration-500 ${isLoading ? 'scale-[0.99] grayscale-[0.3]' : 'scale-100 grayscale-0'}`}>
                    <TransactionList
                        companyId={companyId}
                        transactions={transactions}
                        categories={categories}
                        onFilterChange={handleFilterChange}
                        onUpdate={handleTransactionUpdate}
                    />
                </div>
            </div>
        </div>
    );
};
