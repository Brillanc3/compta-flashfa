import React, { useState } from 'react';
import { useMemberStore } from '../../../stores/memberStore';
import { useRoleStore }   from '../../../stores/roleStore';
import { kickMember, createGuildBan, timeoutMember } from '../../../api/client';
import { UserMinus, Shield, Clock } from 'lucide-react';

export default function GuildMembersSection({ guild, myUserId }) {
    const members = useMemberStore(s => s.byGuild[String(guild.id)] ?? []);
    const roles   = useRoleStore(s => s.byGuild?.[String(guild.id)] ?? []);
    const [error, setError] = useState(null);

    const getRoleNames = (roleIds = []) => {
        if (!roles.length) return [];
        return roleIds
            .map(id => roles.find(r => String(r.id) === String(id))?.name)
            .filter(Boolean);
    };

    const displayName = (m) => m.nickname || m.user?.name || m.user?.username || `User #${m.userId}`;

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

    const handleKick = async (userId) => {
        if (!window.confirm('Expulser ce membre ?')) return;
        try {
            await kickMember(guild.id, userId);
        } catch (e) { setError(e?.response?.data?.message ?? 'Erreur kick'); }
    };

    const handleBan = async (userId) => {
        if (!window.confirm('Bannir ce membre ?')) return;
        try {
            await createGuildBan(guild.id, userId, { reason: '' });
        } catch (e) { setError(e?.response?.data?.message ?? 'Erreur ban'); }
    };

    const handleMute = async (userId) => {
        const minutes = window.prompt('Mute pour combien de minutes ?', '10');
        if (!minutes || isNaN(Number(minutes))) return;
        const until = new Date(Date.now() + Number(minutes) * 60_000).toISOString();
        try {
            await timeoutMember(guild.id, userId, until);
        } catch (e) { setError(e?.response?.data?.message ?? 'Erreur mute'); }
    };

    return (
        <div className="tv2-settings-section">
            <h2 className="tv2-settings-section-title">
                Membres <span className="tv2-settings-badge">{members.length}</span>
            </h2>
            {error && <p className="tv2-settings-error">{error}</p>}
            <div className="tv2-members-table">
                <div className="tv2-members-header">
                    <span>Membre</span><span>Depuis</span><span>Rôles</span><span>Actions</span>
                </div>
                {members.map(m => (
                    <div key={m.userId} className="tv2-members-row">
                        <span className="tv2-members-name">{displayName(m)}</span>
                        <span className="tv2-members-date">{formatDate(m.joinedAt)}</span>
                        <span className="tv2-members-roles">
                            {getRoleNames(m.roleIds ?? []).slice(0, 3).map(r => (
                                <span key={r} className="tv2-role-chip">{r}</span>
                            ))}
                        </span>
                        {String(m.userId) !== String(myUserId) && (
                            <span className="tv2-members-actions">
                                <button className="tv2-icon-btn-xs" title="Expulser" onClick={() => handleKick(m.userId)}>
                                    <UserMinus size={12} />
                                </button>
                                <button className="tv2-icon-btn-xs is-danger" title="Bannir" onClick={() => handleBan(m.userId)}>
                                    <Shield size={12} />
                                </button>
                                <button className="tv2-icon-btn-xs" title="Mute" onClick={() => handleMute(m.userId)}>
                                    <Clock size={12} />
                                </button>
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
