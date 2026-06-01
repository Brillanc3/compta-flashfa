import React, { useState, useEffect } from 'react';
import { X, User, Smile, Users, Shield, Link, FileText } from 'lucide-react';
import GuildProfileSection    from './sections/GuildProfileSection';
import GuildEmojisSection     from './sections/GuildEmojisSection';
import GuildMembersSection    from './sections/GuildMembersSection';
import GuildRolesSection      from './sections/GuildRolesSection';
import GuildInvitationsSection from './sections/GuildInvitationsSection';
import GuildLogsSection       from './sections/GuildLogsSection';

const NAV_ITEMS = [
    { key: 'profile',     label: 'Profil du serveur', icon: User },
    { key: 'emojis',      label: 'Emojis',            icon: Smile },
    { key: 'members',     label: 'Membres',           icon: Users },
    { key: 'roles',       label: 'Rôles',             icon: Shield },
    { key: 'invitations', label: 'Invitations',       icon: Link },
    { key: 'logs',        label: 'Logs du serveur',   icon: FileText },
];

const SECTION_MAP = {
    profile:     GuildProfileSection,
    emojis:      GuildEmojisSection,
    members:     GuildMembersSection,
    roles:       GuildRolesSection,
    invitations: GuildInvitationsSection,
    logs:        GuildLogsSection,
};

export default function GuildSettingsOverlay({ open, onClose, guild, myUserId }) {
    const [activeSection, setActiveSection] = useState('profile');

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open || !guild) return null;

    const handleNavClick = (key) => {
        setActiveSection(key);
    };

    const ActiveSection = SECTION_MAP[activeSection];

    return (
        <div className="tv2-settings-overlay">
            <div className="tv2-settings-backdrop" onClick={onClose} />
            <div className="tv2-settings-panel">
                <nav className="tv2-settings-nav">
                    <p className="tv2-settings-nav-title">{guild.name}</p>
                    {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            className={`tv2-settings-nav-item${activeSection === key ? ' is-active' : ''}`}
                            onClick={() => handleNavClick(key)}
                        >
                            <Icon size={14} /> {label}
                        </button>
                    ))}
                </nav>
                <div className="tv2-settings-content">
                    <button className="tv2-settings-close" onClick={onClose} title="Fermer">
                        <X size={18} />
                    </button>
                    {ActiveSection && (
                        <ActiveSection guild={guild} myUserId={myUserId} />
                    )}
                </div>
            </div>
        </div>
    );
}
