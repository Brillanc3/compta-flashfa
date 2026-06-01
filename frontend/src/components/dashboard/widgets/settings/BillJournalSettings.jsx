// frontend/src/components/dashboard/widgets/settings/BillJournalSettings.jsx

import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useCompany } from "@/contexts/CompanyContext.jsx";
import { usePermissions } from "@/contexts/PermissionsContext.jsx";

const BillJournalSettings = ({ config, onUpdateConfig, onCancel }) => {
    const { activeCompanyId } = useCompany();
    const permissions = usePermissions();

    const companyId = useMemo(() => {
        if (activeCompanyId === null || activeCompanyId === undefined) return null;
        const n = Number(activeCompanyId);
        return Number.isFinite(n) && n > 0 ? n : null;
    }, [activeCompanyId]);

    // L’UI doit rester conservative tant que les permissions ne sont pas prêtes.
    // (Le route-guard gère généralement le "loading", mais la modale peut s’ouvrir très tôt.)
    const canViewAll = useMemo(() => {
        if (!companyId) return false;
        if (!permissions.isReady) return false;

        // Conventions backend : COMPANY.{id}.BILLS.VIEW + wildcard COMPANY.{id}.*
        return (
            permissions.has(`COMPANY.${companyId}.BILLS.VIEW`) ||
            permissions.has(`COMPANY.${companyId}.*`)
        );
    }, [companyId, permissions]);

    const computeInitialViewMode = useMemo(() => {
        const requested = (config?.viewMode || "ALL").toUpperCase();
        const safeRequested = requested === "SELF" ? "SELF" : "ALL";
        return canViewAll ? safeRequested : "SELF";
    }, [config, canViewAll]);

    const [localConfig, setLocalConfig] = useState(() => ({
        viewMode: computeInitialViewMode,
    }));

    // Si la company change ou si les permissions deviennent "ready", on resynchronise proprement.
    useEffect(() => {
        setLocalConfig((prev) => {
            const nextViewMode = computeInitialViewMode;

            // Si l’utilisateur a déjà sélectionné un mode et qu’il reste valide, on le conserve.
            // Sinon, on force SELF.
            if (canViewAll) {
                const prevMode = (prev?.viewMode || "ALL").toUpperCase();
                const normalizedPrev = prevMode === "SELF" ? "SELF" : "ALL";
                return { ...prev, viewMode: normalizedPrev };
            }

            return { ...prev, viewMode: nextViewMode };
        });
    }, [computeInitialViewMode, canViewAll]);

    const handleConfigChange = (key, value) => {
        setLocalConfig((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Sécurité UI : si pas le droit => SELF
        const finalViewMode = canViewAll ? localConfig.viewMode : "SELF";
        onUpdateConfig({ ...localConfig, viewMode: finalViewMode });
    };

    const isDisabled = !companyId || (companyId && !permissions.isReady);

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <label htmlFor="viewMode" className="block text-sm font-semibold text-slate-200">
                    Données à afficher
                </label>

                {!companyId && (
                    <div className="text-sm text-slate-300 bg-slate-800/60 border border-white/10 rounded-lg p-3">
                        Aucune entreprise active n’est sélectionnée. Veuillez sélectionner une entreprise avant de configurer ce widget.
                    </div>
                )}

                {companyId && !permissions.isReady && (
                    <div className="text-sm text-slate-300 bg-slate-800/60 border border-white/10 rounded-lg p-3">
                        Chargement des permissions…
                    </div>
                )}

                {companyId && permissions.isReady && canViewAll ? (
                    <select
                        id="viewMode"
                        value={localConfig.viewMode}
                        onChange={(e) => handleConfigChange("viewMode", e.target.value)}
                        className="mt-1 w-full rounded-xl bg-cca-base/40 border border-cca-border/20 text-cca-textPrimary px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all appearance-none"
                        disabled={isDisabled}
                    >
                        <option value="ALL" className="bg-cca-surface">Toutes les factures de l’entreprise</option>
                        <option value="SELF" className="bg-cca-surface">Uniquement mes factures</option>
                    </select>
                ) : (
                    companyId &&
                    permissions.isReady && (
                        <div className="text-sm text-slate-300 bg-slate-800/60 border border-white/10 rounded-lg p-3">
                            Mode verrouillé : <span className="font-semibold">uniquement vos factures</span> (permission entreprise insuffisante).
                        </div>
                    )
                )}
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

BillJournalSettings.propTypes = {
    // Conformément à WidgetGrid : <SettingsComponent config=... onUpdateConfig=... onCancel=... />
    config: PropTypes.object,
    onUpdateConfig: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
};

export default BillJournalSettings;
