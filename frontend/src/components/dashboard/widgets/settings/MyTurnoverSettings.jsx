import React, { useEffect, useState } from "react";

const MyTurnoverSettings = ({ config = {}, onUpdateConfig, onCancel }) => {
    const [enableCalendar, setEnableCalendar] = useState(!!config.enableCalendar);
    const [includePartnerServices, setIncludePartnerServices] = useState(!!config.includePartnerServices);

    useEffect(() => {
        setEnableCalendar(!!config.enableCalendar);
        setIncludePartnerServices(!!config.includePartnerServices);
    }, [config.enableCalendar, config.includePartnerServices]);

    const save = () => {
        onUpdateConfig({ ...config, enableCalendar, includePartnerServices });
        onCancel?.();
    };

    return (
        <div className="space-y-6">
            <div className="bg-cca-base/40 border border-cca-border/20 rounded-2xl p-6 space-y-4">
                <div className="text-cca-textPrimary font-black text-xs uppercase tracking-widest opacity-80 border-b border-cca-border/10 pb-3">PARAMÈTRES D&apos;AFFICHAGE</div>

                {/* Calendrier */}
                <label className="flex items-center gap-4 group cursor-pointer">
                    <div className="relative flex items-center">
                        <input
                            type="checkbox"
                            checked={enableCalendar}
                            onChange={(e) => setEnableCalendar(e.target.checked)}
                            className="peer h-5 w-5 opacity-0 absolute"
                        />
                        <div className="h-5 w-5 bg-cca-base/60 border border-cca-border/40 rounded-lg flex items-center justify-center transition-all peer-checked:bg-brand-primary peer-checked:border-brand-primary">
                            <svg className={`w-3 h-3 text-white transition-opacity ${enableCalendar ? "opacity-100" : "opacity-0"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                    </div>
                    <span className="text-cca-textPrimary font-bold text-sm group-hover:text-brand-primary transition-colors">
                        Activer le module Calendrier
                    </span>
                </label>

                <div className="text-[10px] font-black uppercase text-cca-textSecondary/30 tracking-widest bg-cca-base/20 p-3 rounded-xl border border-cca-border/10 italic">
                    AUDIT JOURNALIER DÉSACTIVÉ PAR DÉFAUT (SEMAINE UNIQUEMENT)
                </div>
            </div>

            {/* Prestations partenaire */}
            <div className="bg-cca-base/40 border border-cca-border/20 rounded-2xl p-6 space-y-4">
                <div className="text-cca-textPrimary font-black text-xs uppercase tracking-widest opacity-80 border-b border-cca-border/10 pb-3">SOURCES DU CHIFFRE D&apos;AFFAIRE</div>

                <label className="flex items-center gap-4 group cursor-pointer">
                    <div className="relative flex items-center">
                        <input
                            type="checkbox"
                            checked={includePartnerServices}
                            onChange={(e) => setIncludePartnerServices(e.target.checked)}
                            className="peer h-5 w-5 opacity-0 absolute"
                        />
                        <div className="h-5 w-5 bg-cca-base/60 border border-cca-border/40 rounded-lg flex items-center justify-center transition-all peer-checked:bg-violet-500 peer-checked:border-violet-500">
                            <svg className={`w-3 h-3 text-white transition-opacity ${includePartnerServices ? "opacity-100" : "opacity-0"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                    </div>
                    <span className="text-cca-textPrimary font-bold text-sm group-hover:text-violet-400 transition-colors">
                        Inclure les prestations de service partenaire
                    </span>
                </label>

                <div className="text-[10px] font-black uppercase text-cca-textSecondary/30 tracking-widest bg-cca-base/20 p-3 rounded-xl border border-cca-border/10 italic">
                    AJOUTE LES PRESTATIONS PARTENAIRE DE LA SEMAINE AU MONTANT GLOBAL
                </div>
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

export default MyTurnoverSettings;
