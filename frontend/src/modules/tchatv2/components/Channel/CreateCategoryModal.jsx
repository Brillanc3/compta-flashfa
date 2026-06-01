import React, { useState } from 'react';
import Modal from '../Modal/Modal';
import { createChannel } from '../../api/client';
import { useChannelStore } from '../../stores/channelStore';

const CHANNEL_TYPE_CATEGORY = 4;

export default function CreateCategoryModal({ open, onClose, guildId }) {
    const [name, setName]     = useState('');
    const [err, setErr]       = useState('');
    const [pending, setPend]  = useState(false);
    const upsert = useChannelStore(s => s.upsertChannel);

    const submit = async (e) => {
        e?.preventDefault?.();
        const n = name.trim();
        if (!n) return;
        setErr(''); setPend(true);
        try {
            const ch = await createChannel(guildId, { name: n, type: CHANNEL_TYPE_CATEGORY });
            upsert(guildId, ch);
            setName('');
            onClose?.();
        } catch (e2) {
            setErr(e2?.response?.data?.message ?? 'Création impossible');
        } finally { setPend(false); }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Nouvelle catégorie"
            footer={
                <>
                    <button type="button" className="tv2-btn-ghost" onClick={onClose}>Annuler</button>
                    <button type="button" className="tv2-btn-solid" onClick={submit} disabled={pending || !name.trim()}>
                        {pending ? '…' : 'Créer'}
                    </button>
                </>
            }
        >
            <form onSubmit={submit} className="tv2-form">
                <label className="tv2-label">
                    <span>Nom de la catégorie</span>
                    <input
                        autoFocus
                        className="tv2-input"
                        value={name}
                        onChange={(e) => setName(e.target.value.slice(0, 100))}
                        placeholder="général, projet-x, équipe…"
                    />
                </label>
                {err && <div className="tv2-alert-err">{err}</div>}
            </form>
        </Modal>
    );
}
