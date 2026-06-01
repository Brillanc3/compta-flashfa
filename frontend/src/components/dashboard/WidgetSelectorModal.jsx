// frontend/src/components/dashboard/WidgetSelectorModal.jsx

import React from 'react';
import PropTypes from 'prop-types';

const WidgetSelectorModal = ({ isOpen, onClose, availableWidgets, onAddWidget, currentWidgetTypes }) => {
    if (!isOpen) {
        return null;
    }

    // On crée un Set des types de widgets déjà présents sur le dashboard pour une vérification rapide
    const currentTypesSet = new Set(currentWidgetTypes);

    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div
                className="
                    bg-cca-surface/90 border border-cca-border/50 backdrop-blur-2xl rounded-3xl shadow-2xl 
                    w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300
                "
                onClick={(e) => e.stopPropagation()}
            >
                <div className="
                    pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay
                    bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]
                " />

                <div className="flex justify-between items-center p-8 border-b border-cca-border/30 relative">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary/80 leading-none">Personnalisation Dashboard</p>
                        <h2 className="text-2xl font-black text-cca-textPrimary tracking-tight font-heading">Ajouter un Widget</h2>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-10 h-10 rounded-xl bg-cca-base/40 border border-cca-border text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface transition-all flex items-center justify-center font-bold"
                    >
                        &times;
                    </button>
                </div>

                <div className="p-8 overflow-y-auto relative glass-scroll">
                    {availableWidgets.length === 0 ? (
                        <p className="text-cca-textSecondary/40 text-center italic py-12">Aucun autre widget disponible pour vous.</p>
                    ) : (
                        <ul className="space-y-4">
                            {availableWidgets.map(widgetDef => {
                                const isAlreadyAdded = currentTypesSet.has(widgetDef.type);
                                return (
                                    <li key={widgetDef.id} className="relative group overflow-hidden bg-cca-base/40 hover:bg-cca-base/60 border border-cca-border/50 p-6 rounded-2xl flex justify-between items-center transition-all">
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-cca-textPrimary tracking-tight">{widgetDef.name}</h3>
                                            <p className="text-xs text-cca-textSecondary/60 leading-relaxed max-w-sm">{widgetDef.description}</p>
                                        </div>
                                        <button
                                            onClick={() =>
                                                onAddWidget({
                                                    widgetDefinitionId: widgetDef.id,
                                                    widgetDefinitionType: widgetDef.type,
                                                    widgetDefinition: widgetDef
                                                })
                                            }
                                            disabled={isAlreadyAdded}
                                            className="
                                                h-12 px-6 rounded-xl bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest
                                                shadow-xl shadow-brand-primary/10 hover:shadow-brand-primary/20 hover:brightness-110 
                                                transition-all disabled:bg-cca-surface disabled:text-cca-textSecondary/40 disabled:cursor-not-allowed disabled:shadow-none
                                            "
                                        >
                                            {isAlreadyAdded ? 'Déjà Actif' : 'Installer'}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

WidgetSelectorModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    availableWidgets: PropTypes.array.isRequired,
    onAddWidget: PropTypes.func.isRequired,
    currentWidgetTypes: PropTypes.array.isRequired,
};

export default WidgetSelectorModal;