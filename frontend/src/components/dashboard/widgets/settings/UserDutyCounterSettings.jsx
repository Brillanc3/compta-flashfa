import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useCompany } from "@/contexts/CompanyContext.jsx";

const UserDutyCounterSettings = ({ config, onUpdateConfig, onCancel }) => {
    const { activeCompanyId } = useCompany();

    const companyId = useMemo(() => {
        if (activeCompanyId === null || activeCompanyId === undefined) return null;
        const n = Number(activeCompanyId);
        return Number.isFinite(n) && n > 0 ? n : null;
    }, [activeCompanyId]);

    const computeInitial = useMemo(() => {
        const showGlobal = config?.showGlobal === true;
        const globalTimeframe = (config?.globalTimeframe || "week").toLowerCase();
        const globalLabel = config?.globalLabel || "Total (semaine)";
        const showIncludingActive = config?.showIncludingActive !== false;

        return {
            showGlobal,
            globalTimeframe: ["week", "day", "month"].includes(globalTimeframe) ? globalTimeframe : "week",
            globalLabel,
            showIncludingActive,
        };
    }, [config]);

    const [localConfig, setLocalConfig] = useState(() => computeInitial);

    // Resync si company change ou config change (ex: widget déjà existant)
    useEffect(() => {
        setLocalConfig(computeInitial);
    }, [computeInitial, companyId]);

    const handleConfigChange = (key, value) => {
        setLocalConfig((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Si showGlobal = false, on conserve quand même les champs, mais ils ne seront pas utilisés.
        onUpdateConfig({
            showGlobal: localConfig.showGlobal,
            globalTimeframe: localConfig.globalTimeframe,
            globalLabel: localConfig.globalLabel,
            showIncludingActive: localConfig.showIncludingActive,
        });
    };

    const isDisabled = !companyId;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40 ml-1">
                    Ingénierie d'Affichage
                </label>

                {!companyId && (
                    <div className="text-[10px] font-black uppercase text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded-xl p-4 tracking-widest">
                        ERREUR : AUCUNE ENTITÉ SÉLECTIONNÉE
                    </div>
                )}
                <div className="bg-cca-base/40 border border-cca-border/20 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-cca-textPrimary font-bold">Afficher le total global</div>
                            <div className="text-[10px] text-cca-textSecondary/60 font-medium uppercase tracking-tighter">
                                Affiche un cumul sur une période (ex: semaine en cours).
                            </div>
                        </div>

                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={localConfig.showGlobal}
                                onChange={(e) => handleConfigChange("showGlobal", e.target.checked)}
                                disabled={isDisabled}
                                className="peer h-5 w-5 opacity-0 absolute cursor-pointer"
                            />
                            <div className="h-5 w-5 bg-cca-base/60 border border-cca-border/40 rounded-lg flex items-center justify-center transition-all peer-checked:bg-brand-primary peer-checked:border-brand-primary">
                                <svg className={`w-3 h-3 text-white transition-opacity ${localConfig.showGlobal ? 'opacity-100' : 'opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <label htmlFor="globalTimeframe" className="block text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 ml-1">
                            Période du total
                        </label>
                        <div className="relative">
                            <select
                                id="globalTimeframe"
                                value={localConfig.globalTimeframe}
                                onChange={(e) => handleConfigChange("globalTimeframe", e.target.value)}
                                className="mt-1 w-full rounded-xl bg-cca-base/40 border border-cca-border/20 text-cca-textPrimary px-4 py-3 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all appearance-none"
                                disabled={isDisabled || !localConfig.showGlobal}
                            >
                                <option value="week" className="bg-cca-surface">Semaine</option>
                                <option value="day" className="bg-cca-surface">Jour</option>
                                <option value="month" className="bg-cca-surface">Mois</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-cca-textSecondary/40">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="globalLabel" className="block text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 ml-1">
                            Libellé du total
                        </label>

                        <input
                            id="globalLabel"
                            value={localConfig.globalLabel}
                            onChange={(e) => handleConfigChange("globalLabel", e.target.value)}
                            placeholder="Total (semaine)"
                            className="mt-1 w-full rounded-xl bg-cca-base/40 border border-cca-border/20 text-cca-textPrimary px-4 py-3 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all"
                            disabled={isDisabled || !localConfig.showGlobal}
                        />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-cca-border/10">
                        <div>
                            <div className="text-sm text-cca-textPrimary font-bold">Inclure le service en cours</div>
                            <div className="text-[10px] text-cca-textSecondary/60 font-medium uppercase tracking-tighter">
                                Compter la session active dans le cumul global.
                            </div>
                        </div>

                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={localConfig.showIncludingActive}
                                onChange={(e) => handleConfigChange("showIncludingActive", e.target.checked)}
                                disabled={isDisabled || !localConfig.showGlobal}
                                className="peer h-5 w-5 opacity-0 absolute cursor-pointer"
                            />
                            <div className="h-5 w-5 bg-cca-base/60 border border-cca-border/40 rounded-lg flex items-center justify-center transition-all peer-checked:bg-brand-primary peer-checked:border-brand-primary">
                                <svg className={`w-3 h-3 text-white transition-opacity ${localConfig.showIncludingActive ? 'opacity-100' : 'opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-cca-border/10">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-2.5 rounded-xl bg-cca-base/40 border border-cca-border/20 text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface/40 transition-all font-black uppercase text-[10px] tracking-widest"
                >
                    Annuler
                </button>
                <button
                    type="submit"
                    disabled={isDisabled}
                    className="px-6 py-2.5 rounded-xl bg-brand-primary text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:grayscale transition-all"
                >
                    Sauvegarder
                </button>
            </div>
        </form>
    );
};

UserDutyCounterSettings.propTypes = {
    config: PropTypes.object,
    onUpdateConfig: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
};

export default UserDutyCounterSettings;
