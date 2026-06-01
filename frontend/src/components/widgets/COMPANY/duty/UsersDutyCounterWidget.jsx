// frontend/src/components/widgets/COMPANY/duty/UsersDutyCounterWidget.jsx

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { User, StopCircle, XCircle } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { getWidgetData_UsersDutyCounter } from '@/services/widgets/userDutyCounter.service';
import { finishEvent, deleteEvent } from '@/services/calendarService';
import { ContextMenu, ContextMenuItem } from '@/components/ui/ContextMenu';

function formatDuration(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;

    return [
        h.toString().padStart(2, '0'),
        m.toString().padStart(2, '0'),
        s.toString().padStart(2, '0'),
    ].join(':');
}

const UsersDutyCounterWidget = ({ config }) => {
    const { activeCompany } = useCompany();
    const companyId = activeCompany?.id ?? null;
    const navigate = useNavigate();

    const { subscribe, unsubscribe } = useWebSocket();
    const { has } = usePermissions();
    const canManage = has(`EMPLOYEES.${companyId}.EMPLOYEES.MANAGE`);

    const [loading, setLoading] = useState(true);
    const [activeUsers, setActiveUsers] = useState([]);
    const [nowMs, setNowMs] = useState(Date.now());
    const [contextMenu, setContextMenu] = useState(null); // { x, y, user }

    const fetchData = useCallback(
        async ({ silent = false } = {}) => {
            if (!companyId) return;

            if (!silent) setLoading(true);
            try {
                const data = await getWidgetData_UsersDutyCounter(companyId, config);

                const users = Array.isArray(data?.users) ? data.users : [];
                const mapped = users.map((u) => ({
                    userId: u.userId,
                    companyEmployeeId: u.companyEmployeeId ?? null,
                    calendarEventId: u.calendarEventId ?? null,
                    name: u.name,
                    startTimeMs: new Date(u.startTime).getTime(),
                }));

                setActiveUsers(mapped);
                setNowMs(Date.now());
            } catch (error) {
                console.error('[UsersDutyCounterWidget] load failed', error);
                setActiveUsers([]);
            } finally {
                if (!silent) setLoading(false);
            }
        },
        [companyId, config]
    );

    useEffect(() => {
        fetchData({ silent: false });
    }, [fetchData]);

    useEffect(() => {
        if (!activeUsers.length) return;

        const interval = setInterval(() => {
            setNowMs(Date.now());
        }, 1000);

        return () => clearInterval(interval);
    }, [activeUsers.length]);

    useEffect(() => {
        if (!companyId) return;

        const onDutyStarted = (payload) => {
            try {
                if (!payload) return;
                if (payload.companyId !== companyId) return;
                fetchData({ silent: true });
            } catch (err) {
                console.error('[UsersDutyCounterWidget][WS] DUTY_STARTED handler error:', err);
            }
        };

        const onDutyEnded = (payload) => {
            try {
                if (!payload) return;
                if (payload.companyId !== companyId) return;
                fetchData({ silent: true });
            } catch (err) {
                console.error('[UsersDutyCounterWidget][WS] DUTY_ENDED handler error:', err);
            }
        };

        subscribe('DUTY_STARTED', onDutyStarted);
        subscribe('DUTY_ENDED', onDutyEnded);

        return () => {
            unsubscribe('DUTY_STARTED', onDutyStarted);
            unsubscribe('DUTY_ENDED', onDutyEnded);
        };
    }, [companyId, subscribe, unsubscribe, fetchData]);

    const rows = useMemo(() => {
        return activeUsers
            .map((u) => {
                const elapsedSeconds = Math.max(0, Math.floor((nowMs - u.startTimeMs) / 1000));
                return { ...u, elapsedSeconds };
            })
            .sort((a, b) => b.elapsedSeconds - a.elapsedSeconds);
    }, [activeUsers, nowMs]);

    const handleContextMenu = (e, user) => {
        e.preventDefault();
        e.stopPropagation();
        if (!canManage) return;
        setContextMenu({ x: e.clientX, y: e.clientY, user });
    };

    const handleViewProfile = () => {
        if (contextMenu?.user?.companyEmployeeId) {
            navigate(`/dashboard/company/employees/${contextMenu.user.companyEmployeeId}`);
        }
        setContextMenu(null);
    };

    const handleStop = async () => {
        const eventId = contextMenu?.user?.calendarEventId;
        setContextMenu(null);
        if (!eventId) return;
        try {
            await finishEvent(eventId);
        } catch (err) {
            console.error('[UsersDutyCounterWidget] finishEvent failed', err);
        }
    };

    const handleCancel = async () => {
        const eventId = contextMenu?.user?.calendarEventId;
        setContextMenu(null);
        if (!eventId) return;
        try {
            await deleteEvent(eventId);
        } catch (err) {
            console.error('[UsersDutyCounterWidget] deleteEvent failed', err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-cca-textSecondary/40 italic uppercase tracking-widest text-[10px]">
                Synchronisation…
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-6 border-b border-cca-border/20 pb-4 flex-shrink-0">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40">Déploiement Opérationnel</h3>
                <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-500 uppercase tracking-tighter shadow-sm animate-pulse">
                    {rows.length} ACTIFS
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-cca-textSecondary/30 text-center space-y-2 py-10">
                    <div className="w-12 h-12 rounded-2xl bg-cca-base/20 flex items-center justify-center opacity-30">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest italic">Aucun agent détecté</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto glass-scroll pr-1">
                    <div className="space-y-1.5 pb-2">
                        {rows.map((u) => (
                            <div
                                key={u.userId}
                                className="group flex items-center justify-between rounded-xl bg-cca-base/40 border border-cca-border/20 p-3 hover:bg-cca-surface/20 transition-all shadow-sm hover:shadow-xl hover:scale-[1.01]"
                                onContextMenu={(e) => handleContextMenu(e, u)}
                            >
                                {u.companyEmployeeId ? (
                                    <Link
                                        to={`/dashboard/company/employees/${u.companyEmployeeId}`}
                                        className="text-cca-textPrimary font-bold text-xs truncate group-hover:text-brand-primary transition-colors"
                                        title={u.name}
                                    >
                                        {u.name}
                                    </Link>
                                ) : (
                                    <span className="text-cca-textPrimary font-bold text-xs truncate" title={u.name}>
                                        {u.name}
                                    </span>
                                )}

                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                    <div className="font-mono text-xs font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                                        {formatDuration(u.elapsedSeconds)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {contextMenu && (
                <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
                    {contextMenu.user.companyEmployeeId && (
                        <ContextMenuItem icon={User} onClick={handleViewProfile}>
                            Voir le profil employé
                        </ContextMenuItem>
                    )}
                    {contextMenu.user.calendarEventId && (
                        <>
                            <ContextMenuItem icon={StopCircle} onClick={handleStop}>
                                Stopper le service
                            </ContextMenuItem>
                            <ContextMenuItem icon={XCircle} danger onClick={handleCancel}>
                                Annuler le service
                            </ContextMenuItem>
                        </>
                    )}
                </ContextMenu>
            )}
        </div>
    );
};

UsersDutyCounterWidget.propTypes = {
    config: PropTypes.object,
};

UsersDutyCounterWidget.defaultProps = {
    config: {},
};

export default UsersDutyCounterWidget;
