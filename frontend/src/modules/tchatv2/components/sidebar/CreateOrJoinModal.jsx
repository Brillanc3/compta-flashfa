import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useGuildStore } from '../../stores/guildStore';
import { useCompany } from '@/contexts/CompanyContext';
import { useHasPermission } from '@/hooks/useHasPermission';
import { joinInvite } from '../../api/client';
import apiClient from '@/services/api';

export default function CreateOrJoinModal({ onClose }) {
    const navigate               = useNavigate();
    const guilds                 = useGuildStore(s => s.guilds);
    const upsertGuild            = useGuildStore(s => s.upsertGuild);
    const { activeCompany, activeCompanyId } = useCompany();
    const isManager              = useHasPermission(`COMPANY.${activeCompanyId}.*`);

    const companyGuildExists = guilds.some(
        g => g.companyId != null && g.companyId === activeCompanyId
    );

    const [creating, setCreating]   = useState(false);
    const [createErr, setCreateErr] = useState(null);

    const [inviteCode, setInviteCode] = useState('');
    const [joining, setJoining]       = useState(false);
    const [joinErr, setJoinErr]       = useState(null);

    const overlayRef = useRef(null);

    const handleOverlayClick = (e) => {
        if (e.target === overlayRef.current) onClose();
    };

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const doCreate = async () => {
        if (creating || !activeCompany) return;
        setCreating(true);
        setCreateErr(null);
        try {
            const { data } = await apiClient.post(
                '/tchatv2/guilds',
                { name: activeCompany.name, companyId: activeCompanyId },
                { headers: { 'x-company-id': String(activeCompanyId) } }
            );
            upsertGuild(data);
            onClose();
            navigate(`/dashboard/tchatv2/guilds/${data.id}`);
        } catch (err) {
            setCreateErr(err?.response?.data?.message || 'Erreur lors de la création');
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
            onClose();
            navigate(`/dashboard/tchatv2/guilds/${guild.id}`);
        } catch (err) {
            setJoinErr(err?.response?.data?.message || 'Code invalide ou expiré');
        } finally {
            setJoining(false);
        }
    };

    return createPortal(
        <div
            ref={overlayRef}
            className="tv2-modal-overlay tv2-create-join-overlay"
            onClick={handleOverlayClick}
            role="dialog"
            aria-modal="true"
            aria-label="Créer ou rejoindre un espace"
        >
            <div className="tv2-modal-card" onClick={e => e.stopPropagation()}>
                <div className="tv2-modal-header">
                    <span className="tv2-modal-title">Espaces de communication</span>
                    <button className="tv2-modal-close" onClick={onClose} aria-label="Fermer">
                        <X size={16} />
                    </button>
                </div>

                {isManager && !companyGuildExists && activeCompany && (
                    <section className="tv2-modal-section">
                        <h3 className="tv2-modal-section-title">Créer un espace</h3>
                        <p className="tv2-modal-section-desc">
                            Crée l'espace de communication pour <strong>{activeCompany.name}</strong>.
                            Tous les employés actifs y seront ajoutés automatiquement.
                        </p>
                        {createErr && <div className="tv2-alert-err">{createErr}</div>}
                        <button
                            className="tv2-btn-primary"
                            onClick={doCreate}
                            disabled={creating}
                        >
                            {creating ? 'Création…' : `+ Créer "${activeCompany.name}"`}
                        </button>
                    </section>
                )}

                <section className="tv2-modal-section">
                    <h3 className="tv2-modal-section-title">Rejoindre par code d'invitation</h3>
                    <p className="tv2-modal-section-desc">
                        Entrez un code d'invitation pour rejoindre un espace existant.
                    </p>
                    {joinErr && <div className="tv2-alert-err">{joinErr}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            className="tv2-input"
                            value={inviteCode}
                            onChange={e => setInviteCode(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') doJoin(); }}
                            placeholder="Code d'invitation…"
                            autoFocus
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
            </div>
        </div>,
        document.body
    );
}
