import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, ChevronUp, Plus, Settings, Trash2, ShieldAlert, Hash, Megaphone, MessagesSquare, Fingerprint, Menu } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { createPortal } from 'react-dom';
import { useGuildStore } from '../../stores/guildStore';
import { useChannelStore } from '../../stores/channelStore';
import { useSidebarActionsStore } from '../../stores/sidebarActionsStore';
import { usePresenceStore } from '../../stores/presenceStore';
import { useMemberStore } from '../../stores/memberStore';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifSettingsStore } from '../../stores/notifSettingsStore';
import { hasPerm } from '../../lib/permissions';
import { buildChannelContextItems } from './ChannelContextMenuItems';
import CreateCategoryModal from '../Channel/CreateCategoryModal';
import CreateChannelModal from '../Channel/CreateChannelModal';
import ChannelPermissionsDrawer from '../Channel/ChannelPermissionsDrawer';
import RoleManagerDrawer from '../Role/RoleManagerDrawer';
import ConfirmModal from '../Modal/ConfirmModal';
import ContextMenu from '../ContextMenu/ContextMenu';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useForumPostSubStore } from '../../stores/forumPostSubStore';
import { deleteChannel, ackChannel, reorderChannels, upsertOverwrite, deleteOverwrite } from '../../api/client';
import { getSocket } from '../../api/socket';
import InviteDrawer from '../Invite/InviteDrawer';
import WebhookDrawer from '../Webhook/WebhookDrawer';
import PermSyncModal from '../Modal/PermSyncModal';
import GuildHeaderDropdown    from '../GuildSettings/GuildHeaderDropdown';
import GuildSettingsOverlay   from '../GuildSettings/GuildSettingsOverlay';
import GuildNotifSettingsModal from '../GuildSettings/GuildNotifSettingsModal';
import GuildInviteModal       from '../Invite/GuildInviteModal';
import { CHANNEL_TYPE_TEXT }  from '../../lib/permissions';

const EMPTY_ARRAY = [];

const STATUS_OPTS = [
    { value: 'online', label: 'En ligne',          color: 'rgb(34 197 94)' },
    { value: 'idle',   label: 'Absent',             color: 'rgb(234 179 8)' },
    { value: 'dnd',    label: 'Ne pas déranger',    color: 'rgb(239 68 68)' },
];

function presenceColor(s) {
    if (s === 'online') return 'rgb(34 197 94)';
    if (s === 'idle')   return 'rgb(234 179 8)';
    if (s === 'dnd')    return 'rgb(239 68 68)';
    return 'rgb(100 116 139)';
}

