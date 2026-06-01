// /frontend/src/pages/dashboard/DeclarationPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { getTaxDeclaration } from '@/services/comptabiliteService';
import WeekSelector from '@/components/accounting/WeekSelector';
import Spinner from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import { getISOWeek, getYear } from 'date-fns';
import {
    TrendingUp,
    TrendingDown,
    FileText,
    Gift,
    Target,
    Eye,
    EyeOff,
    Download
} from 'lucide-react';
import { useCompany } from "@/contexts/CompanyContext.jsx";

/* ============================================================================
    STAT CARD — Glass Premium
============================================================================ */
const StatCard = ({ title, value, icon, color = 'text-cca-textPrimary' }) => (
    <div className="
        relative overflow-hidden rounded-3xl
        bg-cca-surface/20 border border-cca-border backdrop-blur-3xl
        shadow-2xl shadow-black/40 p-8 group
    ">
        {/* Halo effect */}
        <div className="absolute -inset-1 bg-gradient-to-tr from-brand-primary/0 via-brand-primary/5 to-brand-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

        <div className="relative flex items-center gap-6">
            <div className={`p-4 rounded-2xl bg-cca-base/40 border border-cca-border shadow-inner ${color}`}>
                {React.cloneElement(icon, { size: 28 })}
            </div>
            <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40">{title}</p>
                <p className="text-3xl font-black text-cca-textPrimary font-heading tracking-tight">
                    {Number(value).toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                    })}
                </p>
            </div>
        </div>
    </div>
);

