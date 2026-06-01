import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Users, X } from 'lucide-react';
import { useMemberStore } from '../stores/memberStore';
import { useRoleStore } from '../stores/roleStore';
import { usePresenceStore } from '../stores/presenceStore';
import { listPostSubscribers } from '../api/client';
import MemberProfilePopup from './MemberProfilePopup';

const EMPTY_ARR = [];

function presenceColor(status) {
    if (status === 'online') return 'rgb(34 197 94)';
    if (status === 'idle')   return 'rgb(234 179 8)';
    if (status === 'dnd')    return 'rgb(239 68 68)';
    return 'rgb(100 116 139)';
}

function roleColor(color) {
    if (!color) return undefined;
    return '#' + color.toString(16).padStart(6, '0');
}

function MemberRow({ member, guildId, statuses, onClickMember, nameColor }) {
    const uid    = String(member.userId ?? member.id);
    const isMod  = uid === '4';
    const status = statuses[uid] || 'offline';
    const name   = member.nickname || member.user?.name || member.user?.username || uid;
    const initial = (name[0] || '?').toUpperCase();
    const avatarSrc = member.avatarHash
        ? `/avatars/${member.avatarHash}`
        : member.user?.imageUrl || null;

    const handleClick = useCallback((e) => {
        onClickMember(member, e.currentTarget.getBoundingClientRect());
    }, [member, onClickMember]);

    return (
        <div className="tv2-member-row" title={name} onClick={handleClick} style={{ cursor: 'pointer' }}>
            <span className="tv2-member-avatar">
                {avatarSrc
                    ? <img src={avatarSrc} alt={name} />
                    : <span className="tv2-member-initial">{initial}</span>}
                <span className="tv2-member-presence"
                    style={{ background: presenceColor(status) }}
                    aria-label={status}
                />
            </span>
            <div className={`tv2-member-name-wrap${isMod ? ' tv2-member-name-wrap--mod' : ''}`}>
                <span className="tv2-member-name" style={nameColor ? { color: nameColor } : undefined}>{name}</span>
                {isMod && <span className="tv2-member-badge tv2-member-badge--mod">MOD</span>}
            </div>
        </div>
    );
}

export default function MemberPanel({ open, onClose, guildId, threadId, isForumPost, subVersion }) {
    const members  = useMemberStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const roles    = useRoleStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const statuses = usePresenceStore(s => s.statuses);
    const [subscribers, setSubscribers] = useState(null);
    const [popup, setPopup] = useState(null); // { member, rect }

    useEffect(() => {
        if (!open || !isForumPost || !threadId || !guildId) return;
        setSubscribers(null);
        listPostSubscribers(guildId, threadId)
            .then(data => setSubscribers(data.subscribers ?? []))
            .catch(() => setSubscribers([]));
    }, [open, isForumPost, threadId, guildId, subVersion]);

    const handleClickMember = useCallback((member, rect) => {
        setPopup(prev => (prev?.member === member ? null : { member, rect }));
    }, []);

    const closePopup = useCallback(() => setPopup(null), []);

    const grouped = useMemo(() => {
        if (isForumPost) return null;
        const byRole = new Map();
        const noRole = [];
        for (const m of members) {
            const hoistedRole = (m.roleIds || [])
                .map(id => roles.find(r => String(r.id) === String(id)))
                .filter(Boolean)
                .find(r => r.hoist);
            if (hoistedRole) {
                if (!byRole.has(hoistedRole.id)) byRole.set(hoistedRole.id, { role: hoistedRole, list: [] });
                byRole.get(hoistedRole.id).list.push(m);
            } else {
                noRole.push(m);
            }
        }
        const sections = Array.from(byRole.values())
            .sort((a, b) => (b.role.position ?? 0) - (a.role.position ?? 0));
        if (noRole.length) sections.push({ role: { id: '__none', name: 'En ligne', color: null }, list: noRole });
        return sections;
    }, [members, roles, isForumPost]);

    if (!open) return null;

    if (isForumPost) {
        const count = subscribers?.length ?? '…';
        return (
            <>
                <aside className="tv2-side-panel tv2-member-panel">
                    <header className="tv2-side-head">
                        <Users size={14} />
                        <span className="tv2-side-title">Abonnés — {count}</span>
                        <button className="tv2-icon-btn" onClick={onClose} aria-label="Fermer"><X size={14} /></button>
                    </header>
                    <div className="tv2-side-list tv2-member-list">
                        {subscribers === null && <div className="tv2-empty">Chargement…</div>}
                        {subscribers !== null && subscribers.length === 0 && (
                            <div className="tv2-empty">Aucun abonné.</div>
                        )}
                        {(subscribers ?? []).map(sub => {
                            const uid     = String(sub.userId);
                            const status  = statuses[uid] || 'offline';
                            const name    = sub.name || sub.username || uid;
                            const initial = (name[0] || '?').toUpperCase();
                            const avatarSrc = sub.imageUrl || null;
                            return (
                                <div
                                    key={uid}
                                    className="tv2-member-row"
                                    title={name}
                                    style={{ cursor: 'pointer' }}
                                    onClick={e => handleClickMember(
                                        { userId: sub.userId, user: sub, roleIds: [], avatarHash: null },
                                        e.currentTarget.getBoundingClientRect()
                                    )}
                                >
                                    <span className="tv2-member-avatar">
                                        {avatarSrc
                                            ? <img src={avatarSrc} alt={name} />
                                            : <span className="tv2-member-initial">{initial}</span>}
                                        <span className="tv2-member-presence"
                                            style={{ background: presenceColor(status) }}
                                            aria-label={status}
                                        />
                                    </span>
                                    <span className="tv2-member-name">{name}</span>
                                </div>
                            );
                        })}
                    </div>
                </aside>
                {popup && (
                    <MemberProfilePopup
                        member={popup.member}
                        guildId={guildId}
                        anchorRect={popup.rect}
                        onClose={closePopup}
                    />
                )}
            </>
        );
    }

    return (
        <>
            <aside className="tv2-side-panel tv2-member-panel">
                <header className="tv2-side-head">
                    <Users size={14} />
                    <span className="tv2-side-title">Membres — {members.length}</span>
                    <button className="tv2-icon-btn" onClick={onClose} aria-label="Fermer"><X size={14} /></button>
                </header>
                <div className="tv2-side-list tv2-member-list">
                    {members.length === 0 && <div className="tv2-empty">Aucun membre.</div>}
                    {(grouped ?? []).map(section => (
                        <section key={section.role.id} className="tv2-member-section">
                            <div className="tv2-member-section-title">
                                {section.role.name} — {section.list.length}
                            </div>
                            {section.list.map(m => (
                                <MemberRow
                                    key={String(m.userId ?? m.id)}
                                    member={m}
                                    guildId={guildId}
                                    statuses={statuses}
                                    onClickMember={handleClickMember}
                                    nameColor={roleColor(section.role.color)}
                                />
                            ))}
                        </section>
                    ))}
                </div>
            </aside>
            {popup && (
                <MemberProfilePopup
                    member={popup.member}
                    guildId={guildId}
                    anchorRect={popup.rect}
                    onClose={closePopup}
                />
            )}
        </>
    );
}
