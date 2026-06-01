import React, { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';
import { createThreadFromMessage, createPrivateThread } from '../../api/client';

const DURATIONS = [
    { value: 60,    label: '1 h' },
    { value: 1440,  label: '24 h' },
    { value: 4320,  label: '3 j' },
    { value: 10080, label: '7 j' },
];

export default function CreateThreadModal({ open, onClose, guildId, channelId, messageId = null, seedName = 'Discussion' }) {
    const [name, setName]   = useState(seedName);
    const [dur, setDur]     = useState(1440);
    const [err, setErr]     = useState('');
    const [pending, setPend]= useState(false);

    useEffect(() => { setName(seedName); }, [seedName, open]);

    const submit = async () => {
        const n = name.trim();
        if (!n) return;
        setErr(''); setPend(true);
        try {
            if (messageId) {
                await createThreadFromMessage(guildId, channelId, messageId, { name: n, autoArchiveDuration: dur });
            } else {
                await createPrivateThread(guildId, channelId, { name: n, autoArchiveDuration: dur });
            }
            onClose?.();
        } catch (e) {
            setErr(e?.response?.data?.message ?? 'Création impossible');
        } finally { setPend(false); }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={messageId ? 'Démarrer un fil' : 'Nouveau thread privé'}
            footer={
                <>
                    <button className="tv2-btn-ghost" onClick={onClose}>Annuler</button>
                    <button className="tv2-btn-solid" onClick={submit} disabled={pending || !name.trim()}>
                        {pending ? '…' : 'Créer'}
                    </button>
                </>
            }
        >
            <div className="tv2-form">
                <label className="tv2-label">
                    <span>Nom du fil</span>
                    <input
                        className="tv2-input"
                        value={name}
                        onChange={(e) => setName(e.target.value.slice(0, 100))}
                        autoFocus
                    />
                </label>
                <label className="tv2-label">
                    <span>Archivage automatique</span>
                    <div className="tv2-pill-row">
                        {DURATIONS.map(d => (
                            <button
                                key={d.value}
                                type="button"
                                className={`tv2-pill ${dur === d.value ? 'is-active' : ''}`}
                                onClick={() => setDur(d.value)}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>
                </label>
                {err && <div className="tv2-alert-err">{err}</div>}
            </div>
        </Modal>
    );
}
