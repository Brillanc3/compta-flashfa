import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Webhook, Plus, Trash2, X, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { fetchChannelWebhooks, createChannelWebhook, deleteChannelWebhook } from '../../api/client';

function CopyButton({ text, label }) {
    const [copied, setCopied] = useState(false);
    const handle = () => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button className="tv2-invite-copy-btn" onClick={handle} title={`Copier ${label ?? ''}`}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
    );
}

export default function WebhookDrawer({ open, onClose, guildId, channelId, channelName, portal = false }) {
    const [webhooks, setWebhooks] = useState([]);
    const [loading, setLoading]   = useState(false);
    const [creating, setCreating] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [name, setName]         = useState('');
    const [error, setError]       = useState(null);
    const [revealed, setRevealed] = useState({});

    useEffect(() => {
        if (!open || !channelId) return;
        setLoading(true);
        setError(null);
        fetchChannelWebhooks(guildId, channelId)
            .then(data => setWebhooks(Array.isArray(data) ? data : []))
            .catch(() => setWebhooks([]))
            .finally(() => setLoading(false));
    }, [open, channelId, guildId]);

    const handleCreate = async () => {
        if (!name.trim()) { setError('Le nom est requis'); return; }
        setCreating(true);
        setError(null);
        try {
            const wh = await createChannelWebhook(guildId, channelId, { name: name.trim() });
            setWebhooks(list => [wh, ...list]);
            setShowForm(false);
            setName('');
        } catch (e) {
            setError(e?.response?.data?.message ?? 'Erreur lors de la création');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (webhookId) => {
        await deleteChannelWebhook(guildId, webhookId).catch(() => {});
        setWebhooks(list => list.filter(w => String(w.id) !== String(webhookId)));
    };

    const toggleReveal = (id) =>
        setRevealed(prev => ({ ...prev, [id]: !prev[id] }));

    const webhookUrl = (wh) =>
        `${window.location.origin}/tchatv2/webhooks/${wh.id}/${wh.token}`;

    const maskedToken = (token) =>
        token ? token.slice(0, 8) + '•'.repeat(Math.max(0, token.length - 8)) : '';

    if (!open) return null;

    const content = (
        <aside className={portal ? 'tv2-drawer-side' : 'tv2-side-panel tv2-webhook-panel'}>
            <div className="tv2-side-head">
                <Webhook size={16} />
                <span className="tv2-side-title">Webhooks — #{channelName}</span>
                <button className="tv2-icon-btn" onClick={onClose}><X size={14} /></button>
            </div>

            <div className="tv2-side-list">
                <button
                    className={`tv2-invite-new-btn${showForm ? ' is-open' : ''}`}
                    onClick={() => setShowForm(v => !v)}
                >
                    <Plus size={14} />
                    Nouveau webhook
                </button>

                {showForm && (
                    <div className="tv2-invite-form">
                        <div className="tv2-invite-form-row">
                            <label className="tv2-invite-label">Nom du webhook</label>
                            <input
                                className="tv2-invite-input"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="ex: Alertes CI/CD"
                                maxLength={80}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            />
                        </div>
                        {error && <p className="tv2-invite-error">{error}</p>}
                        <button
                            className="tv2-invite-submit-btn"
                            onClick={handleCreate}
                            disabled={creating}
                        >
                            {creating ? 'Création…' : 'Créer le webhook'}
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="tv2-empty">Chargement…</div>
                ) : webhooks.length === 0 && !showForm ? (
                    <div className="tv2-empty">
                        <Webhook size={28} className="tv2-empty-icon" />
                        <p>Aucun webhook configuré.</p>
                        <small>Les webhooks permettent à des services externes de poster des messages.</small>
                    </div>
                ) : webhooks.map(wh => {
                    const isRevealed = revealed[wh.id];
                    const url = webhookUrl(wh);
                    return (
                        <article key={wh.id} className="tv2-invite-card">
                            <div className="tv2-invite-card-top">
                                <span className="tv2-webhook-name">{wh.name}</span>
                                <CopyButton text={url} label="l'URL" />
                                <button
                                    className="tv2-icon-btn-xs"
                                    onClick={() => toggleReveal(wh.id)}
                                    title={isRevealed ? 'Masquer' : 'Révéler le token'}
                                >
                                    {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                                </button>
                                <button
                                    className="tv2-icon-btn-xs is-danger"
                                    onClick={() => handleDelete(wh.id)}
                                    title="Supprimer"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                            <div className="tv2-webhook-url-row">
                                <code className="tv2-webhook-url">
                                    {isRevealed ? url : `…/webhooks/${wh.id}/${maskedToken(wh.token)}`}
                                </code>
                            </div>
                            <div className="tv2-invite-meta">
                                <span className="tv2-invite-stat">ID: {String(wh.id).slice(-6)}</span>
                                {wh.createdAt && (
                                    <span className="tv2-invite-stat">
                                        {new Date(wh.createdAt).toLocaleDateString('fr-FR')}
                                    </span>
                                )}
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