function UserPanel() {
    const { user }         = useAuth();
    const setStatus        = usePresenceStore(s => s.setStatus);
    const myStatus         = usePresenceStore(s => s.statuses[String(user?.id)] ?? 'offline');
    const [open, setOpen]  = useState(false);

    const handleSelect = (status) => {
        setOpen(false);
        setStatus(user?.id, status);
        const sock = getSocket();
        if (sock?.connected) sock.emit('PRESENCE_UPDATE', { status });
    };

    const initials = (user?.username ?? '?').slice(0, 2).toUpperCase();

    return (
        <div className="tv2-user-panel">
            <div className="tv2-user-avatar" onClick={() => setOpen(v => !v)}>
                <span className="tv2-user-initial">{initials}</span>
                <span className="tv2-user-status-dot" style={{ background: presenceColor(myStatus) }} />
            </div>
            <div className="tv2-user-info">
                <span className="tv2-user-name">{user?.username ?? '—'}</span>
                <span className="tv2-user-status-text">{myStatus}</span>
            </div>
            {open && (
                <div className="tv2-status-picker">
                    {STATUS_OPTS.map(opt => (
                        <button
                            key={opt.value}
                            className={`tv2-status-opt${myStatus === opt.value ? ' is-active' : ''}`}
                            onClick={() => handleSelect(opt.value)}
                        >
                            <span className="tv2-status-dot" style={{ background: opt.color }} />
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

const ICONS = {
    0:  Hash,
    5:  Megaphone,
    15: MessagesSquare,
};

function channelIcon(type) {
    if (type === 11 || type === 12 || type === 10) return '↳';
    const Icon = ICONS[type];
    return Icon ? <Icon size={14} /> : <Hash size={14} />;
}

function hasPermDiff(channel, categoryChannel) {
    if (!categoryChannel) return false;
    const catOws = (categoryChannel.overwrites ?? []);
    const chOws  = (channel.overwrites ?? []);
    if (catOws.length !== chOws.length) return true;
    for (const catOw of catOws) {
        const match = chOws.find(o => String(o.targetId) === String(catOw.targetId) && o.type === catOw.type);
        if (!match || match.allow !== catOw.allow || match.deny !== catOw.deny) return true;
    }
    return false;
}

export default function ChannelSidebar({ isOpen = true, companyOpen = false, onNavigate, onOpenDashboard }) {
    const guilds         = useGuildStore(s => s.guilds);
    const activeGuildId  = useGuildStore(s => s.activeGuildId);
    const byGuild        = useChannelStore(s => s.byGuild);
    const activeChId     = useChannelStore(s => s.activeChannelId);
    const removeFromStore= useChannelStore(s => s.removeChannel);
    const hasUnread         = useChannelStore(s => s.hasUnread);
    const mentionByChannel  = useChannelStore(s => s.mentionByChannel);
    useChannelStore(s => s.readStateByChannel);
    const markReadStore     = useChannelStore(s => s.markRead);
    const setChannels       = useChannelStore(s => s.setChannels);
    const loadNotifSettings = useNotifSettingsStore(s => s.load);
    useNotifSettingsStore(s => s.byChannel);
    const { user }   = useAuth();
    const members    = useMemberStore(s => s.byGuild[String(activeGuildId)] ?? EMPTY_ARRAY);
    const myMember   = members.find(m => String(m.userId) === String(user?.id));
    const myPerms    = BigInt(myMember?.cachedGuildPermissions ?? 0);
    const canInvite  = hasPerm(myPerms, 'CREATE_INSTANT_INVITE');
    const canManage  = hasPerm(myPerms, 'MANAGE_GUILD');
    const navigate       = useNavigate();

    useEffect(() => {
        if (!activeGuildId) return;
        useNotifSettingsStore.getState().loadGuild(activeGuildId);
    }, [activeGuildId]);

    // Modal state vit dans le store partagé (CompanySidebar peut l'ouvrir aussi)
    const catOpen    = useSidebarActionsStore(s => s.catOpen);
    const chanParent = useSidebarActionsStore(s => s.chanParent);
    const rolesOpen  = useSidebarActionsStore(s => s.rolesOpen);
    const { openCat, openChan, openRoles, closeCat, closeChan, closeRoles } = useSidebarActionsStore();

    const [collapsed, setCollapsed] = useState(() => new Set());
    const [permFor, setPermFor]     = useState(null);
    const [delFor, setDelFor]       = useState(null);
    const [inviteFor, setInviteFor] = useState(null);
    const [webhookFor, setWebhookFor] = useState(null);
    const [permSyncState, setPermSyncState] = useState(null);
    const [dropdownOpen,   setDropdownOpen]   = useState(false);
    const [settingsOpen,   setSettingsOpen]   = useState(false);
    const [notifOpen,      setNotifOpen]      = useState(false);
    const [guildInviteFor, setGuildInviteFor] = useState(null);
    const isReorderingRef  = useRef(false);
    const headerRef        = useRef(null);
    const { menu, openMenu, closeMenu } = useContextMenu();
    const getPostsForForum = useForumPostSubStore(s => s.getPostsForForum);

    const guild    = guilds.find(g => String(g.id) === activeGuildId);
    const rawCh    = byGuild[activeGuildId];
    const channels = (Array.isArray(rawCh) ? rawCh : []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const categories = channels.filter(c => c.type === 4);
    const topLevel   = channels.filter(c => c.type !== 4 && !c.parentId);

    const go = (path) => { navigate(path); onNavigate?.(); };
    const toggleCat = (id) => setCollapsed(s => {
        const next = new Set(s);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const handleDelete = async () => {
        if (!delFor) return;
        await deleteChannel(activeGuildId, delFor.id);
        removeFromStore(activeGuildId, delFor.id);
        setDelFor(null);
    };

    const channelCtxItems = (ch) => {
        loadNotifSettings(activeGuildId, ch.id);
        const unread    = hasUnread(ch.id);
        const canManage = hasPerm(myPerms, 'MANAGE_CHANNELS');
        return buildChannelContextItems({
            channel:        ch,
            guildId:        activeGuildId,
            hasUnread:      unread,
            canManage,
            onMarkRead: async () => {
                if (!ch.lastMessageId) return;
                try { await ackChannel(activeGuildId, ch.id, String(ch.lastMessageId)); } catch { /* skip */ }
                markReadStore(ch.id);
            },
            onCopyLink: () => {
                const url = `${window.location.origin}/dashboard/tchatv2/guilds/${activeGuildId}/channels/${ch.id}`;
                navigator.clipboard.writeText(url);
            },
            onOpenSettings: () => setPermFor(ch),
            onInvite:       () => setInviteFor(ch),
            onWebhook:      () => setWebhookFor(ch),
            onCopyId:       () => navigator.clipboard.writeText(String(ch.id)),
            onDelete:       () => setDelFor(ch),
            onRemoveFromCategory: async () => {
                if (!ch.parentId || isReorderingRef.current) return;
                isReorderingRef.current = true;
                try {
                    await applyChannelMove(ch, String(ch.parentId), 0, null, topLevel.length, channels.slice(), null);
                } finally {
                    isReorderingRef.current = false;
                }
            },
        });
    };

    const categoryCtxItems = (cat) => [
        { icon: <Plus size={14} />,     text: 'Créer un salon',         action: () => openChan({ parentId: cat.id, parentName: cat.name }) },
        { icon: <Settings size={14} />, text: 'Permissions',            action: () => setPermFor(cat) },
        { type: 'separator' },
        { icon: <Fingerprint size={14} />, text: "Copier l'ID",         action: () => navigator.clipboard.writeText(String(cat.id)) },
        { type: 'separator' },
        { icon: <Trash2 size={14} />,   text: 'Supprimer la catégorie', danger: true, action: () => setDelFor(cat) },
    ];

    const guildCtxItems = () => [
        { type: 'label', text: guild?.name ?? 'Serveur' },
        { icon: <Plus size={14} />,        text: 'Nouvelle catégorie',        action: openCat },
        { icon: <Hash size={14} />,        text: 'Nouveau salon',             action: () => openChan({}) },
        { type: 'separator' },
        { icon: <ShieldAlert size={14} />, text: 'Gérer les rôles',           action: openRoles },
        { type: 'separator' },
        { icon: <Fingerprint size={14} />, text: "Copier l'ID du serveur",    action: () => navigator.clipboard.writeText(String(guild?.id ?? '')) },
    ];

    const applyChannelMove = async (movedCh, srcParentId, _srcIndex, destParentId, destIndex, allChs, syncOverwrites) => {
        const getSorted = (pid) => {
            const list = pid === null
                ? allChs.filter(c => c.type !== 4 && !c.parentId)
                : allChs.filter(c => c.type !== 4 && String(c.parentId) === String(pid));
            return list.filter(c => String(c.id) !== String(movedCh.id)).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        };

        const srcBucket  = getSorted(srcParentId);
        const destBucket = srcParentId === destParentId ? srcBucket : getSorted(destParentId);
        destBucket.splice(destIndex, 0, { ...movedCh, parentId: destParentId });

        const posUpdates = [];
        const assignPositions = (bucket, parentId) => {
            bucket.forEach((c, i) => {
                posUpdates.push({ id: String(c.id), position: i, parentId: parentId ? String(parentId) : null });
            });
        };

        if (srcParentId === destParentId) {
            assignPositions(destBucket, destParentId);
        } else {
            assignPositions(srcBucket, srcParentId);
            assignPositions(destBucket, destParentId);
        }

        // Optimiste
        const updatedAll = allChs.map(c => {
            const upd = posUpdates.find(u => u.id === String(c.id));
            if (!upd) return c;
            return { ...c, position: upd.position, parentId: upd.parentId };
        });
        setChannels(activeGuildId, updatedAll);

        try {
            await reorderChannels(activeGuildId, posUpdates);
            if (syncOverwrites) {
                const { destCat } = syncOverwrites;
                for (const ow of movedCh.overwrites ?? []) {
                    await deleteOverwrite(activeGuildId, movedCh.id, ow.targetId).catch(() => {});
                }
                for (const ow of destCat.overwrites ?? []) {
                    await upsertOverwrite(activeGuildId, movedCh.id, ow.targetId, {
                        type:  ow.type === 0 ? 'ROLE' : 'MEMBER',
                        allow: String(ow.allow ?? '0'),
                        deny:  String(ow.deny  ?? '0'),
                    }).catch(() => {});
                }
            }
        } catch {
            setChannels(activeGuildId, allChs);
        }
    };

    const onDragEnd = async (result) => {
        if (isReorderingRef.current) return;
        const { source, destination, type, draggableId } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        const allChs = channels.slice();
        isReorderingRef.current = true;
        try {
            if (type === 'CATEGORY') {
                const cats = allChs.filter(c => c.type === 4).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
                const [moved] = cats.splice(source.index, 1);
                cats.splice(destination.index, 0, moved);
                const updated = allChs.map(c => {
                    if (c.type !== 4) return c;
                    const idx = cats.findIndex(cat => String(cat.id) === String(c.id));
                    return { ...c, position: idx * 2 };
                });
                setChannels(activeGuildId, updated);
                const payload = cats.map((c, i) => ({ id: String(c.id), position: i * 2 }));
                try { await reorderChannels(activeGuildId, payload); }
                catch { setChannels(activeGuildId, allChs); }
                return;
            }

            // type === 'CHANNEL'
            const movedId = draggableId.replace('ch-', '');
            const movedCh = allChs.find(c => String(c.id) === movedId);
            if (!movedCh) return;

            const srcParentId  = source.droppableId === 'uncategorized' ? null : source.droppableId.replace('cat-', '');
            const destParentId = destination.droppableId === 'uncategorized' ? null : destination.droppableId.replace('cat-', '');

            if (destParentId && destParentId !== srcParentId) {
                const destCat = allChs.find(c => String(c.id) === destParentId);
                if (destCat && hasPermDiff(movedCh, destCat)) {
                    setPermSyncState({ channel: movedCh, allChsSnapshot: allChs, targetCategoryId: destParentId, targetCategoryName: destCat.name, destParentId, destIndex: destination.index, srcParentId, srcIndex: source.index, destCat });
                    return;
                }
            }

            await applyChannelMove(movedCh, srcParentId, source.index, destParentId, destination.index, allChs, null);
        } finally {
            isReorderingRef.current = false;
        }
    };

    const handlePermSync = async () => {
        if (!permSyncState) return;
        const { channel, allChsSnapshot, srcParentId, srcIndex, destParentId, destIndex, destCat } = permSyncState;
        setPermSyncState(null);
        await applyChannelMove(channel, srcParentId, srcIndex, destParentId, destIndex, allChsSnapshot, { destCat });
    };

    const handlePermKeep = async () => {
        if (!permSyncState) return;
        const { channel, allChsSnapshot, srcParentId, srcIndex, destParentId, destIndex } = permSyncState;
        setPermSyncState(null);
        await applyChannelMove(channel, srcParentId, srcIndex, destParentId, destIndex, allChsSnapshot, null);
    };

    const handlePermCancel = () => setPermSyncState(null);

    const renderChannel = (ch, index) => {
        const active     = String(ch.id) === activeChId;
        const hasMention = !active && !!mentionByChannel[String(ch.id)];
        const unread     = !active && !hasMention && hasUnread(ch.id);
        const isMuted    = !active && useNotifSettingsStore.getState().getSettings(ch.id).isMuted;
        const isForum = ch.type === 15;
        const subscribedPosts = isForum ? getPostsForForum(activeGuildId, ch.id) : [];
        return (
            <Draggable key={ch.id} draggableId={`ch-${ch.id}`} index={index}>
                {(dragProvided, dragSnapshot) => {
                    const content = (
                        <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className="tv2-channel-group"
                            style={dragProvided.draggableProps.style}
                        >
                            <div
                                className={[
                                    'tv2-channel-row tv2-channel-btn',
                                    active                 ? 'is-active'  : '',
                                    (hasMention || unread) ? 'is-unread'  : '',
                                    isMuted                ? 'is-muted'   : '',
                                    dragSnapshot.isDragging ? 'is-dragging' : '',
                                ].filter(Boolean).join(' ')}
                                onClick={() => go(`/dashboard/tchatv2/guilds/${activeGuildId}/channels/${ch.id}`)}
                                onContextMenu={e => openMenu(e, channelCtxItems(ch))}
                                {...dragProvided.dragHandleProps}
                            >
                                {hasMention && <span className="tv2-unread-pill tv2-unread-pill--mention" />}
                                {unread     && <span className="tv2-unread-pill" />}
                                <span className="tv2-channel-btn-icon">{channelIcon(ch.type)}</span>
                                <span className={`tv2-channel-btn-label${unread ? ' tv2-channel-btn-label--unread' : ''}`}>
                                    {ch.name}
                                </span>
                                <div className="tv2-channel-hover-actions">
                                    <button className="tv2-icon-btn-xs" onClick={e => { e.stopPropagation(); setPermFor(ch); }} title="Permissions">
                                        <Settings size={12} />
                                    </button>
                                    <button className="tv2-icon-btn-xs is-danger" onClick={e => { e.stopPropagation(); setDelFor(ch); }} title="Supprimer">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>

                            {isForum && subscribedPosts.length > 0 && (
                                <div className="tv2-forum-subscribed-posts">
                                    {subscribedPosts.map(post => {
                                        const postActive  = String(post.id) === activeChId;
                                        const postUnread  = !postActive && hasUnread(post.id);
                                        const postMention = !postActive && !!mentionByChannel[String(post.id)];
                                        return (
                                            <button
                                                key={post.id}
                                                className={[
                                                    'tv2-channel-btn tv2-forum-post-item',
                                                    postActive               ? 'is-active' : '',
                                                    (postMention || postUnread) ? 'is-unread' : '',
                                                ].filter(Boolean).join(' ')}
                                                onClick={() => go(`/dashboard/tchatv2/guilds/${activeGuildId}/channels/${post.id}`)}
                                                title={post.name}
                                            >
                                                {postMention && <span className="tv2-unread-pill tv2-unread-pill--mention" />}
                                                {postUnread  && <span className="tv2-unread-pill" />}
                                                <span className="tv2-channel-btn-icon" style={{ fontSize: 11 }}>↳</span>
                                                <span className="tv2-channel-btn-label" style={{ fontSize: 12 }}>
                                                    {post.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                    return dragSnapshot.isDragging ? createPortal(content, document.body) : content;
                }}
            </Draggable>
        );
    };

    const cls = [
        'tv2-channel-sidebar',
        isOpen ? 'is-open' : '',
        companyOpen ? 'with-company' : '',
    ].filter(Boolean).join(' ');

    return (
        <nav className={cls}>
            <div className="tv2-channel-header" ref={headerRef}>
                {onOpenDashboard && (
                    <button className="tv2-icon-btn" onClick={onOpenDashboard} title="Menu principal">
                        <Menu size={16} />
                    </button>
                )}
                <span
                    className="tv2-channel-header-name"
                    onClick={() => setDropdownOpen(v => !v)}
                    onContextMenu={e => openMenu(e, guildCtxItems())}
                    style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                    {guild?.name ?? '…'}
                    {dropdownOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </span>
                <button className="tv2-icon-btn" onClick={openRoles} title="Rôles">
                    <ShieldAlert size={14} />
                </button>
                <button className="tv2-icon-btn" onClick={openCat} title="Nouvelle catégorie">
                    <Plus size={14} />
                </button>
            </div>
            <GuildHeaderDropdown
                open={dropdownOpen}
                onClose={() => setDropdownOpen(false)}
                guild={guild}
                canInvite={canInvite}
                canManage={canManage}
                onInvite={() => setGuildInviteFor(guild)}
                onSettings={() => setSettingsOpen(true)}
                onCreateChannel={() => openChan({})}
                onCreateCategory={openCat}
                onNotifSettings={() => setNotifOpen(true)}
                anchorRef={headerRef}
            />

            {/* Clic droit sur fond de liste = actions du serveur */}
            <div className="tv2-channel-list" onContextMenu={e => openMenu(e, guildCtxItems())}>
                <DragDropContext onDragEnd={onDragEnd}>
                    {/* Zone sans catégorie */}
                    <Droppable droppableId="uncategorized" type="CHANNEL">
                        {(dropProvided, dropSnapshot) => (
                            <div
                                ref={dropProvided.innerRef}
                                {...dropProvided.droppableProps}
                                className={dropSnapshot.isDraggingOver ? 'tv2-drop-zone--over' : ''}
                                style={{ minHeight: dropSnapshot.isDraggingOver && topLevel.length === 0 ? 32 : (topLevel.length === 0 ? 8 : undefined) }}
                            >
                                {topLevel.map((ch, i) => renderChannel(ch, i))}
                                {dropProvided.placeholder}
                                {dropSnapshot.isDraggingOver && topLevel.length === 0 && (
                                    <div className="tv2-drop-zone-hint">Sans catégorie</div>
                                )}
                            </div>
                        )}
                    </Droppable>

                    {/* Catégories draggables */}
                    <Droppable droppableId="categories" type="CATEGORY">
                        {(catDropProvided) => (
                            <div ref={catDropProvided.innerRef} {...catDropProvided.droppableProps}>
                                {categories.map((cat, catIndex) => {
                                    const open     = !collapsed.has(cat.id);
                                    const children = channels.filter(c => String(c.parentId) === String(cat.id));
                                    return (
                                        <Draggable key={cat.id} draggableId={`cat-${cat.id}`} index={catIndex}>
                                            {(catDragProvided, catDragSnapshot) => (
                                                <section
                                                    ref={catDragProvided.innerRef}
                                                    {...catDragProvided.draggableProps}
                                                    className={`tv2-category${catDragSnapshot.isDragging ? ' is-dragging' : ''}`}
                                                    style={catDragProvided.draggableProps.style}
                                                >
                                                    <header className="tv2-category-head" onContextMenu={e => openMenu(e, categoryCtxItems(cat))} {...catDragProvided.dragHandleProps}>
                                                        <button className="tv2-category-toggle" onClick={() => toggleCat(cat.id)}>
                                                            {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                                            <span className="tv2-category-name">{cat.name}</span>
                                                        </button>
                                                        <button className="tv2-icon-btn-xs" title="Permissions" onClick={() => setPermFor(cat)}>
                                                            <Settings size={12} />
                                                        </button>
                                                        <button className="tv2-icon-btn-xs" title="Nouveau salon" onClick={() => openChan({ parentId: cat.id, parentName: cat.name })}>
                                                            <Plus size={12} />
                                                        </button>
                                                    </header>

                                                    <Droppable droppableId={`cat-${cat.id}`} type="CHANNEL">
                                                        {(chDropProvided, chDropSnapshot) => (
                                                            <div
                                                                ref={chDropProvided.innerRef}
                                                                {...chDropProvided.droppableProps}
                                                                className={chDropSnapshot.isDraggingOver ? 'tv2-drop-zone--over' : ''}
                                                                style={{ minHeight: open ? (children.length === 0 ? 8 : undefined) : 0, overflow: open ? undefined : 'hidden' }}
                                                            >
                                                                {open && children.map((ch, i) => renderChannel(ch, i))}
                                                                {open && chDropProvided.placeholder}
                                                            </div>
                                                        )}
                                                    </Droppable>
                                                </section>
                                            )}
                                        </Draggable>
                                    );
                                })}
                                {catDropProvided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </div>

            <CreateCategoryModal
                open={catOpen}
                onClose={closeCat}
                guildId={activeGuildId}
            />
            <CreateChannelModal
                open={chanParent !== null}
                onClose={closeChan}
                guildId={activeGuildId}
                parentId={chanParent?.parentId}
                parentName={chanParent?.parentName}
            />
            <ChannelPermissionsDrawer
                open={!!permFor}
                onClose={() => setPermFor(null)}
                guildId={activeGuildId}
                channel={permFor}
            />
            <RoleManagerDrawer
                open={rolesOpen}
                onClose={closeRoles}
                guildId={activeGuildId}
            />
            <ConfirmModal
                open={!!delFor}
                onClose={() => setDelFor(null)}
                onConfirm={handleDelete}
                title={`Supprimer #${delFor?.name} ?`}
                body="L'ensemble des messages et threads du salon seront supprimés."
                preview={delFor?.topic}
            />
            <InviteDrawer
                open={!!inviteFor}
                onClose={() => setInviteFor(null)}
                guildId={activeGuildId}
                channelId={inviteFor?.id}
                channelName={inviteFor?.name}
                portal
            />
            <WebhookDrawer
                open={!!webhookFor}
                onClose={() => setWebhookFor(null)}
                guildId={activeGuildId}
                channelId={webhookFor?.id}
                channelName={webhookFor?.name}
                portal
            />
            <PermSyncModal
                open={!!permSyncState}
                onClose={handlePermCancel}
                channelName={permSyncState?.channel?.name ?? ''}
                categoryName={permSyncState?.targetCategoryName ?? ''}
                onSync={handlePermSync}
                onKeep={handlePermKeep}
            />
            {menu && <ContextMenu {...menu} onClose={closeMenu} />}
            {createPortal(
                <GuildSettingsOverlay
                    open={settingsOpen}
                    onClose={() => setSettingsOpen(false)}
                    guild={guild}
                    myUserId={user?.id}
                />,
                document.body
            )}
            <GuildNotifSettingsModal
                open={notifOpen}
                onClose={() => setNotifOpen(false)}
                guild={guild}
            />
            {guildInviteFor && (
                <GuildInviteModal
                    open
                    guild={guildInviteFor}
                    myUserId={user?.id}
                    onClose={() => setGuildInviteFor(null)}
                />
            )}
            <UserPanel />
        </nav>
    );
}
