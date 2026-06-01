import React, { useEffect, useState } from 'react';
import { Pin, X } from 'lucide-react';
import { fetchPins, unpinMessage } from '../../api/client';

export default function PinnedDrawer({ open, onClose, guildId, channelId, canManage = false, onJumpTo }) {
    const [items, setItems] = useState([]);
    const [loading, setLoad]= useState(false);

    useEffect(() => {
        if (!open || !channelId) return;
        setLoad(true);
        fetchPins(guildId, channelId)
            .then(r => setItems(r?.pins ?? r ?? []))
            .catch(() => setItems([]))
            .finally(() => setLoad(false));
    }, [open, channelId, guildId]);

    const unpin = async (id) => {
        await unpinMessage(guildId, channelId, id);
        setItems(list => list.filter(m => String(m.id) !== String(id)));
    };

    if (!open) return null;

    return (
        <aside className="tv2-side-panel">
            <div className="tv2-side-head">
                <Pin size={16} />
                <span className="tv2-side-title">Messages épinglés</span>
                <button className="tv2-icon-btn" onClick={onClose}><X size={14} /></button>
            </div>
            <div className="tv2-side-list">
                {loading ? (
                    <div className="tv2-empty">Chargement…</div>
                ) : items.length === 0 ? (
                    <div className="tv2-empty">
                        <Pin size={28} className="tv2-empty-icon" />
                        <p>Rien d'épinglé ici.</p>
                        <small>Survolez un message → icône <Pin size={11} /> pour l'épingler.</small>
                    </div>
                ) : items.map(m => (
                    <article key={m.id} className="tv2-pin-card">
                        <header className="tv2-pin-head">
                            <span className="tv2-pin-author">{m.authorNickname || m.authorUsername || '?'}</span>
                            <time className="tv2-pin-time">{new Date(m.createdAt).toLocaleString()}</time>
                        </header>
                        <p className="tv2-pin-body">{m.content}</p>
                        <footer className="tv2-pin-actions">
                            <button className="tv2-link" onClick={() => onJumpTo?.(m.id)}>Aller au message</button>
                            {canManage && (
                                <button className="tv2-link is-danger" onClick={() => unpin(m.id)}>Désépingler</button>
                            )}
                        </footer>
                    </article>
                ))}
            </div>
        </aside>
    );
}
