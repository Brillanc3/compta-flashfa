import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useMatch } from 'react-router-dom';
import { X, Plus, MessageSquare, Menu } from 'lucide-react';
import { useDmStore } from '../../stores/dmStore';
import { usePresenceStore } from '../../stores/presenceStore';
import { fetchDms, closeDm, openDm, createGroupDm } from '../../api/client';
import NewDmModal from '../DM/NewDmModal';

function dmDisplayName(dm) {
    if (dm.type === 'GROUP_DM' && dm.name) return dm.name;
    if (dm.recipients?.length === 1) {
        const r = dm.recipients[0];
        return r.user?.name ?? r.name ?? r.username ?? `DM ${dm.id}`;
    }
    if (dm.recipients?.length > 1) return dm.recipients.map(r => r.user?.name ?? r.name ?? r.username).join(', ');
    return `DM ${dm.id}`;
}

function hashColor(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    const p = ['#5474A0','#7c6aad','#3d8fa8','#4a9e6b','#a06b3d','#a04455','#6a8a3d'];
    return p[h % p.length];
}

function presenceColor(s) {
    if (s === 'online')  return '#22c55e';
    if (s === 'idle')    return '#eab308';
    if (s === 'dnd')     return '#ef4444';
    return '#475569';
}

export default function DmSidebar({ isOpen = true, companyOpen = false, onNavigate, onOpenDashboard }) {
    const dms       = useDmStore(s => s.dms);
    const setDms    = useDmStore(s => s.setDms);
    const removeDm  = useDmStore(s => s.removeDm);
    const statuses  = usePresenceStore(s => s.statuses);
    const dmMatch     = useMatch('/dashboard/tchatv2/dm/:channelId');
    const activeChanId = dmMatch?.params?.channelId ?? null;
    const navigate  = useNavigate();
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        fetchDms().then(setDms).catch(() => {});
    }, [setDms]);

    const go = useCallback((dmId) => {
        navigate(`/dashboard/tchatv2/dm/${dmId}`);
        onNavigate?.();
    }, [navigate, onNavigate]);

    const handleClose = useCallback(async (e, dmId) => {
        e.stopPropagation();
        await closeDm(dmId).catch(() => {});
        removeDm(dmId);
        if (String(activeChanId) === String(dmId)) {
            navigate('/dashboard/tchatv2/dm');
        }
    }, [activeChanId, navigate, removeDm]);

    const handleSelect = useCallback(async (userIds) => {
        setModalOpen(false);
        try {
            let id;
            if (userIds.length === 1) {
                ({ id } = await openDm(userIds[0]));
            } else {
                ({ id } = await createGroupDm({ memberIds: userIds.map(Number) }));
            }
            const updated = await fetchDms();
            setDms(updated);
            go(id);
        } catch { /* ignore */ }
    }, [go, setDms]);

    return (
        <>
            <aside className={['tv2-channel-sidebar', isOpen ? 'is-open' : '', companyOpen ? 'with-company' : ''].filter(Boolean).join(' ')}>
                {/* Header */}
                <div className="tv2-dm-sidebar-head">
                    {onOpenDashboard && (
                        <button className="tv2-icon-btn" onClick={onOpenDashboard} title="Menu principal">
                            <Menu size={16} />
                        </button>
                    )}
                    <MessageSquare size={14} className="tv2-dm-sidebar-icon" />
                    <span className="tv2-dm-sidebar-title">Messages directs</span>
                    <button
                        className="tv2-dm-sidebar-add"
                        onClick={() => setModalOpen(true)}
                        title="Nouveau message"
                        aria-label="Ouvrir une nouvelle conversation"
                    >
                        <Plus size={15} />
                    </button>
                </div>

                {/* DM list */}
                <div className="tv2-channel-list">
                    {dms.length === 0 && (
                        <div className="tv2-dm-sidebar-empty">
                            <MessageSquare size={20} opacity={0.3} />
                            <span>Aucune conversation</span>
                        </div>
                    )}
                    {dms.map(dm => {
                        const name   = dmDisplayName(dm);
                        const active = String(dm.id) === String(activeChanId);
                        const initial= (name[0] || '?').toUpperCase();
                        const bg     = hashColor(dm.id);

                        // For 1-1 DMs, show presence of the other user
                        const otherId = dm.recipients?.[0]?.id;
                        const status  = otherId ? (statuses[String(otherId)] || 'offline') : null;

                        return (
                            <button
                                key={dm.id}
                                className={`tv2-dm-item${active ? ' is-active' : ''}`}
                                onClick={() => go(dm.id)}
                                title={name}
                            >
                                <span className="tv2-dm-item-avatar" style={{ '--av-bg': bg }}>
                                    <span className="tv2-dm-item-initial">{initial}</span>
                                    {status && (
                                        <span
                                            className="tv2-dm-item-dot"
                                            style={{ background: presenceColor(status) }}
                                            aria-label={status}
                                        />
                                    )}
                                </span>
                                <span className="tv2-dm-item-name">{name}</span>
                                <button
                                    className="tv2-dm-item-close tv2-icon-btn"
                                    onClick={e => handleClose(e, dm.id)}
                                    title="Fermer"
                                    aria-label="Fermer ce DM"
                                >
                                    <X size={12} />
                                </button>
                            </button>
                        );
                    })}
                </div>
            </aside>

            {modalOpen && (
                <NewDmModal
                    onClose={() => setModalOpen(false)}
                    onSelect={handleSelect}
                />
            )}
        </>
    );
}
