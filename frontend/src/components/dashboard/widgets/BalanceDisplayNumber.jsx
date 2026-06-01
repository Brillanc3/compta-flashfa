import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';

import { useCompany } from '@/contexts/CompanyContext.jsx';
import { usePermissions } from '@/contexts/PermissionsContext.jsx';
import { useWebSocket } from '@/contexts/WebSocketContext.jsx';

// À AJOUTER dans comptabiliteService.js (voir plus bas)
import { getCompanySolde } from '@/services/comptabiliteService';

const PERMISSION_VIEW_BALANCE = 'COMPTABILITE.COMPANY.BALANCE.VIEW';
const EVENT_COMPANY_BALANCE_UPDATE = 'COMPANY_BALANCE_UPDATE';

function toNumber(value) {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
}

const BalanceDisplayNumber = ({ masked, refreshKey, currency }) => {
    const { activeCompanyId } = useCompany();
    const { isReady: permsReady, has } = usePermissions();
    const { subscribe, unsubscribe } = useWebSocket();

    const canView = useMemo(() => {
        if (!permsReady) return false;
        return has(PERMISSION_VIEW_BALANCE);
    }, [permsReady, has]);

    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState(0);

    const fetchSolde = useCallback(async () => {
        if (!activeCompanyId) return;

        setLoading(true);
        try {
            // companyId est fourni via x-company-id par apiClient/proxy, mais on garde
            // activeCompanyId en param pour rester aligné avec les autres calls.
            const data = await getCompanySolde(activeCompanyId);
            const next = toNumber(data?.balance);
            setBalance(next ?? 0);
        } catch (err) {
            toast.error(err?.message || 'Erreur lors du chargement du solde.');
        } finally {
            setLoading(false);
        }
    }, [activeCompanyId]);

    // Initial + refresh
    useEffect(() => {
        if (!canView) return;
        fetchSolde();
    }, [canView, fetchSolde, refreshKey]);

    // WS updates
    const handleBalanceUpdate = useCallback(
        (payload) => {
            const cid = toNumber(payload?.companyId);
            const activeId = toNumber(activeCompanyId);

            if (cid !== null && activeId !== null && cid !== activeId) return;

            // Backend: balanceAfterFromGame (confirmé)
            const next = toNumber(payload?.balanceAfterFromGame);
            if (next === null) return;

            setBalance(next);
        },
        [activeCompanyId]
    );

    useEffect(() => {
        if (!canView) return;

        subscribe(EVENT_COMPANY_BALANCE_UPDATE, handleBalanceUpdate);
        return () => unsubscribe(EVENT_COMPANY_BALANCE_UPDATE, handleBalanceUpdate);
    }, [canView, subscribe, unsubscribe, handleBalanceUpdate]);

    if (!canView) return null;

    const formatted = masked
        ? '••••••'
        : (Number(balance) || 0).toLocaleString('fr-FR', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center">
            {loading ? (
                <p className="text-cca-textSecondary/40 text-[10px] uppercase font-black tracking-widest italic animate-pulse">Flux en cours…</p>
            ) : (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={formatted}
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 1.05 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="relative"
                    >
                        <p className="text-5xl font-black text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.3)] tracking-tighter">
                            {formatted}
                        </p>
                        {!masked && (
                            <div className="absolute -right-4 -top-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-50" />
                        )}
                    </motion.div>
                </AnimatePresence>
            )}
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/30 mt-4">
                {masked ? 'CANAL CHIFFRÉ' : 'RÉSERVE OPÉRATIONNELLE'}
            </p>
        </div>
    );
};

BalanceDisplayNumber.propTypes = {
    masked: PropTypes.bool,
    refreshKey: PropTypes.number,
    currency: PropTypes.string,
};

BalanceDisplayNumber.defaultProps = {
    masked: false,
    refreshKey: 0,
    currency: 'USD',
};

export default BalanceDisplayNumber;
