import React, { useState } from 'react';
import { Hash, Megaphone, MessagesSquare, Lock } from 'lucide-react';
import Modal from '../Modal/Modal';
import { createChannel } from '../../api/client';
import { useChannelStore } from '../../stores/channelStore';

const TYPES = [
    { id: 0,  key: 'GUILD_TEXT',         label: 'Texte',     icon: Hash,           desc: 'Discussion classique.' },
    { id: 5,  key: 'GUILD_ANNOUNCEMENT', label: 'Annonces',  icon: Megaphone,      desc: 'Lecture seule sauf modos.' },
    { id: 15, key: 'GUILD_FORUM',        label: 'Forum',     icon: MessagesSquare, desc: 'Threads structurés.' },
];

export default function CreateChannelModal({ open, onClose, guildId, parentId = null, parentName = null }) {
    const [name, setName]   = useState('');
    const [type, setType]   = useState(0);
    const [priv, setPriv]   = useState(false);
    const [err,  setErr]    = useState('');
    const [pending, setPend]= useState(false);
    const upsert = useChannelStore(s => s.upsertChannel);

    const submit = async () => {
        const n = name.trim().toLowerCase().replace(/\s+/g, '-');
        if (!n) return;
        setErr(''); setPend(true);
        try {
            const ch = await createChannel(guildId, {
                name: n,
                type,
                ...(parentId ? { parentId: String(parentId) } : {}),
                ...(priv ? { nsfw: false } : {}),
            });
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
            title={parentName ? `Salon dans ${parentName}` : 'Nouveau salon'}
            width={520}
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
                <div className="tv2-label-block">
                    <span className="tv2-label-title">Type de salon</span>
                    <div className="tv2-type-grid">
                        {TYPES.map(t => {
                            const Icon = t.icon;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    className={`tv2-type-card ${type === t.id ? 'is-active' : ''}`}
                                    onClick={() => setType(t.id)}
                                >
                                    <Icon size={18} />
                                    <span className="tv2-type-label">{t.label}</span>
                                    <span className="tv2-type-desc">{t.desc}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <label className="tv2-label">
                    <span>Nom du salon</span>
                    <div className="tv2-input-prefix">
                        <span className="tv2-input-prefix-icon">{priv ? <Lock size={14} /> : '#'}</span>
                        <input
                            className="tv2-input"
                            value={name}
                            onChange={(e) => setName(e.target.value.slice(0, 100))}
                            placeholder="nouveau-salon"
                            autoFocus
                        />
                    </div>
                </label>

                <label className="tv2-check">
                    <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} />
                    <span>
                        <strong>Salon privé</strong>
                        <em>Seuls les membres et rôles autorisés pourront voir ce salon.</em>
                    </span>
                </label>

                {err && <div className="tv2-alert-err">{err}</div>}
            </div>
        </Modal>
    );
}
