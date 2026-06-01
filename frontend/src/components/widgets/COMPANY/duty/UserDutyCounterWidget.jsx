import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useCompany } from "@/contexts/CompanyContext.jsx";
import { useAuth } from "@/contexts/AuthContext";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { getWidgetData_UserDutyCounter } from "@/services/widgets/userDutyCounter.service";

function formatDuration(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;

    return [
        h.toString().padStart(2, "0"),
        m.toString().padStart(2, "0"),
        s.toString().padStart(2, "0"),
    ].join(":");
}

const UserDutyCounterWidget = ({ config }) => {
    const { activeCompanyId } = useCompany();
    const { user } = useAuth();
    const { subscribe, unsubscribe } = useWebSocket(); // subscribe/unsubscribe via context

    const companyId = useMemo(() => {
        const n = Number(activeCompanyId);
        return Number.isFinite(n) && n > 0 ? n : null;
    }, [activeCompanyId]);

    const myUserId = user?.id ?? null;

    // Defaults config
    const showGlobal = config?.showGlobal === true;
    const globalLabel = config?.globalLabel || "Total (semaine)";
    const showIncludingActive = config?.showIncludingActive !== false; // default true
    const globalTimeframe = (config?.globalTimeframe || "week").toLowerCase();

    // Stabilise la dépendance config (car souvent recréée par parent)
    const configKey = useMemo(() => JSON.stringify(config || {}), [config]);

    const [loading, setLoading] = useState(true);

    // Service en cours
    const [inService, setInService] = useState(false);
    const [startTime, setStartTime] = useState(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    // Global (optionnel)
    const [globalSeconds, setGlobalSeconds] = useState(null);

    const applyData = useCallback((data) => {
        if (data?.inService) {
            setInService(true);
            setStartTime(data.startTime ? new Date(data.startTime) : null);
            setElapsedSeconds(Number(data.elapsedSeconds) || 0);
        } else {
            setInService(false);
            setStartTime(null);
            setElapsedSeconds(0);
        }

        if (data?.global) {
            setGlobalSeconds(Number(data.global.totalSeconds) || 0);
        } else {
            setGlobalSeconds(null);
        }
    }, []);

    const fetchData = useCallback(
        async ({ silent = false } = {}) => {
            if (!companyId) return;
            if (!silent) setLoading(true);

            try {
                // Important: on passe config au backend via la même route widget
                const data = await getWidgetData_UserDutyCounter(companyId, {
                    ...config,
                    globalTimeframe, // s’assure qu’il y a une valeur
                });
                applyData(data);
            } catch (err) {
                console.error("[UserDutyCounterWidget] load failed:", err);
            } finally {
                if (!silent) setLoading(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [companyId, configKey, globalTimeframe, applyData]
    );

    // Chargement initial
    useEffect(() => {
        fetchData({ silent: false });
    }, [fetchData]);

    // Timer local (1 tick/s) si en service
    useEffect(() => {
        if (!inService || !startTime) return;

        const interval = setInterval(() => {
            const diff = Math.floor((Date.now() - startTime.getTime()) / 1000);
            setElapsedSeconds(Math.max(0, diff));
        }, 1000);

        return () => clearInterval(interval);
    }, [inService, startTime]);

    // WebSocket refresh: uniquement les events du user courant
    useEffect(() => {
        if (!companyId) return;

        const onDutyStarted = (payload) => {
            try {
                if (!payload) return;
                if (payload.companyId !== companyId) return;
                if (payload.userId && myUserId && payload.userId !== myUserId) return;

                fetchData({ silent: true });
            } catch (err) {
                console.error("[UserDutyCounterWidget][WS] DUTY_STARTED handler error:", err);
            }
        };

        const onDutyEnded = (payload) => {
            try {
                if (!payload) return;
                if (payload.companyId !== companyId) return;
                if (payload.userId && myUserId && payload.userId !== myUserId) return;

                fetchData({ silent: true });
            } catch (err) {
                console.error("[UserDutyCounterWidget][WS] DUTY_ENDED handler error:", err);
            }
        };

        subscribe("DUTY_STARTED", onDutyStarted);
        subscribe("DUTY_ENDED", onDutyEnded);

        return () => {
            unsubscribe("DUTY_STARTED", onDutyStarted);
            unsubscribe("DUTY_ENDED", onDutyEnded);
        };
    }, [companyId, myUserId, subscribe, unsubscribe, fetchData]);

    if (!companyId) {
        return (
            <div className="flex items-center justify-center h-full text-cca-textSecondary text-sm">
                Aucune entreprise active.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-cca-textSecondary text-sm">
                Chargement…
            </div>
        );
    }

    const globalMain = globalSeconds ?? 0;

    const globalWithActiveLive =
        inService ? (globalMain + (Number(elapsedSeconds) || 0)) : globalMain;

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <h3 className="text-cca-textSecondary/80 text-sm mb-2 font-medium uppercase tracking-wider">Temps de service</h3>

            {inService ? (
                <div className="font-mono text-3xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                    {formatDuration(elapsedSeconds)}
                </div>
            ) : (
                <div className="text-cca-textSecondary/60 text-sm italic">Pas en service</div>
            )}

            {showGlobal && (
                <div className="mt-4 w-full text-center border-t border-cca-border/20 pt-3">
                    <div className="text-[10px] uppercase font-bold text-cca-textSecondary/40 mb-1">{globalLabel}</div>
                    <div className="font-mono text-lg text-cca-textPrimary font-bold">
                        {formatDuration(globalMain)}
                    </div>

                    {showIncludingActive && (
                        <div className="mt-2 bg-cca-base/30 rounded-lg p-2 border border-cca-border/10">
                            <div className="text-[9px] uppercase font-bold text-cca-textSecondary/50">Cumulé (Live)</div>
                            <div className="font-mono text-sm text-brand-primary font-black">
                                {formatDuration(globalWithActiveLive)}
                            </div>
                        </div>
                    )}

                    <div className="text-[9px] font-black text-cca-textSecondary/30 mt-3 uppercase tracking-tighter">
                        Période: {globalTimeframe.toUpperCase()}
                    </div>
                </div>
            )}
        </div>
    );
};

UserDutyCounterWidget.propTypes = {
    config: PropTypes.object,
};

UserDutyCounterWidget.defaultProps = {
    config: {},
};

export default UserDutyCounterWidget;
