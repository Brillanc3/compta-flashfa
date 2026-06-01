import React, { useState, useRef } from 'react';
import { useGuildStore } from '../../../stores/guildStore';
import { updateGuild, uploadGuildIcon, uploadGuildBanner } from '../../../api/client';

const CDN = 'https://cdn.jipeg-corporation.eu';
const iconUrl   = (guildId, hash)   => hash   ? `${CDN}/v2/guilds/${guildId}/icons/${hash}`   : null;
const bannerUrl = (guildId, hash)   => hash   ? `${CDN}/v2/guilds/${guildId}/banners/${hash}` : null;

export default function GuildProfileSection({ guild }) {
    const upsertGuild    = useGuildStore(s => s.upsertGuild);
    const [name, setName]        = useState(guild.name ?? '');
    const [description, setDesc] = useState(guild.description ?? '');
    const [saving, setSaving]    = useState(false);
    const [error, setError]      = useState(null);
    const [success, setSuccess]  = useState(false);
    const iconInputRef   = useRef(null);
    const bannerInputRef = useRef(null);

    const handleSave = async () => {
        if (!name.trim() || name.length < 2) { setError('Nom trop court (min 2 caractères)'); return; }
        setSaving(true); setError(null); setSuccess(false);
        try {
            const updated = await updateGuild(guild.id, { name: name.trim(), description: description || null });
            upsertGuild({ ...guild, ...updated });
            setSuccess(true);
        } catch (e) {
            setError(e?.response?.data?.message ?? 'Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const handleIconUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        try {
            const { iconHash } = await uploadGuildIcon(guild.id, fd);
            upsertGuild({ ...guild, iconHash });
        } catch (e) {
            setError(e?.response?.data?.message ?? 'Erreur upload icône');
        }
    };

    const handleBannerUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        try {
            const { bannerHash } = await uploadGuildBanner(guild.id, fd);
            upsertGuild({ ...guild, bannerHash });
        } catch (e) {
            setError(e?.response?.data?.message ?? 'Erreur upload bannière');
        }
    };

    return (
        <div className="tv2-settings-section">
            <h2 className="tv2-settings-section-title">Profil du serveur</h2>

            <div className="tv2-settings-field">
                <label className="tv2-settings-label">Icône du serveur</label>
                <div className="tv2-settings-icon-row">
                    {guild.iconHash
                        ? <img className="tv2-settings-guild-icon" src={iconUrl(guild.id, guild.iconHash)} alt="" />
                        : <div className="tv2-settings-guild-icon-placeholder">{guild.name?.charAt(0)}</div>
                    }
                    <button className="tv2-btn-secondary" onClick={() => iconInputRef.current?.click()}>
                        Changer l'icône
                    </button>
                    <input ref={iconInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleIconUpload} />
                </div>
            </div>

            <div className="tv2-settings-field">
                <label className="tv2-settings-label">Bannière</label>
                {guild.bannerHash && (
                    <img className="tv2-settings-banner-preview" src={bannerUrl(guild.id, guild.bannerHash)} alt="" />
                )}
                <button className="tv2-btn-secondary" onClick={() => bannerInputRef.current?.click()}>
                    {guild.bannerHash ? 'Changer la bannière' : 'Ajouter une bannière'}
                </button>
                <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerUpload} />
            </div>

            <div className="tv2-settings-field">
                <label className="tv2-settings-label">Nom du serveur</label>
                <input
                    className="tv2-settings-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={100}
                />
            </div>

            <div className="tv2-settings-field">
                <label className="tv2-settings-label">Description</label>
                <textarea
                    className="tv2-settings-input tv2-settings-textarea"
                    value={description}
                    onChange={e => setDesc(e.target.value)}
                    maxLength={120}
                    rows={3}
                />
            </div>

            {error   && <p className="tv2-settings-error">{error}</p>}
            {success && <p className="tv2-settings-success">Modifications enregistrées</p>}

            <button className="tv2-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
        </div>
    );
}
