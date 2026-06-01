import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MessageCircle, Archive, Plus } from 'lucide-react';
import { listActiveThreads, listArchivedThreads } from '../../api/client';
import CreateThreadModal from './CreateThreadModal';

export default function ThreadListDrawer({ open, onClose, guildId, channelId }) {
    const [tab, setTab]         = useState('active');
    const [items, setItems]     = useState([]);
    const [creating, setCreate] = useState(false);
    const navigate              = useNavigate();

    useEffect(() => {
        if (!open || !channelId) return;
        const load = tab === 'active' ? listActiveThreads : listArchivedThreads;
        load(guildId, channelId).then(r => setItems(r?.threads ?? r ?? [])).catch(() => setItems([]));
    }, [open, channelId, guildId, tab]);

    if (!open) return null;

    return (
        <aside className="tv2-side-panel">
            <div className="tv2-side-head">
                <MessageCircle size={16} />
                <span className="tv2-side-title">Fils</span>
                <button className="tv2-icon-btn" onClick={onClose} aria-label="Fermer"><X size={14} /></button>
            </div>
            <div className="tv2-tab-row">
                <button className={`tv2-tab ${tab === 'active' ? 'is-active' : ''}`} onClick={() => setTab('active')}>
                    Actifs
                </button>
                <button className={`tv2-tab ${tab === 'archived' ? 'is-active' : ''}`} onClick={() => setTab('archived')}>
                    <Archive size={12} /> Archivés
                </button>
                <button className="tv2-tab is-cta" onClick={() => setCreate(true)}>
                    <Plus size={12} /> Nouveau
                </button>
            </div>
            <div className="tv2-side-list">
                {items.length === 0 ? (
                    <div className="tv2-empty">Aucun fil {tab === 'active' ? 'actif' : 'archivé'}.</div>
                ) : items.map(t => (
                    <button
                        key={t.id}
                        className="tv2-thread-item"
                        onClick={() => navigate(`/dashboard/tchatv2/guilds/${guildId}/channels/${t.id}`)}
                    >
                        <span className="tv2-thread-hash">↳</span>
                        <span className="tv2-thread-name">{t.name}</span>
                        {t.messageCount != null && <span className="tv2-thread-count">{t.messageCount}</span>}
                    </button>
                ))}
            </div>

            <CreateThreadModal
                open={creating}
                onClose={() => setCreate(false)}
                guildId={guildId}
                channelId={channelId}
            />
        </aside>
    );
}
