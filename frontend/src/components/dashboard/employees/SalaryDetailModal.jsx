import React, { useState } from 'react';
import Modal from '@/components/Modal';
import { Eye, EyeOff, Calendar, Info, ChevronDown, ChevronUp, Pencil, X, Check } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { setEmployeeSalaryOverride } from '@/services/employeesService';
import toast from 'react-hot-toast';

/**
 * Petite fonction utilitaire pour remplacer les placeholders dans une chaîne de caractères.
 * Elle prend un modèle comme "{totalBilled} $ * {commissionRate} %" et un objet de valeurs.
 * @param {string} template - La chaîne de caractères avec des placeholders.
 * @param {object} variables - Un objet où les clés correspondent aux noms des placeholders.
 * @returns {string} - La chaîne de caractères finale avec les valeurs insérées.
 */
const renderTemplate = (template, variables) => {
    if (typeof template !== 'string') {
        return 'Modèle de calcul non défini.';
    }
    let rendered = template;
    for (const key in variables) {
        const value = variables[key];
        const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
        rendered = rendered.replace(new RegExp(`{${key}}`, 'g'), formattedValue);
    }
    return rendered;
};

const SalaryDetailModal = ({ isOpen, onClose, employee, companyId, weekParams, onUpdate }) => {
    const [expandedItems, setExpandedItems] = useState(new Set());
    const [overrideMode, setOverrideMode] = useState(false);
    const [overrideInput, setOverrideInput] = useState('');
    const [overrideSaving, setOverrideSaving] = useState(false);

    // Sécurité : si la modale est ouverte sans employé ou sans données de salaire, on n'affiche rien.
    if (!isOpen || !employee || !employee.salary) {
        return null;
    }

    const { salary, rank } = employee;
    const { breakdown, calculatedSalary, finalSalary, salaryCap, isCapped } = salary;

    const handleOpenOverride = () => {
        setOverrideInput(salary.isOverridden ? String(salary.salaryOverride) : '');
        setOverrideMode(true);
    };

    const handleSaveOverride = async () => {
        const amount = overrideInput === '' ? null : Number(overrideInput);
        if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
            toast.error("Montant invalide.");
            return;
        }
        setOverrideSaving(true);
        try {
            await setEmployeeSalaryOverride(companyId, employee.id, { year: weekParams.year, week: weekParams.week, amount });
            toast.success(amount === null ? "Override supprimé." : `Salaire fixé à ${amount} $.`);
            setOverrideMode(false);
            onUpdate?.();
        } catch (err) {
            toast.error(err?.message || "Erreur lors de la sauvegarde.");
        } finally {
            setOverrideSaving(false);
        }
    };

    const handleClearOverride = async () => {
        setOverrideSaving(true);
        try {
            await setEmployeeSalaryOverride(companyId, employee.id, { year: weekParams.year, week: weekParams.week, amount: null });
            toast.success("Override supprimé.");
            setOverrideMode(false);
            onUpdate?.();
        } catch (err) {
            toast.error(err?.message || "Erreur lors de la suppression.");
        } finally {
            setOverrideSaving(false);
        }
    };

    const toggleExpand = (index) => {
        const next = new Set(expandedItems);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        setExpandedItems(next);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Détail du Salaire pour ${employee.user.name}`}>
            <div className="space-y-6 text-slate-300 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                {/* Cette section est entièrement dynamique.
                  Elle boucle sur le tableau 'breakdown' envoyé par le backend.
                  Chaque élément du tableau est un composant du salaire (ex: commissions, bonus...).
                */}
                {breakdown.map((item, index) => {
                    const isExpanded = expandedItems.has(index);
                    const details = item.details || null;
                    const hasDetails = Array.isArray(details) && details.length > 0;

                    const variables = {
                        ...item.templateVariables,        // Variables spécifiques au calcul (ex: { totalBilled })
                        ...rank.remunerationConfig,       // Variables du rang (ex: { commissionRate })
                        calculatedValue: item.value,      // Le résultat du calcul pour ce composant
                    };

                    const formulaText = item.template ? renderTemplate(item.template, variables) : null;

                    return (
                        <div key={index} className="p-4 bg-slate-800 rounded-lg border border-slate-700 transition-all duration-200 shadow-lg shadow-black/10">
                            <div className="flex justify-between items-start mb-2">
                                <div className="space-y-1">
                                    <h3 className="font-semibold text-lg text-white">{item.label}</h3>
                                    {hasDetails && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-bold uppercase tracking-wide">
                                                {details.length} Éléments
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {hasDetails && (
                                    <button
                                        onClick={() => toggleExpand(index)}
                                        className={`p-1.5 rounded-md transition-colors ${isExpanded ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'hover:bg-slate-700 text-slate-400 border border-transparent'}`}
                                        title={isExpanded ? "Masquer les détails" : "Voir les détails"}
                                    >
                                        {isExpanded ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                )}
                            </div>

                            <div className="font-mono text-sm space-y-1">
                                {formulaText ? (
                                    <p className="text-cyan-400">{formulaText}</p>
                                ) : (
                                    <p className="text-cyan-400">{item.value.toFixed(2)} $</p>
                                )}
                            </div>

                            {/* Section des détails (logs) avec Scroll Interne */}
                            {isExpanded && hasDetails && (
                                <div className="mt-4 pt-4 border-t border-slate-700/50 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="relative group/scroll">
                                        <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                            <table className="min-w-full text-left">
                                                <thead className="sticky top-0 bg-slate-800 z-10 shadow-md shadow-black/5">
                                                    <tr className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                                                        <th className="pb-2 pl-0">Date</th>
                                                        <th className="pb-2">Description</th>
                                                        <th className="pb-2 text-right">Montant</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-700/30">
                                                    {details.map((detail, dIdx) => (
                                                        <tr key={dIdx} className="text-xs group/row hover:bg-slate-700/50 transition-colors">
                                                            <td className="py-2.5 pl-0 text-slate-400 whitespace-nowrap">
                                                                {detail.date ? (
                                                                    <span className="flex items-center gap-1.5">
                                                                        <Calendar size={11} className="text-slate-600 group-hover/row:text-slate-400 transition-colors" />
                                                                        {format(new Date(detail.date), 'dd/MM HH:mm', { locale: fr })}
                                                                    </span>
                                                                ) : '-'}
                                                            </td>
                                                            <td className="py-2.5 text-slate-200 pr-2 font-medium">
                                                                {detail.label || detail.description || 'Action sans description'}
                                                            </td>
                                                            <td className="py-2.5 text-right font-mono text-cyan-400/90 group-hover/row:text-cyan-300 transition-colors">
                                                                {detail.value !== undefined ? `${detail.value.toFixed(2)} $` : '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {details.length > 10 && (
                                        <div className="mt-3 flex justify-center italic text-[10px] text-slate-500">
                                            Défilez pour voir les {details.length} lignes de calcul
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Cette section affiche le résumé final.
                  Elle est aussi dynamique car elle lit directement les totaux calculés par le backend.
                */}
                <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 shadow-xl shadow-black/20">
                    <h3 className="font-semibold text-lg text-white mb-3">Résumé du Salaire</h3>
                    <div className="font-mono text-sm space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Salaire total généré (brut):</span>
                            <span className="text-white">{calculatedSalary.toFixed(0)} $</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Plafond du rang ({rank.name}):</span>
                            <span className="text-white">{salaryCap > 0 ? `${salaryCap.toFixed(0)} $` : 'Aucun'}</span>
                        </div>
                        <hr className="border-slate-600 my-2" />
                        <div className="flex justify-between items-center text-lg">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-green-400">Salaire Final:</span>
                                {salary.isOverridden && (
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                        Fixé manuellement
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-green-400">
                                    {finalSalary.toFixed(0)} $
                                    {isCapped && <span className="ml-2 text-xs text-amber-400">(Plafonné)</span>}
                                </span>
                                {companyId && weekParams && (
                                    <>
                                        {salary.isOverridden && (
                                            <button
                                                onClick={handleClearOverride}
                                                disabled={overrideSaving}
                                                title="Supprimer l'override"
                                                className="p-1.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-40"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={handleOpenOverride}
                                            disabled={overrideSaving}
                                            title="Fixer le salaire manuellement"
                                            className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all disabled:opacity-40"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        {overrideMode && (
                            <div className="flex items-center gap-2 pt-2 animate-in slide-in-from-top-1 duration-200">
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 whitespace-nowrap">Fixer à</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={overrideInput}
                                    onChange={(e) => setOverrideInput(e.target.value)}
                                    placeholder={`${calculatedSalary.toFixed(0)}`}
                                    className="flex-1 bg-slate-900 text-white p-2 rounded-xl text-sm border border-amber-500/30 focus:outline-none focus:border-amber-400 font-mono"
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveOverride(); if (e.key === 'Escape') setOverrideMode(false); }}
                                />
                                <span className="text-slate-400 font-mono text-sm">$</span>
                                <button onClick={handleSaveOverride} disabled={overrideSaving} className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all disabled:opacity-40">
                                    <Check size={14} />
                                </button>
                                <button onClick={() => setOverrideMode(false)} disabled={overrideSaving} className="p-1.5 rounded-xl bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600 transition-all disabled:opacity-40">
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default SalaryDetailModal;