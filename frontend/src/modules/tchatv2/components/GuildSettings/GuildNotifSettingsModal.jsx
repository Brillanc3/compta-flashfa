import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getGuildNotifSettings, setGuildNotifSettings } from '../../api/client';

const LEVELS = [
    { value: 0, label: 'Par défaut (tous les messages)' },
    { value: 1, label: 'Tous les messages' },
    { value: 2, label: 'Mentions uniquement' },
    { value: 3, label: 'Rien' },
];

const MUTE_OPTIONS = [
    { label: 'Pas de mute',  value: null },
    { label: '15 minutes',   value: 15 },
    { label: '1 heure',      value: 60 },
    { label: '3 heures',     value: 180 },
    { label: '8 heures',     value: 480 },
    { label: '24 heures',    value: 1440 },
    { label: 'Indéfiniment', value: -1 },
];

export default function GuildNotifSettingsModal({ open, onClose, guild }) {
    const [level,      setLevel]      = useState(0);
    const [muteMin,    setMuteMin]    = useState(null);
    const [mutedUntil, setMutedUntil] = useState(null);
    const [saving,     setSaving]     = useState(false);
    const [error,      setError]      = useState(null);

    useEffect(() => {
        if (!open || !guild?.id) return;
        getGuildNotifSettings(guild.id)
            .then(s => {
                setLevel(s.level ?? 0);
                setMutedUntil(s.mutedUntil ?? null);
            })
            .catch(() => {});
    }, [open, guild?.id]);

    const handleSave = async () => {
        setSaving(true); setError(null);
        const body = { level };
        if (muteMin === null)        body.unmute    = true;
        else if (muteMin === -1)     body.mutedUntil = new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000).toISOString();
        else                         body.mutedUntil = new Date(Date.now() + muteMin * 60_000).toISOString();
        try {
            await setGuildNotifSettings(guild.id, body);
            onClose();
        } catch (e) {
            setError(e?.response?.data?.message ?? 'Erreur sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="tv2-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="tv2-modal" style={{ width: 420 }}>
                <div className="tv2-modal-header">
                    <h3>Notifications — {guild?.name}</h3>
                    <button className="tv2-icon-btn" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="tv2-modal-body">
                    <div className="tv2-settings-field">
                        <label className="tv2-settings-label">Niveau de notification</label>
                        {LEVELS.map(l => (
                            <label key={l.value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="notif-level"
                                    value={l.value}
                                    checked={level === l.value}
                                    onChange={() => setLevel(l.value)}
                                />
                                <span style={{ color: 'var(--tv2-text-primary)', fontSize: 14 }}>{l.label}</span>
                            </label>
                        ))}
                    </div>
                    <div className="tv2-settings-field">
                        <label className="tv2-settings-label">Mute ce serveur</label>
                        {mutedUntil && (
                            <p style={{ color: '#ed4245', fontSize: 13, marginBottom: 8 }}>
                                Actuellement muté jusqu'au {new Date(mutedUntil).toLocaleString('fr-FR')}
                            </p>
                        )}
                        <select
                            className="tv2-settings-input"
                            value={muteMin ?? ''}
                            onChange={e => setMuteMin(e.target.value === '' ? null : Number(e.target.value))}
                        >
                            {MUTE_OPTIONS.map(o => (
                                <option key={o.label} value={o.value ?? ''}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                    {error && <p className="tv2-settings-error">{error}</p>}
                </div>
                <div className="tv2-modal-footer">
                    <button className="tv2-btn-secondary" onClick={onClose}>Annuler</button>
                    <button className="tv2-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                </div>
            </div>
        </div>
    );
}
