// frontend/src/components/dashboard/widgets/settings/PawnshopEmployeeRankingSettings.jsx

import React, { useEffect, useState } from 'react';

const METRIC_OPTIONS = [
    { value: 'buyAmount', label: 'Valeurs d\'achats' },
    { value: 'resaleAmount', label: 'Valeurs de vente' },
    { value: 'count', label: 'Nombre de rachats' },
];

const PawnshopEmployeeRankingSettings = ({ config = {}, onUpdateConfig, onCancel }) => {
    const [metric, setMetric] = useState(config.metric || 'buyAmount');
    const [limit, setLimit] = useState(config.limit != null ? String(config.limit) : '');
    const [showSearch, setShowSearch] = useState(config.showSearch !== false);

    useEffect(() => {
        setMetric(config.metric || 'buyAmount');
        setLimit(config.limit != null ? String(config.limit) : '');
        setShowSearch(config.showSearch !== false);
    }, [config.metric, config.limit, config.showSearch]);

    const save = () => {
        const parsedLimit = limit === '' ? null : parseInt(limit, 10);
        onUpdateConfig({
            ...config,
            metric,
            limit: parsedLimit && parsedLimit > 0 ? parsedLimit : null,
            showSearch,
        });
        onCancel?.();
    };

    return (
        <div className="space-y-6">
            {/* Métrique */}
            <div className="bg-cca-base/40 border border-cca-border/20 rounded-2xl p-6 space-y-4">
                <div className="text-cca-textPrimary font-black text-xs uppercase tracking-widest opacity-80 border-b border-cca-border/10 pb-3">
                    MÉTRIQUE DU CLASSEMENT
                </div>
                <div className="space-y-2">
                    {METRIC_OPTIONS.map((opt) => (
                        <label key={opt.value} className="flex items-center gap-4 group cursor-pointer">
                            <div className="relative flex items-center">
                                <input
                                    type="radio"
                                    name="metric"
                                    value={opt.value}
                                    checked={metric === opt.value}
                                    onChange={() => setMetric(opt.value)}
                                    className="peer h-5 w-5 opacity-0 absolute"
                                />
                                <div className="h-5 w-5 bg-cca-base/60 border border-cca-border/40 rounded-full flex items-center justify-center transition-all peer-checked:border-brand-primary">
                                    <div className={`h-2.5 w-2.5 rounded-full bg-brand-primary transition-opacity ${metric === opt.value ? 'opacity-100' : 'opacity-0'}`} />
                                </div>
                            </div>
                            <span className="text-cca-textPrimary font-bold text-sm group-hover:text-brand-primary transition-colors">
                                {opt.label}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Nombre affiché */}
            <div className="bg-cca-base/40 border border-cca-border/20 rounded-2xl p-6 space-y-4">
                <div className="text-cca-textPrimary font-black text-xs uppercase tracking-widest opacity-80 border-b border-cca-border/10 pb-3">
                    NOMBRE D&apos;EMPLOYÉS AFFICHÉS
                </div>
                <div className="space-y-2">
                    <input
                        type="number"
                        min="1"
                        value={limit}
                        onChange={(e) => setLimit(e.target.value)}
                        placeholder="Illimité"
                        className="w-full bg-cca-base/60 border border-cca-border/40 rounded-xl px-4 py-2.5 text-sm text-cca-textPrimary placeholder-cca-textSecondary/40 focus:outline-none focus:border-brand-primary/60 transition-colors"
                    />
                    <div className="text-[10px] font-black uppercase text-cca-textSecondary/30 tracking-widest bg-cca-base/20 p-3 rounded-xl border border-cca-border/10 italic">
                        LAISSER VIDE POUR AFFICHER TOUS LES EMPLOYÉS
                    </div>
                </div>
            </div>

            {/* Barre de recherche */}
            <div className="bg-cca-base/40 border border-cca-border/20 rounded-2xl p-6 space-y-4">
                <div className="text-cca-textPrimary font-black text-xs uppercase tracking-widest opacity-80 border-b border-cca-border/10 pb-3">
                    OPTIONS D&apos;AFFICHAGE
                </div>
                <label className="flex items-center gap-4 group cursor-pointer">
                    <div className="relative flex items-center">
                        <input
                            type="checkbox"
                            checked={showSearch}
                            onChange={(e) => setShowSearch(e.target.checked)}
                            className="peer h-5 w-5 opacity-0 absolute"
                        />
                        <div className="h-5 w-5 bg-cca-base/60 border border-cca-border/40 rounded-lg flex items-center justify-center transition-all peer-checked:bg-brand-primary peer-checked:border-brand-primary">
                            <svg className={`w-3 h-3 text-white transition-opacity ${showSearch ? 'opacity-100' : 'opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4">
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                    <span className="text-cca-textPrimary font-bold text-sm group-hover:text-brand-primary transition-colors">
                        Afficher la barre de recherche
                    </span>
                </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-cca-border/10">
                <button
                    onClick={onCancel}
                    className="px-6 py-2.5 rounded-xl bg-cca-base/40 border border-cca-border/20 text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface/40 transition-all font-black uppercase text-[10px] tracking-widest"
                >
                    Annuler
                </button>
                <button
                    onClick={save}
                    className="px-6 py-2.5 rounded-xl bg-brand-primary text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    Sauvegarder
                </button>
            </div>
        </div>
    );
};

export default PawnshopEmployeeRankingSettings;
