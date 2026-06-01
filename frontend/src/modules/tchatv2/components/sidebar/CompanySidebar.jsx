import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Fingerprint, ExternalLink, Plus, Hash, ShieldAlert, MessageSquare, UserPlus, Check } from 'lucide-react';
import { useGuildStore } from '../../stores/guildStore';
import { useChannelStore } from '../../stores/channelStore';
import { useMemberStore } from '../../stores/memberStore';
import { useSidebarActionsStore } from '../../stores/sidebarActionsStore';
import { useAuth } from '@/contexts/AuthContext';
import { hasPerm, CHANNEL_TYPE_TEXT } from '../../lib/permissions';
import ContextMenu from '../ContextMenu/ContextMenu';
import { useContextMenu } from '../../hooks/useContextMenu';
import CreateOrJoinModal from './CreateOrJoinModal';
import GuildInviteModal from '../Invite/GuildInviteModal';

export default function CompanySidebar({ isOpen = true, onNavigate }) {
    const guilds        = useGuildStore(s => s.guilds);
    const activeGuildId = useGuildStore(s => s.activeGuildId);
    const guildHasUnread = useChannelStore(s => s.guildHasUnread);
    const markGuildRead  = useChannelStore(s => s.markGuildRead);
    // subscribe to read/channel state changes for re-renders
    useChannelStore(s => s.readStateByChannel);
    useChannelStore(s => s.byGuild);
    const navigate      = useNavigate();
    const location      = useLocation();
    const { menu, openMenu, closeMenu } = useContextMenu();
    const dmActive      = location.pathname.includes('/tchatv2/dm');

    const { openCat, openChan, openRoles } = useSidebarActionsStore();
    const [showModal, setShowModal] = useState(false);
    const [inviteFor, setInviteFor] = useState(null);
    const { user } = useAuth();
    const channelsByGuild = useChannelStore(s => s.byGuild);
    const membersByGuild  = useMemberStore(s => s.byGuild);

    const go = (path) => {
        navigate(path);
        onNavigate?.();
    };

    const getMemberPerms = (guildId) => {
        const myMember = (membersByGuild[String(guildId)] ?? [])
            .find(m => String(m.userId) === String(user?.id));
        if (!myMember) return 0n;
        return BigInt(myMember.cachedGuildPermissions ?? 0);
    };

    const guildCtxItems = (guild) => {
        const isActive  = String(guild.id) === activeGuildId;
        const name      = guild.name || '?';
        const myPerms   = getMemberPerms(guild.id);
        const canInvite = hasPerm(myPerms, 'CREATE_INSTANT_INVITE');
        const inviteCh  = canInvite
            ? ((channelsByGuild[String(guild.id)] ?? []).find(ch => ch.type === CHANNEL_TYPE_TEXT) ?? null)
            : null;
        const canManage = hasPerm(myPerms, 'MANAGE_GUILD');
        const hasUnread = guildHasUnread(guild.id);
        const withNav   = (fn) => () => { if (!isActive) go(`/dashboard/tchatv2/guilds/${guild.id}`); fn(); };
        return [
            { type: 'label', text: name },
            { icon: <ExternalLink size={14} />, text: 'Accéder au serveur', action: () => go(`/dashboard/tchatv2/guilds/${guild.id}`) },
            { icon: <Check size={14} />, text: 'Marquer comme lu', disabled: !hasUnread, action: () => markGuildRead(guild.id) },
            ...(canInvite ? [
                { icon: <UserPlus size={14} />, text: 'Inviter', action: () => setInviteFor({ guild, channelId: inviteCh?.id ?? null }) },
            ] : []),
            ...(canManage ? [
                { type: 'separator' },
                { icon: <Plus size={14} />,        text: 'Nouvelle catégorie', action: withNav(openCat) },
                { icon: <Hash size={14} />,        text: 'Nouveau salon',      action: withNav(() => openChan({})) },
                { type: 'separator' },
                { icon: <ShieldAlert size={14} />, text: 'Gérer les rôles',    action: withNav(openRoles) },
            ] : []),
            { type: 'separator' },
            { icon: <Fingerprint size={14} />, text: "Copier l'ID", action: () => navigator.clipboard.writeText(String(guild.id)) },
        ];
    };

    return (
        <aside className={`tv2-company-sidebar${isOpen ? ' is-open' : ''}`}>
            <button
                title="Messages directs"
                className={`tv2-company-btn${dmActive ? ' is-active' : ''}`}
                onClick={() => go('/dashboard/tchatv2/dm')}
            >
                <MessageSquare size={20} />
            </button>

            <div className="tv2-company-divider" />

            {guilds.map(guild => {
                const active  = String(guild.id) === activeGuildId;
                const name    = guild.name || '?';
                const initial = name.charAt(0).toUpperCase();
                const unread = !active && guildHasUnread(guild.id);
                return (
                    <button
                        key={guild.id}
                        title={name}
                        className={`tv2-company-btn${active ? ' is-active' : unread ? ' has-unread' : ''}`}
                        onClick={() => go(`/dashboard/tchatv2/guilds/${guild.id}`)}
                        onContextMenu={e => openMenu(e, guildCtxItems(guild))}
                    >
                        {guild.iconHash
                            ? <img src={`https://cdn.jipeg-corporation.eu/v2/guilds/${guild.id}/icons/${guild.iconHash}`} alt={name} />
                            : initial}
                        {unread && <span className="tv2-guild-unread-dot" />}
                    </button>
                );
            })}

            <button
                title="Créer un espace ou rejoindre"
                className="tv2-company-add"
                onClick={() => setShowModal(true)}
            >
                +
            </button>
            {menu && <ContextMenu {...menu} onClose={closeMenu} />}
            {showModal && (
                <CreateOrJoinModal onClose={() => setShowModal(false)} />
            )}
            {inviteFor && (
                <GuildInviteModal
                    open
                    guild={inviteFor.guild}
                    defaultChannelId={inviteFor.channelId}
                    myUserId={user?.id}
                    onClose={() => setInviteFor(null)}
                />
            )}
        </aside>
    );
}
