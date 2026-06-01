import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Copy } from 'lucide-react';
import { fetchGuildInvites, createGuildInvite, deleteInvite } from '../../../api/client';

export default function GuildInvitationsSection({ guild }) {
    const [invites,  setInvites]  = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState(null);
    const [creating, setCreating] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [maxUses,  setMaxUses]  = useState(0);
    const [maxAge,   setMaxAge]   = useState(86400);

    useEffect(() => {
        if (!guild.id) return;
        fetchGuildInvites(guild.id)
            .then(data => setInvites(Array.isArray(data) ? data : (data.invites ?? [])))
            .catch(() => setError('Erreur chargement invitations'))
            .finally(() => setLoading(false));
    }, [guild.id]);

    const formatExpiry = (inv) => {
        if (!inv.expiresAt && !inv.maxAge) return 'Jamais';
        if (inv.expiresAt) return new Date(inv.expiresAt).toLocaleDateString('fr-FR');
        return 'Jamais';
    };

    const handleCreate = async () => {
        setCreating(true); setError(null);
        try {
            const invite = await createGuildInvite(guild.id, { maxUses: Number(maxUses), maxAge: Number(maxAge) });
            setInvites(prev => [invite, ...prev]);
            setShowForm(false);
        } catch (e) {
            setError(e?.response?.data?.message ?? 'Erreur création invitation');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (code) => {
        try {
            await deleteInvite(code);
            setInvites(prev => prev.filter(i => i.code !== code));
        } catch { setError('Erreur suppression invitation'); }
    };

    const copyCode = (code) =>
        navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`).catch(() => {});

    return (
        <div className="tv2-settings-section">
            <h2 className="tv2-settings-section-title">Invitations</h2>
            {error && <p className="tv2-settings-error">{error}</p>}

            <button className="tv2-btn-primary" style={{ marginBottom: 16 }} onClick={() => setShowForm(v => !v)}>
                <Plus size={14} /> Créer un lien
            </button>

            {showForm && (
                <div className="tv2-settings-field" style={{ background: 'var(--tv2-bg-secondary)', padding: 16, borderRadius: 6, marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                            <label className="tv2-settings-label">Max utilisations (0 = illimité)</label>
                            <input
                                className="tv2-settings-input"
                                type="number"
                                min={0}
                                value={maxUses}
                                onChange={e => setMaxUses(e.target.value)}
                                style={{ width: 80 }}
                            />
                        </div>
                        <div>
                            <label className="tv2-settings-label">Expiration</label>
                            <select className="tv2-settings-input" value={maxAge} onChange={e => setMaxAge(e.target.value)}>
                                <option value={0}>Jamais</option>
                                <option value={3600}>1 heure</option>
                                <option value={86400}>24 heures</option>
                                <option value={604800}>7 jours</option>
                            </select>
                        </div>
                    </div>
                    <button className="tv2-btn-primary" style={{ marginTop: 12 }} onClick={handleCreate} disabled={creating}>
                        {creating ? 'Création…' : 'Créer'}
                    </button>
                </div>
            )}

            {loading && <p className="tv2-settings-muted">Chargement…</p>}

            {!loading && (
                <div className="tv2-members-table">
                    <div className="tv2-members-header" style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr' }}>
                        <span>Code</span><span>Créateur</span><span>Utilisations</span><span>Expiration</span><span></span>
                    </div>
                    {invites.map(inv => (
                        <div key={inv.code} className="tv2-members-row" style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <code style={{ fontSize: 13, color: 'var(--tv2-text-primary)' }}>{inv.code}</code>
                                <button className="tv2-icon-btn-xs" title="Copier" onClick={() => copyCode(inv.code)}>
                                    <Copy size={12} />
                                </button>
                            </span>
                            <span className="tv2-members-name" style={{ fontSize: 13 }}>
                                {inv.inviter?.username ?? inv.inviterId ?? '—'}
                            </span>
                            <span className="tv2-members-date">{inv.uses ?? 0}{inv.maxUses ? `/${inv.maxUses}` : ''}</span>
                            <span className="tv2-members-date">{formatExpiry(inv)}</span>
                            <span>
                                <button className="tv2-icon-btn-xs is-danger" title="Révoquer" onClick={() => handleDelete(inv.code)}>
                                    <Trash2 size={12} />
                                </button>
                            </span>
                        </div>
                    ))}
                    {!invites.length && (
                        <p className="tv2-settings-muted" style={{ padding: '12px 16px' }}>Aucune invitation active.</p>
                    )}
                </div>
            )}
        </div>
    );
}
