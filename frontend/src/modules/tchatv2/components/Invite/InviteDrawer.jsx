import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link2, Plus, Trash2, X, Copy, Check, Clock, Users } from 'lucide-react';
import { fetchChannelInvites, createChannelInvite, deleteInvite } from '../../api/client';

const BASE_URL = window.location.origin;

function formatExpiry(invite) {
    if (!invite.expiresAt) return 'Jamais';
    const d = new Date(invite.expiresAt);
    if (d < new Date()) return 'Expiré';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const handle = () => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button className="tv2-invite-copy-btn" onClick={handle} title="Copier le lien">
            {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
    );
}

const MAX_AGE_OPTS = [
    { label: '30 minutes',  value: 1800 },
    { label: '1 heure',     value: 3600 },
    { label: '6 heures',    value: 21600 },
    { label: '12 heures',   value: 43200 },
    { label: '1 jour',      value: 86400 },
    { label: '7 jours',     value: 604800 },
    { label: 'Jamais',      value: 0 },
];

const MAX_USES_OPTS = [
    { label: 'Illimité',  value: 0 },
    { label: '1 usage',   value: 1 },
    { label: '5 usages',  value: 5 },
    { label: '10 usages', value: 10 },
    { label: '25 usages', value: 25 },
    { label: '50 usages', value: 50 },
    { label: '100 usages',value: 100 },
];

export default function InviteDrawer({ open, onClose, guildId, channelId, channelName, portal = false }) {
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [maxAge, setMaxAge]   = useState(86400);
    const [maxUses, setMaxUses] = useState(0);
    const [error, setError]    = useState(null);

    useEffect(() => {
        if (!open || !channelId) return;
        setLoading(true);
        setError(null);
        fetchChannelInvites(guildId, channelId)
            .then(data => setInvites(Array.isArray(data) ? data : []))
            .catch(() => setInvites([]))
            .finally(() => setLoading(false));
    }, [open, channelId, guildId]);

    const handleCreate = async () => {
        setCreating(true);
        setError(null);
        try {
            const inv = await createChannelInvite(guildId, channelId, { maxAge, maxUses });
            setInvites(list => [inv, ...list]);
            setShowForm(false);
        } catch (e) {
            setError(e?.response?.data?.message ?? 'Erreur lors de la création');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (code) => {
        await deleteInvite(code).catch(() => {});
        setInvites(list => list.filter(i => i.code !== code));
    };

    if (!open) return null;

    const content = (
        <aside className={portal ? 'tv2-drawer-side' : 'tv2-side-panel tv2-invite-panel'}>
            <div className="tv2-side-head">
                <Link2 size={16} />
                <span className="tv2-side-title">Invitations — #{channelName}</span>
                <button className="tv2-icon-btn" onClick={onClose}><X size={14} /></button>
            </div>

            <div className="tv2-side-list">
                {/* Bouton créer */}
                <button
                    className={`tv2-invite-new-btn${showForm ? ' is-open' : ''}`}
                    onClick={() => setShowForm(v => !v)}
                >
                    <Plus size={14} />
                    Nouvelle invitation
                </button>

                {showForm && (
                    <div className="tv2-invite-form">
                        <div className="tv2-invite-form-row">
                            <label className="tv2-invite-label">
                                <Clock size={12} />
                                Expiration
                            </label>
                            <select
                                className="tv2-invite-select"
                                value={maxAge}
                                onChange={e => setMaxAge(Number(e.target.value))}
                            >
                                {MAX_AGE_OPTS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="tv2-invite-form-row">
                            <label className="tv2-invite-label">
                                <Users size={12} />
                                Utilisations max
                            </label>
                            <select
                                className="tv2-invite-select"
                                value={maxUses}
                                onChange={e => setMaxUses(Number(e.target.value))}
                            >
                                {MAX_USES_OPTS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        {error && <p className="tv2-invite-error">{error}</p>}
                        <button
                            className="tv2-invite-submit-btn"
                            onClick={handleCreate}
                            disabled={creating}
                        >
                            {creating ? 'Création…' : 'Créer le lien'}
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="tv2-empty">Chargement…</div>
                ) : invites.length === 0 && !showForm ? (
                    <div className="tv2-empty">
                        <Link2 size={28} className="tv2-empty-icon" />
                        <p>Aucune invitation active.</p>
                        <small>Créez un lien pour inviter des membres.</small>
                    </div>
                ) : invites.map(inv => {
                    const inviteUrl = `${BASE_URL}/invite/${inv.code}`;
                    const expired = inv.expiresAt && new Date(inv.expiresAt) < new Date();
                    return (
                        <article key={inv.code} className={`tv2-invite-card${expired ? ' is-expired' : ''}`}>
                            <div className="tv2-invite-card-top">
                                <code className="tv2-invite-code">{inv.code}</code>
                                <CopyButton text={inviteUrl} />
                                <button
                                    className="tv2-icon-btn-xs is-danger"
                                    onClick={() => handleDelete(inv.code)}
                                    title="Révoquer"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                            <div className="tv2-invite-meta">
                                <span className="tv2-invite-stat">
                                    <Users size={11} />
                                    {inv.uses ?? 0}{inv.maxUses > 0 ? ` / ${inv.maxUses}` : ''}
                                </span>
                                <span className={`tv2-invite-stat${expired ? ' is-danger' : ''}`}>
                                    <Clock size={11} />
                                    {formatExpiry(inv)}
                                </span>
                            </div>
                        </article>
                    );
                })}
            </div>
        </aside>
    );

    if (portal) {
        return createPortal(
            <>
                <div className="tv2-drawer-side-backdrop" onClick={onClose} />
                {content}
            </>,
            document.body
        );
    }
    return content;
}
