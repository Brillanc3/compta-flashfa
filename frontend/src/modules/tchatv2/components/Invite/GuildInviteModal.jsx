import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Copy, Check } from 'lucide-react';
import {
    fetchChannelInvites,
    createChannelInvite,
    fetchGuildInvites,
    createGuildInvite,
    fetchMembers,
    openDm,
    sendDmMessage,
} from '../../api/client';
import { useMemberStore } from '../../stores/memberStore';
import { useGuildStore } from '../../stores/guildStore';
import EditInviteModal from './EditInviteModal';

const BASE_URL = window.location.origin;
const DEFAULT_MAX_AGE  = 2592000;
const DEFAULT_MAX_USES = 0;

function formatRemaining(invite) {
    if (!invite?.expiresAt) return 'Votre lien d\'invitation n\'expire jamais.';
    const ms = new Date(invite.expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'Votre lien est expiré.';
    const days  = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    if (days >= 1)  return `Votre lien d'invitation expire dans ${days} jour${days > 1 ? 's' : ''}.`;
    if (hours >= 1) return `Votre lien d'invitation expire dans ${hours} heure${hours > 1 ? 's' : ''}.`;
    return 'Votre lien d\'invitation expire bientôt.';
}

function pickReusableInvite(list, myUserId) {
    const now = Date.now();
    return list.find(inv => {
        if (String(inv.userId) !== String(myUserId)) return false;
        if (inv.expiresAt && new Date(inv.expiresAt).getTime() - now < 86_400_000) return false;
        if (inv.maxUses > 0 && inv.uses >= inv.maxUses) return false;
        return true;
    });
}

export default function GuildInviteModal({ open, onClose, guild, defaultChannelId, myUserId }) {
    const [query, setQuery]           = useState('');
    const [invite, setInvite]         = useState(null);
    const [inviteLoading, setInviteLoading] = useState(true);
    const [inviteError, setInviteError] = useState(null);
    const [copied, setCopied]         = useState(false);
    const [editOpen, setEditOpen]     = useState(false);
    const [pendingIds, setPendingIds] = useState(() => new Set());
    const [sentIds, setSentIds]       = useState(() => new Set());
    const searchRef    = useRef(null);
    const byGuild      = useMemberStore(s => s.byGuild);
    const setStoreMembers = useMemberStore(s => s.setMembers);
    const guilds       = useGuildStore(s => s.guilds);

    // Prefetch members for all guilds (includes companyEmployee virtual members)
    useEffect(() => {
        if (!open) return;
        for (const g of guilds) {
            const gid = String(g.id);
            if (byGuild[gid]) continue;
            fetchMembers(gid).then(ms => setStoreMembers(gid, ms ?? [])).catch(() => {});
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, guilds]);

    const allUsers = useMemo(() => {
        const map = new Map();
        const myId = String(myUserId ?? '');
        for (const members of Object.values(byGuild)) {
            for (const m of members) {
                const uid = String(m.userId ?? m.id ?? '');
                if (!uid || uid === myId || map.has(uid)) continue;
                const name = m.nickname || m.user?.name || m.user?.username || m.username || uid;
                map.set(uid, { id: uid, name, avatarHash: m.user?.avatarHash ?? m.avatarHash ?? null });
            }
        }
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [byGuild, myUserId]);

    const members = useMemo(() => {
        if (!query.trim()) return allUsers;
        const q = query.toLowerCase();
        return allUsers.filter(u => u.name.toLowerCase().includes(q));
    }, [allUsers, query]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setInviteLoading(true);
        setInviteError(null);
        (async () => {
            try {
                let list, chosen;
                if (defaultChannelId) {
                    list   = await fetchChannelInvites(guild.id, defaultChannelId);
                    chosen = Array.isArray(list) ? pickReusableInvite(list, myUserId) : null;
                    if (!chosen) chosen = await createChannelInvite(guild.id, defaultChannelId, { maxAge: DEFAULT_MAX_AGE, maxUses: DEFAULT_MAX_USES });
                } else {
                    list   = await fetchGuildInvites(guild.id);
                    chosen = Array.isArray(list) ? pickReusableInvite(list, myUserId) : null;
                    if (!chosen) chosen = await createGuildInvite(guild.id, { maxAge: DEFAULT_MAX_AGE, maxUses: DEFAULT_MAX_USES });
                }
                if (!cancelled) setInvite(chosen);
            } catch (e) {
                if (!cancelled) setInviteError(e?.response?.data?.message ?? 'Erreur lors de la création du lien.');
            } finally {
                if (!cancelled) setInviteLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open, defaultChannelId, guild?.id, myUserId]);


    useEffect(() => {
        if (open) requestAnimationFrame(() => searchRef.current?.focus());
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = e => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const inviteUrl = invite ? `${BASE_URL}/invite/${invite.code}` : '';

    const handleCopy = () => {
        if (!inviteUrl) return;
        navigator.clipboard.writeText(inviteUrl).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleInviteMember = async (userId) => {
        if (!invite) return;
        setPendingIds(prev => { const n = new Set(prev); n.add(userId); return n; });
        try {
            const dm = await openDm(userId);
            const channelId = dm?.id ?? dm?.channelId ?? dm;
            await sendDmMessage(channelId, { content: inviteUrl });
            setSentIds(prev => { const n = new Set(prev); n.add(userId); return n; });
        } catch (e) {
            console.error('Failed to send invite DM', e);
            alert('Impossible d\'envoyer l\'invitation.');
        } finally {
            setPendingIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
        }
    };

    return createPortal(
        <>
            <div className="tv2-modal-overlay tv2-guild-invite-overlay" onClick={onClose}>
                <div className="tv2-guild-invite-modal" onClick={e => e.stopPropagation()}>
                    <div className="tv2-modal-head">
                        <h3>Inviter des amis sur {guild.name}</h3>
                        <button className="tv2-icon-btn" onClick={onClose}><X size={14} /></button>
                    </div>

                    <div className="tv2-guild-invite-search">
                        <Search size={14} />
                        <input
                            ref={searchRef}
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Rechercher un ami"
                        />
                    </div>

                    <div className="tv2-invite-member-list">
                        {members.length === 0 && (
                            <div className="tv2-invite-empty">Aucun membre à inviter.</div>
                        )}
                        {members.map(m => {
                            const isPending = pendingIds.has(m.id);
                            const isSent    = sentIds.has(m.id);
                            const cls = `tv2-invite-member-btn${isPending ? ' is-pending' : ''}${isSent ? ' is-sent' : ''}`;
                            return (
                                <div key={m.id} className="tv2-invite-member-row">
                                    <div className="tv2-invite-member-avatar">
                                        {m.avatarHash
                                            ? <img src={`/avatars/${m.avatarHash}`} alt={m.name} />
                                            : (m.name?.charAt(0) ?? '?').toUpperCase()}
                                    </div>
                                    <span className="tv2-invite-member-name">{m.name}</span>
                                    <button
                                        className={cls}
                                        onClick={() => handleInviteMember(m.id)}
                                        disabled={isPending || isSent || !invite}
                                    >
                                        {isSent ? 'Envoyé' : isPending ? 'Envoi…' : 'Inviter'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="tv2-invite-link-section">
                        <div className="tv2-invite-link-title">Ou envoyer un lien d'invitation</div>
                        {inviteLoading && <div className="tv2-invite-empty">Chargement du lien…</div>}
                        {inviteError && (
                            <div className="tv2-form-error">{inviteError}</div>
                        )}
                        {invite && (
                            <>
                                <div className="tv2-invite-link-box">
                                    <input readOnly value={inviteUrl} onFocus={e => e.target.select()} />
                                    <button className="tv2-invite-copy-btn" onClick={handleCopy} title="Copier le lien">
                                        {copied ? <Check size={13} /> : <Copy size={13} />}
                                    </button>
                                </div>
                                <div className="tv2-invite-link-meta">{formatRemaining(invite)}</div>
                                <button
                                    className="tv2-invite-edit-trigger"
                                    onClick={() => setEditOpen(true)}
                                >
                                    Modifier le lien d'invitation
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <EditInviteModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                guildId={guild.id}
                channelId={defaultChannelId}
                currentInvite={invite}
                onReplaced={(newInvite) => setInvite(newInvite)}
            />
        </>,
        document.body,
    );
}
