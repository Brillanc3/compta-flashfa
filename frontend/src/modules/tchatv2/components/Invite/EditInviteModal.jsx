import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { createChannelInvite } from '../../api/client';

const MAX_AGE_OPTS = [
    { label: '30 minutes', value: 1800 },
    { label: '1 heure',    value: 3600 },
    { label: '6 heures',   value: 21600 },
    { label: '12 heures',  value: 43200 },
    { label: '1 jour',     value: 86400 },
    { label: '7 jours',    value: 604800 },
    { label: '30 jours',   value: 2592000 },
    { label: 'Jamais',     value: 0 },
];

const MAX_USES_OPTS = [
    { label: 'Illimité',   value: 0 },
    { label: '1 usage',    value: 1 },
    { label: '5 usages',   value: 5 },
    { label: '10 usages',  value: 10 },
    { label: '25 usages',  value: 25 },
    { label: '50 usages',  value: 50 },
    { label: '100 usages', value: 100 },
];

export default function EditInviteModal({ open, onClose, guildId, channelId, currentInvite, onReplaced }) {
    const [maxAge,  setMaxAge]  = useState(currentInvite?.maxAge  ?? 2592000);
    const [maxUses, setMaxUses] = useState(currentInvite?.maxUses ?? 0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    if (!open) return null;

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const inv = await createChannelInvite(guildId, channelId, { maxAge, maxUses });
            onReplaced(inv);
            onClose();
        } catch (e) {
            setError(e?.response?.data?.message ?? 'Erreur lors de la création');
        } finally {
            setSubmitting(false);
        }
    };

    return createPortal(
        <div className="tv2-modal-overlay tv2-edit-invite-overlay" onClick={onClose}>
            <div className="tv2-edit-invite-modal" onClick={e => e.stopPropagation()}>
                <div className="tv2-modal-head">
                    <h3>Modifier le lien d'invitation</h3>
                    <button className="tv2-icon-btn" onClick={onClose}><X size={14} /></button>
                </div>
                <div className="tv2-modal-body">
                    <label className="tv2-form-label">Expire après</label>
                    <select
                        className="tv2-select"
                        value={maxAge}
                        onChange={e => setMaxAge(Number(e.target.value))}
                    >
                        {MAX_AGE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>

                    <label className="tv2-form-label">Nombre max d'utilisations</label>
                    <select
                        className="tv2-select"
                        value={maxUses}
                        onChange={e => setMaxUses(Number(e.target.value))}
                    >
                        {MAX_USES_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>

                    {error && <div className="tv2-form-error">{error}</div>}
                </div>
                <div className="tv2-modal-foot">
                    <button className="tv2-btn-secondary" onClick={onClose} disabled={submitting}>Annuler</button>
                    <button className="tv2-btn-primary" onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Génération…' : 'Générer un nouveau lien'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
