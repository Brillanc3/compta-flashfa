import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuildStore } from '../stores/guildStore';
import { useCompany } from '@/contexts/CompanyContext';
import { useHasPermission } from '@/hooks/useHasPermission';
import apiClient from '@/services/api';
import { joinInvite } from '../api/client';

function HamburgerIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6"  x2="21" y2="6"  />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
    );
}

export default function TchatV2Home({ onGuildCreated, isMobile, onOpenCompanies }) {
    const guilds            = useGuildStore(s => s.guilds);
    const upsertGuild       = useGuildStore(s => s.upsertGuild);
    const { activeCompany, activeCompanyId } = useCompany();
    const isManager         = useHasPermission(`COMPANY.${activeCompanyId}.*`);
    const navigate          = useNavigate();
    const [creating, setCreating] = useState(false);
    const [error, setError]       = useState(null);
    const [inviteCode, setInviteCode] = useState('');
    const [joining, setJoining]       = useState(false);
    const [joinErr, setJoinErr]       = useState(null);

    const companyGuildExists = guilds.some(
        g => g.companyId != null && g.companyId === activeCompanyId
    );

    const doCreate = async () => {
        if (creating || !activeCompany) return;
        setCreating(true);
        setError(null);
        try {
            const { data } = await apiClient.post(
                '/tchatv2/guilds',
                { name: activeCompany.name, companyId: activeCompanyId },
                { headers: { 'x-company-id': String(activeCompanyId) } }
            );
            upsertGuild(data);
            onGuildCreated?.(data);
            navigate(`/dashboard/tchatv2/guilds/${data.id}`);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Erreur lors de la création');
        } finally {
            setCreating(false);
        }
    };

    const doJoin = async () => {
        const code = inviteCode.trim();
        if (!code || joining) return;
        setJoining(true);
        setJoinErr(null);
        try {
            const guild = await joinInvite(code);
            upsertGuild(guild);
            navigate(`/dashboard/tchatv2/guilds/${guild.id}`);
        } catch (err) {
            setJoinErr(err?.response?.data?.message || 'Code invalide ou expiré');
        } finally {
            setJoining(false);
        }
    };

    return (
        <div className="tv2-main">
            {isMobile && (
                <div className="tv2-header">
                    <button className="tv2-icon-btn tv2-hamburger" onClick={onOpenCompanies} aria-label="Ouvrir le menu">
                        <HamburgerIcon />
                    </button>
                    <span className="tv2-header-title">Tchat V2</span>
                </div>
            )}

            <div className="tv2-home">
                <div>
                    <h1>Tchat V2</h1>
                    <p className="tv2-home-sub">Vos espaces de communication</p>
                </div>

                {guilds.length > 0 && (
                    <section>
                        <h2 className="tv2-home-section-title">Vos guilds ({guilds.length})</h2>
                        <div className="tv2-guild-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            {guilds.map(guild => {
                                const initial = (guild.name || '?').charAt(0).toUpperCase();
                                return (
                                    <button
                                        key={guild.id}
                                        className="tv2-guild-card"
                                        onClick={() => navigate(`/dashboard/tchatv2/guilds/${guild.id}`)}
                                    >
                                        <div className="tv2-guild-card-icon">
                                            {guild.iconHash
                                                ? <img src={`https://cdn.jipeg-corporation.eu/v2/guilds/${guild.id}/icons/${guild.iconHash}`} alt="" />
                                                : initial}
                                        </div>
                                        <div>
                                            <div className="tv2-guild-card-name">{guild.name}</div>
                                            <div className="tv2-guild-card-open">Ouvrir</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}

                {isManager && !companyGuildExists && activeCompany && (
                    <section>
                        <h2 className="tv2-home-section-title">Créer un espace</h2>
                        {error && <div className="tv2-alert-err">{error}</div>}
                        <button
                            className="tv2-btn-primary"
                            onClick={doCreate}
                            disabled={creating}
                            style={{ maxWidth: 360 }}
                        >
                            {creating ? 'Création…' : `+ Créer "${activeCompany.name}"`}
                        </button>
                    </section>
                )}

                {isManager && (
                    <section>
                        <h2 className="tv2-home-section-title">Rejoindre par code d'invitation</h2>
                        {joinErr && <div className="tv2-alert-err">{joinErr}</div>}
                        <div style={{ display: 'flex', gap: 8, maxWidth: 360 }}>
                            <input
                                className="tv2-input"
                                value={inviteCode}
                                onChange={e => setInviteCode(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') doJoin(); }}
                                placeholder="Code d'invitation…"
                                style={{ flex: 1 }}
                            />
                            <button
                                className="tv2-btn-solid"
                                onClick={doJoin}
                                disabled={joining || !inviteCode.trim()}
                            >
                                {joining ? '…' : 'Rejoindre'}
                            </button>
                        </div>
                    </section>
                )}

                {guilds.length === 0 && !isManager && (
                    <div style={{ color: 'rgb(var(--chat-text-muted))', fontSize: 13 }}>
                        Aucune guild trouvée. Demandez un lien d'invitation à votre manager.
                    </div>
                )}
            </div>
        </div>
    );
}