/* ============================================================================
    BREAKDOWN — Glass Sections
============================================================================ */
const DetailBreakdown = ({ breakdown }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-4 animate-in slide-in-from-top-4 duration-500">

        {[
            { title: 'Flux des Revenus', data: breakdown.revenues, color: 'text-emerald-400' },
            { title: 'Charges Déductibles', data: breakdown.deductibleExpenses, color: 'text-sky-400' },
            { title: 'Frais Non Déductibles', data: breakdown.nonDeductibleExpenses, color: 'text-rose-400' },
        ].map((section, index) => (
            <div
                key={index}
                className="
                    relative overflow-hidden rounded-3xl
                    bg-cca-surface/20 border border-cca-border backdrop-blur-3xl
                    shadow-xl shadow-black/40 p-6 space-y-6
                "
            >
                <div className="relative">
                    <div className="flex items-center justify-between border-b border-cca-border/50 pb-4 mb-4">
                        <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-cca-textPrimary/90">
                            {section.title}
                        </h3>
                        <div className={`w-2 h-2 rounded-full ${section.color.replace('text-', 'bg-')} shadow-[0_0_10px_rgba(255,255,255,0.2)]`} />
                    </div>

                    <div className="space-y-3">
                        {section.data.length === 0 ? (
                            <p className="text-[10px] font-bold text-cca-textSecondary/20 italic py-2">Aucune donnée archivée</p>
                        ) : section.data.map(item => (
                            <div key={item.name} className="flex justify-between items-center group/item hover:bg-white/5 p-2 rounded-xl transition-all">
                                <span className="text-xs font-bold text-cca-textSecondary/60 group-hover/item:text-cca-textPrimary">{item.name}</span>
                                <span className="font-mono font-black text-sm text-cca-textPrimary">{item.total.toFixed(0)} $</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        ))}
    </div>
);

/* ============================================================================
    MAIN PAGE
============================================================================ */
const DeclarationPage = () => {
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;

    const [declaration, setDeclaration] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);

    const [weekParams, setWeekParams] = useState(() => {
        const now = new Date();
        return {
            year: getYear(now),
            week: getISOWeek(now)
        };
    });

    /* FETCH DATA */
    const fetchDeclaration = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getTaxDeclaration(
                companyId,
                weekParams.year,
                weekParams.week
            );
            setDeclaration(data);
        } catch (error) {
            toast.error(error.message || "Erreur lors du chargement.");
            setDeclaration(null);
        } finally {
            setLoading(false);
        }
    }, [companyId, weekParams]);

    const handleExportJSON = () => {
        if (!declaration) return;

        const findExpense = (list, namePart) => {
            const entry = list.find(e => e.category?.toLowerCase().includes(namePart.toLowerCase()) || e.name?.toLowerCase().includes(namePart.toLowerCase()));
            return entry ? entry.total || entry.deductible || 0 : 0;
        };

        const findIncome = (list, namePart) => {
            const entry = list.find(e => e.name?.toLowerCase().includes(namePart.toLowerCase()));
            return entry ? entry.total || 0 : 0;
        };

        const exportData = {
            "numero_semaine": String(weekParams.week),
            "commentaire": "Importé périodiquement par le système CCA",
            "ca": findIncome(declaration.fullBreakdown.revenues, "Chiffre d'affaires") || 0,
            "autres_revenus": findIncome(declaration.fullBreakdown.revenues, "Autres") || 0,
            "dons_recus": declaration.donationDetails.totalDonations || 0,
            "sacem": 0,
            "caution_encaissee": 0,
            "salaires": findExpense(declaration.expenseDetails, "Masse Salariale") || 0,
            "prime_hebdo": 0,
            "prime_mensuelle": 0,
            "matiere_premiere": findExpense(declaration.expenseDetails, "Matière") || 0,
            "nourriture": findExpense(declaration.expenseDetails, "Nourriture") || 0,
            "frais_avocat": findExpense(declaration.expenseDetails, "Avocat") + findExpense(declaration.expenseDetails, "Comptable"),
            "locations_deductibles": findExpense(declaration.expenseDetails, "Location"),
            "achats_vehicules_deductibles": 0,
            "frais_vehicules": findExpense(declaration.expenseDetails, "Véhicule"),
            "caution_remboursee": 0,
            "dons_verses": findExpense(declaration.expenseDetails, "Dons"),
            "locations_non_deductibles": findIncome(declaration.fullBreakdown.nonDeductibleExpenses, "Location"),
            "achats_vehicules_non_deductibles": findIncome(declaration.fullBreakdown.nonDeductibleExpenses, "Véhicule"),
            "autres_non_deductibles": findIncome(declaration.fullBreakdown.nonDeductibleExpenses, "Autres")
        };

        navigator.clipboard.writeText(JSON.stringify(exportData, null, 2)).then(() => {
            toast.success("Extraction JSON finalisée avec succès !");
        }).catch(() => {
            toast.error("Échec de la génération JSON.");
        });
    };

    useEffect(() => {
        fetchDeclaration();
    }, [fetchDeclaration]);

    /* ============================================================================
        RENDER
    ============================================================================ */
    return (
        <div className="max-w-[1400px] mx-auto space-y-10 pb-16 animate-in fade-in duration-700">

            {/* TITLE & HEADER ACTIONS */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary/80">Expertise Comptable & Fiscalité</p>
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-cca-textPrimary font-heading">Déclaration Périodique</h1>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <WeekSelector onWeekChange={setWeekParams} />

                    <div className="flex items-center gap-3">
                        <button
                            disabled={!declaration}
                            onClick={handleExportJSON}
                            className="
                                h-[52px] px-6 rounded-2xl flex items-center gap-2
                                bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest
                                shadow-xl shadow-brand-primary/20 hover:brightness-110 border border-brand-light/30
                                transition-all active:scale-95 disabled:opacity-50 disabled:grayscale
                            "
                        >
                            <Download size={14} />
                            Exporter Rapport
                        </button>
                        <button
                            disabled={!declaration}
                            onClick={() => setShowDetails(v => !v)}
                            className="
                                h-[56px] px-6 rounded-2xl
                                bg-cca-surface/40 border border-cca-border text-cca-textPrimary text-[10px] font-black uppercase tracking-widest
                                shadow-xl shadow-black/10 hover:bg-cca-surface active:scale-95 transition-all
                                flex items-center gap-2
                            "
                        >
                            {showDetails ? <EyeOff size={14} /> : <Eye size={14} />}
                            {showDetails ? "Masquer Analyses" : "Détails Avancés"}
                        </button>
                    </div>
                </div>
            </div>

            {/* LOADING */}
            {loading && (
                <div className="flex flex-col items-center justify-center p-24 bg-cca-surface/10 rounded-3xl border border-cca-border/20">
                    <Spinner />
                    <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40">Audit en cours...</p>
                </div>
            )}

            {/* NO DATA */}
            {!loading && !declaration && (
                <div className="
                    flex flex-col items-center justify-center py-24 rounded-3xl
                    bg-cca-surface/10 border border-cca-border/20 opacity-30 text-center space-y-4
                ">
                    <FileText size={48} className="text-cca-border" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Aucun registre fiscal identifié pour cette période</p>
                </div>
            )}

            {/* CONTENT */}
            {!loading && declaration && (
                <div className="space-y-10 animate-in fade-in zoom-in-95 duration-500">

                    {/* STATS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <StatCard
                            title="Volume d'Affaires Brut"
                            value={declaration.summary.totalRevenue}
                            icon={<TrendingUp />}
                            color="text-emerald-400"
                        />
                        <StatCard
                            title="Charges Déductibles"
                            value={declaration.summary.totalDeductibleExpenses}
                            icon={<TrendingDown />}
                            color="text-sky-400"
                        />
                        <StatCard
                            title="Marge Imposable"
                            value={declaration.summary.profit}
                            icon={<Target />}
                            color="text-brand-primary"
                        />
                    </div>

                    {/* BREAKDOWN */}
                    {showDetails && (
                        <DetailBreakdown breakdown={declaration.fullBreakdown} />
                    )}

                    {/* TABLE DÉPENSES DÉDUCTIBLES */}
                    <div className="
                        relative overflow-hidden rounded-[2.5rem]
                        bg-cca-surface/30 border border-cca-border/40 backdrop-blur-3xl shadow-2xl shadow-black/30
                    ">
                        <div className="p-8 sm:p-10 border-b border-cca-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h2 className="text-xl sm:text-3xl font-black tracking-tight text-cca-textPrimary font-heading">Registre des Déductions</h2>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/40">Ventilation exhaustive par catégorie analytique</p>
                            </div>
                            <FileText size={24} className="text-cca-textSecondary/20 hidden sm:block" />
                        </div>

                        <div className="overflow-x-auto min-h-[300px]">
                            <table className="min-w-full text-sm text-cca-textPrimary border-separate border-spacing-0">

                                {/* HEADER */}
                                <thead className="bg-cca-base/80 backdrop-blur-md sticky top-0 z-10">
                                    <tr>
                                        <th className="px-10 py-6 text-left text-[9px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/60 border-b border-cca-border/40">
                                            Catégorie Comptable
                                        </th>
                                        <th className="px-10 py-6 text-right text-[9px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/60 border-b border-cca-border/40">
                                            Volume Total
                                        </th>
                                        <th className="px-10 py-6 text-right text-[9px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/60 border-b border-cca-border/40">
                                            Quote-Part Déductible
                                        </th>
                                    </tr>
                                </thead>

                                {/* BODY */}
                                <tbody className="divide-y divide-cca-border/20">
                                    {declaration.expenseDetails.map((exp, idx) => (
                                        <tr
                                            key={idx}
                                            className="group hover:bg-brand-primary/5 transition-all duration-300"
                                        >
                                            <td className="px-10 py-5 font-black text-cca-textPrimary group-hover:text-brand-primary transition-colors tracking-tight">{exp.category}</td>
                                            <td className="px-10 py-5 text-right font-mono font-bold text-cca-textSecondary group-hover:text-cca-textPrimary transition-colors">{exp.total.toFixed(0)} $</td>
                                            <td className="px-10 py-5 text-right font-mono font-black text-brand-primary text-sm tracking-tighter">{exp.deductible.toFixed(0)} $</td>
                                        </tr>
                                    ))}
                                </tbody>

                            </table>
                        </div>
                    </div>

                    {/* TAX SUMMARY */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

                        {/* TAX ON DONATIONS */}
                        <div className="
                            relative overflow-hidden rounded-3xl p-8
                            bg-cca-surface/20 border border-cca-border backdrop-blur-3xl shadow-2xl shadow-black/40
                            flex flex-col justify-between
                        ">
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-cca-border/50 pb-4">
                                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500"><Gift size={18} /></div>
                                    <h2 className="text-lg font-black uppercase tracking-widest text-cca-textPrimary">Taxe sur Libéralités</h2>
                                </div>

                                <div className="space-y-4 font-bold text-sm">
                                    <div className="flex justify-between items-center group">
                                        <span className="text-cca-textSecondary/40 uppercase text-[9px] tracking-[0.2em] group-hover:text-cca-textSecondary/60 transition-colors">Total Dons Reçus</span>
                                        <span className="text-cca-textPrimary font-mono group-hover:scale-105 transition-transform">{declaration.donationDetails.totalDonations.toFixed(0)} $</span>
                                    </div>
                                    <div className="flex justify-between items-center group">
                                        <span className="text-cca-textSecondary/40 uppercase text-[9px] tracking-[0.2em] group-hover:text-cca-textSecondary/60 transition-colors">Taux Appliqué</span>
                                        <span className="text-cca-textPrimary font-mono group-hover:scale-105 transition-transform">{declaration.donationDetails.taxRate}%</span>
                                    </div>

                                    <div className="pt-4 border-t border-cca-border/30 flex justify-between items-end">
                                        <span className="text-amber-500/80 uppercase text-[10px] font-black tracking-[0.3em]">Redevance Calculée</span>
                                        <span className="text-2xl font-black font-heading text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                                            {declaration.donationDetails.taxAmount.toFixed(0)} $
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* FINAL TAX SUMMARY */}
                        <div className="
                            relative overflow-hidden rounded-3xl p-8
                            bg-gradient-to-br from-brand-primary/20 to-indigo-900/20 border border-brand-primary/30 backdrop-blur-3xl shadow-2xl shadow-brand-primary/10
                            flex flex-col justify-between
                        ">
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-cca-border/30 pb-4">
                                    <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20"><Target size={18} /></div>
                                    <h2 className="text-lg font-black uppercase tracking-widest text-cca-textPrimary">Bilan Fiscal Final</h2>
                                </div>

                                <div className="space-y-4 font-bold text-sm">
                                    <div className="flex justify-between items-center group">
                                        <span className="text-cca-textSecondary/40 uppercase text-[9px] tracking-[0.2em]">Impôt sur Bénéfices</span>
                                        <span className="text-cca-textPrimary/80 font-mono tracking-tight">{declaration.taxCalculation.profitTax.toFixed(0)} $</span>
                                    </div>
                                    <div className="flex justify-between items-center group">
                                        <span className="text-cca-textSecondary/40 uppercase text-[9px] tracking-[0.2em]">Impôt sur Libéralités</span>
                                        <span className="text-cca-textPrimary/80 font-mono tracking-tight">{declaration.taxCalculation.donationTax.toFixed(0)} $</span>
                                    </div>

                                    <div className="pt-6 border-t border-cca-border/30 flex justify-between items-end">
                                        <div className="space-y-1">
                                            <span className="text-brand-primary/80 uppercase text-[8px] font-black tracking-[0.4em] block">Engagement Total</span>
                                            <span className="text-cca-textPrimary uppercase text-[12px] font-black tracking-[0.1em]">À acquitter sans délai</span>
                                        </div>
                                        <span className="text-4xl font-black font-heading text-cca-textPrimary drop-shadow-[0_0_20px_rgba(var(--text-primary-rgb),0.1)]">
                                            {declaration.taxCalculation.totalTax.toFixed(0)} $
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            )}

        </div>
    );
};

export default DeclarationPage;
