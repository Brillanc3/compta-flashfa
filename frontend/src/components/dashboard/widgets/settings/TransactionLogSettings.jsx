// frontend/src/components/dashboard/widgets/settings/TransactionLogSettings.jsx

import React, { useState, useCallback } from 'react';
import Select from 'react-select';
import { List, BarChart } from 'lucide-react';
import toast from 'react-hot-toast';
import PropTypes from 'prop-types';

// Options pour la sélection du groupement
const GROUP_BY_OPTIONS = [
    { value: 'TYPE', label: 'Revenus / Dépenses' },
    { value: 'CATEGORY', label: 'Catégories' },
];

const CHART_TYPE_OPTIONS = [
    { value: 'BAR', label: 'Barres (Bar Chart)' },
    { value: 'LINE', label: 'Linéaire (Line Chart)' },
];

/**
 * Composant de configuration pour le widget Journal de Transaction (TRANSACTION_LOG).
 */
const TransactionLogSettings = ({ widgetDefinition, config, onUpdateConfig, onCancel }) => {
    const [tempConfig, setTempConfig] = useState(config || {
        variantType: 'TABLE_VIEW',
        transactionCount: 5,
        chartType: 'BAR',
        groupBy: 'TYPE',
    });

    // --- CORRECTIF 2: Logique de fallback pour les variantes ---
    // On utilise les variantes de la définition si elles existent, sinon on fournit un tableau par défaut.
    const variantsFromDef = widgetDefinition.availableVariants?.variants;
    const variants = Array.isArray(variantsFromDef) && variantsFromDef.length > 0
        ? variantsFromDef
        : [
            { type: 'TABLE_VIEW', name: 'Tableau' },
            { type: 'CHART_VIEW', name: 'Graphique' }
        ];

    const handleConfigChange = useCallback((key, value) => {
        setTempConfig(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleApply = () => {
        if (tempConfig.transactionCount < 1) {
            toast.error("Le nombre de transactions doit être au moins 1.");
            return;
        }
        onUpdateConfig(tempConfig);
        onCancel(); // On utilise la fonction onCancel passée en props pour fermer la modale
        toast.success("Configuration appliquée. N'oubliez pas de sauvegarder le dashboard.");
    };

    const isChartView = tempConfig.variantType === 'CHART_VIEW';

    return (
        <div className="space-y-4 p-1">
            {/* --- CORRECTIF 1: Le titre H3 a été supprimé pour éviter la duplication --- */}

            {/* 1. Sélection du type de variante (Tableau ou Graphique) */}
            <div className="bg-cca-base/40 border border-cca-border/20 rounded-2xl p-6 shadow-sm">
                <label className="block text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-4 ml-1">Modalité d'Affichage</label>
                <div className="flex gap-3">
                    {variants.map(variant => {
                        const Icon = variant.type === 'TABLE_VIEW' ? List : BarChart;
                        const isSelected = tempConfig.variantType === variant.type;

                        return (
                            <button
                                key={variant.type}
                                onClick={() => handleConfigChange('variantType', variant.type)}
                                className={`flex flex-1 items-center justify-center p-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    isSelected 
                                        ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                                        : 'bg-cca-base/40 border border-cca-border/20 text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface/20'
                                }`}
                            >
                                <Icon size={14} className="mr-2" />
                                {variant.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. Options Communes (Nombre de transactions affichées) */}
            <div className="bg-cca-base/40 border border-cca-border/20 rounded-2xl p-6 shadow-sm">
                <label htmlFor="transactionCount" className="block text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-3 ml-1">Profondeur d'Historique (Lignes/Points)</label>
                <input
                    id="transactionCount"
                    type="number"
                    min="1"
                    value={tempConfig.transactionCount}
                    onChange={(e) => handleConfigChange('transactionCount', parseInt(e.target.value, 10))}
                    className="w-full px-4 py-3 bg-cca-base/40 border border-cca-border/20 rounded-xl text-cca-textPrimary font-bold text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all shadow-inner"
                />
            </div>

            {/* 3. Options Spécifiques au Graphique */}
            {isChartView && (
                <div className="bg-cca-base/40 border border-cca-border/20 rounded-2xl p-6 shadow-sm space-y-6">
                    <h4 className="text-xs font-black text-cca-textPrimary uppercase tracking-widest border-b border-cca-border/10 pb-3">Morphologie Graphique</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-2 ml-1">Type de Diagramme</label>
                            <Select
                                options={CHART_TYPE_OPTIONS}
                                value={CHART_TYPE_OPTIONS.find(opt => opt.value === tempConfig.chartType)}
                                onChange={(option) => handleConfigChange('chartType', option.value)}
                                classNamePrefix="react-select"
                                styles={{
                                    control: (base) => ({
                                        ...base,
                                        backgroundColor: 'rgba(var(--bg-base-rgb), 0.4)',
                                        borderColor: 'rgba(var(--cca-border-rgb), 0.2)',
                                        borderRadius: '0.75rem',
                                        padding: '0.2rem',
                                        boxShadow: 'none',
                                        '&:hover': { borderColor: 'rgba(var(--cca-border-rgb), 0.4)' }
                                    }),
                                    menu: (base) => ({
                                        ...base,
                                        backgroundColor: 'var(--cca-surface)',
                                        borderRadius: '0.75rem',
                                        overflow: 'hidden'
                                    }),
                                    option: (base, state) => ({
                                        ...base,
                                        backgroundColor: state.isFocused ? 'rgba(var(--brand-primary-rgb), 0.1)' : 'transparent',
                                        color: state.isFocused ? 'var(--brand-primary)' : 'var(--cca-text-primary)',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem'
                                    }),
                                    singleValue: (base) => ({
                                        ...base,
                                        color: 'var(--cca-text-primary)',
                                        fontWeight: '700'
                                    })
                                }}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mb-2 ml-1">Classification des Flux</label>
                            <Select
                                options={GROUP_BY_OPTIONS}
                                value={GROUP_BY_OPTIONS.find(opt => opt.value === tempConfig.groupBy)}
                                onChange={(option) => handleConfigChange('groupBy', option.value)}
                                classNamePrefix="react-select"
                                styles={{
                                    control: (base) => ({
                                        ...base,
                                        backgroundColor: 'rgba(var(--bg-base-rgb), 0.4)',
                                        borderColor: 'rgba(var(--cca-border-rgb), 0.2)',
                                        borderRadius: '0.75rem',
                                        padding: '0.2rem',
                                        boxShadow: 'none',
                                        '&:hover': { borderColor: 'rgba(var(--cca-border-rgb), 0.4)' }
                                    }),
                                    menu: (base) => ({
                                        ...base,
                                        backgroundColor: 'var(--cca-surface)',
                                        borderRadius: '0.75rem',
                                        overflow: 'hidden'
                                    }),
                                    option: (base, state) => ({
                                        ...base,
                                        backgroundColor: state.isFocused ? 'rgba(var(--brand-primary-rgb), 0.1)' : 'transparent',
                                        color: state.isFocused ? 'var(--brand-primary)' : 'var(--cca-text-primary)',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem'
                                    }),
                                    singleValue: (base) => ({
                                        ...base,
                                        color: 'var(--cca-text-primary)',
                                        fontWeight: '700'
                                    })
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Boutons d'action */}
            <div className="flex justify-end gap-3 pt-6 border-t border-cca-border/10">
                <button
                    onClick={onCancel}
                    className="px-6 py-2.5 rounded-xl bg-cca-base/40 border border-cca-border/20 text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface/40 transition-all font-black uppercase text-[10px] tracking-widest"
                >
                    Annuler
                </button>
                <button
                    onClick={handleApply}
                    className="px-6 py-2.5 rounded-xl bg-brand-primary text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    Appliquer
                </button>
            </div>
        </div>
    );
};

TransactionLogSettings.propTypes = {
    widgetDefinition: PropTypes.object.isRequired,
    config: PropTypes.object,
    onUpdateConfig: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
};

export default TransactionLogSettings;