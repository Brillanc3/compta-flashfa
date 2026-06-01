import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { fetchGuildEmojis, createGuildEmoji, deleteGuildEmoji } from '../../../api/client';
import { useGuildEmojiStore } from '../../../stores/guildEmojiStore';

const MAX_EMOJIS = 15;

export default function GuildEmojisSection({ guild }) {
    const [emojis,    setEmojis]    = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState(null);
    const [name,      setName]      = useState('');
    const [uploading, setUploading] = useState(false);
    const fileRef    = useRef(null);
    const pendingFile = useRef(null);
    const storeAdd    = useGuildEmojiStore(s => s.add);
    const storeRemove = useGuildEmojiStore(s => s.remove);

    useEffect(() => {
        fetchGuildEmojis(guild.id)
            .then(data => setEmojis(data.emojis ?? []))
            .catch(() => setError('Erreur chargement emojis'))
            .finally(() => setLoading(false));
    }, [guild.id]);

    const handleFileSelect = (e) => {
        pendingFile.current = e.target.files?.[0] ?? null;
        if (pendingFile.current && !name) {
            setName(pendingFile.current.name.replace(/\.[^.]+$/, '').slice(0, 32));
        }
    };

    const handleUpload = async () => {
        if (!pendingFile.current || !name.trim()) { setError('Fichier et nom requis'); return; }
        if (emojis.length >= MAX_EMOJIS) { setError(`Maximum ${MAX_EMOJIS} emojis atteint`); return; }
        setUploading(true); setError(null);
        const fd = new FormData();
        fd.append('file', pendingFile.current);
        fd.append('name', name.trim());
        try {
            const emoji = await createGuildEmoji(guild.id, fd);
            setEmojis(prev => [...prev, emoji]);
            storeAdd(guild.id, emoji);
            setName('');
            pendingFile.current = null;
            if (fileRef.current) fileRef.current.value = '';
        } catch (e) {
            setError(e?.response?.data?.message ?? 'Erreur upload emoji');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (emojiId) => {
        try {
            await deleteGuildEmoji(guild.id, emojiId);
            setEmojis(prev => prev.filter(e => e.id !== String(emojiId)));
            storeRemove(guild.id, emojiId);
        } catch {
            setError('Erreur suppression emoji');
        }
    };

    return (
        <div className="tv2-settings-section">
            <h2 className="tv2-settings-section-title">
                Emojis <span className="tv2-settings-badge">{emojis.length}/{MAX_EMOJIS}</span>
            </h2>

            {loading && <p className="tv2-settings-muted">Chargement…</p>}

            {!loading && (
                <div className="tv2-emoji-grid">
                    {emojis.map(e => (
                        <div key={e.id} className="tv2-emoji-item">
                            <img src={e.url} alt={e.name} className="tv2-emoji-img" />
                            <span className="tv2-emoji-name">:{e.name}:</span>
                            <button
                                className="tv2-icon-btn-xs is-danger"
                                title="Supprimer"
                                onClick={() => handleDelete(e.id)}
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {!loading && emojis.length < MAX_EMOJIS && (
                <div className="tv2-settings-field" style={{ marginTop: 24 }}>
                    <label className="tv2-settings-label">Importer un emoji</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/png,image/jpeg,image/gif,image/webp"
                            onChange={handleFileSelect}
                        />
                        <input
                            className="tv2-settings-input"
                            style={{ width: 160 }}
                            placeholder="Nom de l'emoji"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            maxLength={64}
                        />
                        <button className="tv2-btn-primary" onClick={handleUpload} disabled={uploading}>
                            <Upload size={14} /> {uploading ? 'Import…' : 'Importer'}
                        </button>
                    </div>
                </div>
            )}

            {error && <p className="tv2-settings-error" style={{ marginTop: 8 }}>{error}</p>}
        </div>
    );
}
