import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { RefreshCw, Eye, EyeOff } from 'lucide-react';

import { usePermissions } from '@/contexts/PermissionsContext.jsx';
import BalanceDisplayNumber from './BalanceDisplayNumber';

const PERMISSION_VIEW_BALANCE = 'COMPTABILITE.COMPANY.BALANCE.VIEW';

const CompanyBalanceWidget = ({ config }) => {
    const { isReady: permsReady, isLoading: permsLoading, has } = usePermissions();

    const [masked, setMasked] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const canView = useMemo(() => {
        if (!permsReady) return false;
        return has(PERMISSION_VIEW_BALANCE);
    }, [permsReady, has]);

    return (
        <div className="h-full min-h-0 flex flex-col text-cca-textPrimary">
            {/* Card unique */}
            <div
                className="
                    relative overflow-hidden rounded-xl p-3 sm:p-4
                    bg-cca-surface/20
                    border border-cca-border/40 backdrop-blur-xl shadow-2xl
                    flex-1 min-h-0 flex flex-col
                "
            >
                {/* Halo subtil */}
                <div
                    className="
                        pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light
                        [background:
                            radial-gradient(circle_at_top_left,rgba(99,102,241,0.15),transparent_55%),
                            radial-gradient(circle_at_bottom_right,rgba(8,47,73,0.35),transparent_55%)
                        ]
                    "
                />

                {/* Barre actions */}
                <div className="relative flex-shrink-0 flex items-center justify-between gap-2 mb-2">
                    <div className="text-[11px] text-cca-textSecondary font-medium">
                        {permsLoading ? 'Chargement…' : 'SOLDE COURANT'}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button
                            type="button"
                            onClick={() => setMasked(v => !v)}
                            className="
                                px-2.5 py-1.5 rounded-lg text-[11px]
                                flex items-center gap-2
                                bg-cca-base/70 hover:bg-cca-surface/70
                                border border-cca-border/40 backdrop-blur-xl
                                transition active:scale-95
                                whitespace-nowrap text-cca-textPrimary
                            "
                        >
                            {masked ? <Eye size={14} /> : <EyeOff size={14} />}
                            {masked ? 'Afficher' : 'Masquer'}
                        </button>

                        <button
                            type="button"
                            onClick={() => setRefreshKey(k => k + 1)}
                            className="
                                px-2.5 py-1.5 rounded-lg text-[11px]
                                flex items-center gap-2
                                bg-cca-base/70 hover:bg-cca-surface/70
                                border border-cca-border/40 backdrop-blur-xl
                                transition active:scale-95
                                whitespace-nowrap text-cca-textPrimary
                            "
                            title="Rafraîchir"
                        >
                            <RefreshCw size={14} />
                            Rafraîchir
                        </button>
                    </div>
                </div>

                {/* Contenu */}
                <div className="relative flex-1 min-h-0 flex items-center justify-center">
                    {!permsReady ? (
                        <p className="text-cca-textSecondary/60 text-sm">Initialisation…</p>
                    ) : !canView ? (
                        <div
                            className="
                                max-w-full text-center p-3 rounded-xl
                                bg-cca-base/60 border border-cca-border/60 backdrop-blur-xl
                            "
                        >
                            <p className="text-cca-textPrimary text-sm font-medium">
                                Accès insuffisant
                            </p>
                            <p className="text-cca-textSecondary/70 text-[11px] mt-1 break-words">
                                Permission requise :{' '}
                                <span className="font-mono">{PERMISSION_VIEW_BALANCE}</span>
                            </p>
                        </div>
                    ) : (
                        <BalanceDisplayNumber
                            masked={masked}
                            refreshKey={refreshKey}
                            currency={config?.currency || 'USD'}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

CompanyBalanceWidget.propTypes = {
    config: PropTypes.shape({
        currency: PropTypes.string,
    }),
};

CompanyBalanceWidget.defaultProps = {
    config: { currency: 'USD' },
};

export default CompanyBalanceWidget;
