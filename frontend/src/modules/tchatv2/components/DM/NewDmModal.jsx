import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { X, Search, MessageSquarePlus, UserRound, Users, Check } from 'lucide-react';
import { useMemberStore } from '../../stores/memberStore';
import { useGuildStore } from '../../stores/guildStore';
import { usePresenceStore } from '../../stores/presenceStore';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMembers } from '../../api/client';

const MAX_MEMBERS = 9;

function presenceColor(status) {
    if (status === 'online')  return '#22c55e';
    if (status === 'idle')    return '#eab308';
    if (status === 'dnd')     return '#ef4444';
    return '#475569';
}

function hashColor(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    const p = ['#5474A0','#7c6aad','#3d8fa8','#4a9e6b','#a06b3d','#a04455','#6a8a3d'];
    return p[h % p.length];
}

export default function NewDmModal({ onClose, onSelect }) {
    const [query, setQuery]       = useState('');
    const [selected, setSelected] = useState(new Set()); // Set<uid string>
    const inputRef = useRef(null);
    const { user }   = useAuth();
    const myId       = String(user?.id ?? '');
    const byGuild    = useMemberStore(s => s.byGuild);
    const setMembers = useMemberStore(s => s.setMembers);
    const guilds     = useGuildStore(s => s.guilds);
    const statuses   = usePresenceStore(s => s.statuses);

    useEffect(() => { inputRef.current?.focus(); }, []);

    // Prefetch members for all guilds — byGuild only populates on channel visit
    useEffect(() => {
        for (const g of guilds) {
            const gid = String(g.id);
            if (byGuild[gid]) continue;
            fetchMembers(gid)
                .then(ms => setMembers(gid, ms ?? []))
                .catch(() => {});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guilds]);

    // Aggregate unique users — exclude self
    const allUsers = useMemo(() => {
        const map = new Map();
        for (const members of Object.values(byGuild)) {
            for (const m of members) {
                const uid = String(m.userId ?? m.id ?? '');
                if (!uid || uid === myId || map.has(uid)) continue;
                const name = m.nickname || m.user?.name || m.user?.username || m.username || uid;
                map.set(uid, { uid, name, sub: m.user?.username ?? m.username ?? '', avatarUrl: m.avatarUrl ?? null });
            }
        }
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [byGuild, myId]);

    // selectedUsers in order of selection
    const selectedUsers = useMemo(
        () => Array.from(selected).map(uid => allUsers.find(u => u.uid === uid)).filter(Boolean),
        [selected, allUsers]
    );

    const results = useMemo(() => {
        if (!query.trim()) return allUsers;
        const q = query.toLowerCase();
        return allUsers.filter(u =>
            u.name.toLowerCase().includes(q) || u.sub.toLowerCase().includes(q)
        );
    }, [allUsers, query]);

    const toggle = useCallback((uid) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(uid)) { next.delete(uid); }
            else if (next.size < MAX_MEMBERS) { next.add(uid); }
            return next;
        });
    }, []);

    const handleConfirm = useCallback(() => {
        if (selected.size === 0) return;
        onSelect(Array.from(selected));
    }, [selected, onSelect]);

    const isGroup = selected.size > 1;
    const canAdd  = selected.size < MAX_MEMBERS;

    return (
        <div className="tv2-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="tv2-modal tv2-ndm-modal" role="dialog" aria-modal="true" aria-label="Nouveau message">

                {/* Header */}
                <div className="tv2-modal-head tv2-ndm-head">
                    {isGroup
                        ? <Users size={18} className="tv2-ndm-head-icon" />
                        : <MessageSquarePlus size={18} className="tv2-ndm-head-icon" />
                    }
                    <h2 className="tv2-modal-title">
                        {isGroup ? 'Nouveau groupe' : 'Nouveau message'}
                    </h2>
                    <button className="tv2-modal-close" onClick={onClose} aria-label="Fermer">
                        <X size={16} />
                    </button>
                </div>

                {/* Selected chips */}
                {selectedUsers.length > 0 && (
                    <div className="tv2-ndm-chips">
                        {selectedUsers.map(u => (
                            <span key={u.uid} className="tv2-ndm-chip">
                                <span className="tv2-ndm-chip-name">{u.name}</span>
                                <button
                                    className="tv2-ndm-chip-del"
                                    onClick={() => toggle(u.uid)}
                                    aria-label={`Retirer ${u.name}`}
                                >
                                    <X size={11} />
                                </button>
                            </span>
                        ))}
                        {!canAdd && (
                            <span className="tv2-ndm-chip-limit">Max {MAX_MEMBERS}</span>
                        )}
                    </div>
                )}

                {/* Search */}
                <div className="tv2-ndm-search-wrap">
                    <Search size={15} className="tv2-ndm-search-icon" />
                    <input
                        ref={inputRef}
                        className="tv2-ndm-search"
                        type="text"
                        placeholder={canAdd ? 'Rechercher un utilisateur…' : `Maximum ${MAX_MEMBERS} membres atteint`}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        disabled={!canAdd}
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {query && (
                        <button className="tv2-ndm-search-clear" onClick={() => setQuery('')} aria-label="Effacer">
                            <X size={13} />
                        </button>
                    )}
                </div>

                {/* User list */}
                <div className="tv2-ndm-list" role="listbox" aria-multiselectable="true">
                    {results.length === 0 && (
                        <div className="tv2-ndm-empty">
                            <UserRound size={32} className="tv2-ndm-empty-icon" />
                            <p>Aucun utilisateur trouvé</p>
                        </div>
                    )}
                    {results.map(u => {
                        const initial   = (u.name[0] || '?').toUpperCase();
                        const bg        = hashColor(u.uid);
                        const status    = statuses[u.uid] || 'offline';
                        const isChecked = selected.has(u.uid);
                        return (
                            <button
                                key={u.uid}
                                className={`tv2-ndm-item${isChecked ? ' is-checked' : ''}`}
                                onClick={() => toggle(u.uid)}
                                disabled={!isChecked && !canAdd}
                                role="option"
                                aria-selected={isChecked}
                            >
                                <span className="tv2-ndm-avatar" style={{ '--av-bg': bg }}>
                                    {u.avatarUrl
                                        ? <img src={u.avatarUrl} alt="" />
                                        : <span className="tv2-ndm-initial">{initial}</span>
                                    }
                                    <span
                                        className="tv2-ndm-presence"
                                        style={{ background: presenceColor(status) }}
                                        aria-label={status}
                                    />
                                </span>
                                <span className="tv2-ndm-info">
                                    <span className="tv2-ndm-name">{u.name}</span>
                                    {u.sub && u.sub !== u.name && (
                                        <span className="tv2-ndm-sub">@{u.sub}</span>
                                    )}
                                </span>
                                {isChecked
                                    ? <span className="tv2-ndm-check"><Check size={14} /></span>
                                    : <span className="tv2-ndm-arrow">→</span>
                                }
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="tv2-ndm-foot">
                    <span className="tv2-ndm-count">
                        {selected.size > 0
                            ? `${selected.size} sélectionné${selected.size > 1 ? 's' : ''}`
                            : `${results.length} utilisateur${results.length !== 1 ? 's' : ''}`
                        }
                    </span>
                    <button
                        className="tv2-btn-primary tv2-ndm-confirm"
                        onClick={handleConfirm}
                        disabled={selected.size === 0}
                    >
                        {isGroup ? 'Créer le groupe' : 'Ouvrir'}
                    </button>
                </div>
            </div>
        </div>
    );
}
