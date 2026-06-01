import React, { useState, useMemo } from 'react';
import { Search, X, Wrench } from 'lucide-react';
import { REPAIR_KIT_DATA } from './repairKitData';

const KIT_CONFIG = {
    'bas de gamme': {
        label: 'Bas de gamme',
        color: 'text-slate-400',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/20',
        dot: 'bg-slate-400',
    },
    'Moyenne gamme': {
        label: 'Moyenne gamme',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        dot: 'bg-amber-400',
    },
    'Haute gamme': {
        label: 'Haute gamme',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        dot: 'bg-emerald-400',
    },
    'Performance': {
        label: 'Performance',
        color: 'text-sky-400',
        bg: 'bg-sky-500/10',
        border: 'border-sky-500/20',
        dot: 'bg-sky-400',
    },
    'Utilitaire': {
        label: 'Utilitaire',
        color: 'text-violet-400',
        bg: 'bg-violet-500/10',
        border: 'border-violet-500/20',
        dot: 'bg-violet-400',
    },
};

const normalize = (str) =>
    str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');

const RepairKitWidget = () => {
    const [query, setQuery] = useState('');

    const results = useMemo(() => {
        const q = normalize(query.trim());
        if (!q) return [];
        return REPAIR_KIT_DATA.filter(
            (v) =>
                normalize(v.nom).includes(q) ||
                normalize(v.modele).includes(q) ||
                normalize(v.categorie).includes(q)
        ).slice(0, 20);
    }, [query]);

    const showEmpty = query.trim().length > 0 && results.length === 0;

    return (
        <div className="flex flex-col h-full gap-3">
            <div className="flex items-center justify-between flex-shrink-0 border-b border-cca-border/20 pb-3">
                <div className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-cca-textSecondary/50" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40">
                        Kits de réparation
                    </h3>
                </div>
                <span className="text-[9px] font-black uppercase tracking-tighter text-cca-textSecondary/30">
                    {REPAIR_KIT_DATA.length} véhicules
                </span>
            </div>

            {/* Barre de recherche */}
            <div className="relative flex-shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cca-textSecondary/40 pointer-events-none" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher un véhicule…"
                    className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-cca-base/40 border border-cca-border/30 text-xs text-cca-textPrimary placeholder:text-cca-textSecondary/30 focus:outline-none focus:border-brand-primary/50 focus:bg-cca-base/60 transition-all"
                />
                {query && (
                    <button
                        onClick={() => setQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cca-textSecondary/40 hover:text-cca-textSecondary transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Résultats */}
            <div className="flex-1 overflow-y-auto glass-scroll min-h-0">
                {!query.trim() && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-8">
                        <div className="w-10 h-10 rounded-2xl bg-cca-base/20 flex items-center justify-center opacity-30">
                            <Search className="w-5 h-5" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest italic text-cca-textSecondary/30">
                            Tapez un nom de véhicule
                        </p>
                    </div>
                )}

                {showEmpty && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-8">
                        <p className="text-[10px] font-black uppercase tracking-widest italic text-cca-textSecondary/30">
                            Aucun véhicule trouvé
                        </p>
                    </div>
                )}

                {results.length > 0 && (
                    <div className="space-y-1.5 pb-2 pr-1">
                        {results.map((v, i) => {
                            const kitCfg = KIT_CONFIG[v.kit] ?? {
                                label: v.kit,
                                color: 'text-cca-textSecondary',
                                bg: 'bg-cca-base/20',
                                border: 'border-cca-border/20',
                                dot: 'bg-cca-textSecondary',
                            };
                            return (
                                <div
                                    key={`${v.modele}-${i}`}
                                    className="flex items-center justify-between gap-3 rounded-xl bg-cca-base/40 border border-cca-border/20 px-3 py-2.5 hover:bg-cca-surface/20 hover:scale-[1.01] transition-all shadow-sm hover:shadow-xl"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-cca-textPrimary truncate">
                                            {v.nom}
                                        </p>
                                        <p className="text-[10px] text-cca-textSecondary/50 truncate">
                                            {v.categorie}
                                            {v.prix && (
                                                <span className="ml-1.5 text-cca-textSecondary/40">
                                                    · {v.prix}
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    <div
                                        className={`flex items-center gap-1.5 flex-shrink-0 px-2 py-1 rounded-full border ${kitCfg.bg} ${kitCfg.border}`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${kitCfg.dot}`} />
                                        <span className={`text-[9px] font-black uppercase tracking-tighter ${kitCfg.color}`}>
                                            {kitCfg.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                        {results.length === 20 && (
                            <p className="text-center text-[9px] text-cca-textSecondary/30 uppercase tracking-widest pt-1">
                                Affichage limité à 20 résultats
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RepairKitWidget;
