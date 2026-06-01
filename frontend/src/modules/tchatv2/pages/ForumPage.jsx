import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Menu, MessagesSquare, Plus, MessageCircle, Clock, X, Paperclip, Shield, Image, Trash2, Pin, Lock, Unlock, ChevronUp, ChevronDown, Tag, TrendingUp, HelpCircle, Bell, BellOff } from 'lucide-react';
import { listActiveForumPosts, listArchivedForumPosts, createForumPost, uploadAttachments, deleteThread, updateThread, reorderForumPosts, listForumTags, getForumSubscription, subscribeToForum, unsubscribeFromForum, ackChannel, leaveThread } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMemberStore } from '../stores/memberStore';
import { hasPerm } from '../lib/permissions';
import { useNotifSettingsStore } from '../stores/notifSettingsStore';
import { useChannelStore } from '../stores/channelStore';
import ContextMenu from '../components/ContextMenu/ContextMenu';
import { useContextMenu } from '../hooks/useContextMenu';
import { buildForumPostContextItems } from '../components/Thread/ForumPostContextMenuItems';
import ChannelPermissionsDrawer from '../components/Channel/ChannelPermissionsDrawer';

function formatDate(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
}

function sortThreads(list) {
    return [...list].sort((a, b) => {
        const aPin = a.threadMetadata?.pinned ? 1 : 0;
        const bPin = b.threadMetadata?.pinned ? 1 : 0;
        if (bPin !== aPin) return bPin - aPin;
        if (aPin) return (a.position ?? 0) - (b.position ?? 0);
        const aTs = BigInt(a.lastMessageId ?? 0);
        const bTs = BigInt(b.lastMessageId ?? 0);
        return aTs < bTs ? 1 : aTs > bTs ? -1 : 0;
    });
}

function NewPostForm({ guildId, channelId, onCreated, onCancel }) {
    const [name, setName] = useState('');
    const [body, setBody] = useState('');
    const [files, setFiles] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const selected = Array.from(e.target.files ?? []);
        if (!selected.length) return;
        setFiles(prev => [...prev, ...selected]);
        selected.forEach(f => {
            if (f.type.startsWith('image/')) {
                const url = URL.createObjectURL(f);
                setPreviews(prev => [...prev, { name: f.name, url }]);
            } else {
                setPreviews(prev => [...prev, { name: f.name, url: null }]);
            }
        });
        e.target.value = '';
    };

    const removeFile = (idx) => {
        setFiles(prev => prev.filter((_, i) => i !== idx));
        setPreviews(prev => {
            const removed = prev[idx];
            if (removed?.url) URL.revokeObjectURL(removed.url);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setLoading(true);
        setError(null);
        try {
            let attachmentIds = [];

            if (files.length > 0) {
                const fd = new FormData();
                for (const f of files) fd.append('files', f, f.name);
                const { attachments } = await uploadAttachments(guildId, channelId, fd);
                attachmentIds = attachments.map(a => a.id);
            }

            const result = await createForumPost(guildId, channelId, {
                name: name.trim(),
                message: { content: body.trim() || name.trim(), attachmentIds },
            });
            onCreated(result.thread ?? result);
        } catch (err) {
            setError(err?.response?.data?.message ?? 'Erreur lors de la création');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className="tv2-forum-new-form" onSubmit={submit}>
            <div className="tv2-forum-new-form-head">
                <span>Nouveau post</span>
                <button type="button" className="tv2-icon-btn" onClick={onCancel}><X size={14} /></button>
            </div>
            <input
                className="tv2-forum-new-title"
                placeholder="Titre du post"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                autoFocus
            />
            <textarea
                className="tv2-forum-new-body"
                placeholder="Contenu (optionnel)"
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={3}
            />
            {previews.length > 0 && (
                <div className="tv2-forum-attach-previews">
                    {previews.map((p, i) => (
                        <div key={i} className="tv2-forum-attach-preview">
                            {p.url
                                ? <img src={p.url} alt={p.name} className="tv2-forum-attach-img" />
                                : <div className="tv2-forum-attach-file"><Paperclip size={14} /><span>{p.name}</span></div>
                            }
                            <button
                                type="button"
                                className="tv2-forum-attach-remove"
                                onClick={() => removeFile(i)}
                                title="Supprimer"
                            ><X size={10} /></button>
                        </div>
                    ))}
                </div>
            )}
            {error && <p className="tv2-invite-error">{error}</p>}
            <div className="tv2-forum-new-actions">
                <button
                    type="button"
                    className="tv2-btn-ghost tv2-forum-attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Joindre un fichier"
                >
                    <Image size={14} />
                    <span>Joindre</span>
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
                <div style={{ flex: 1 }} />
                <button type="button" className="tv2-btn-ghost" onClick={onCancel}>Annuler</button>
                <button type="submit" className="tv2-btn-primary" disabled={loading || !name.trim()}>
                    {loading ? 'Création…' : 'Publier'}
                </button>
            </div>
        </form>
    );
}

const SORT_OPTIONS = [
    { value: 'latest',     label: 'Récents',       Icon: Clock },
    { value: 'popular',    label: 'Populaires',    Icon: TrendingUp },
    { value: 'unanswered', label: 'Sans réponse',  Icon: HelpCircle },
];

export default function ForumPage({ channel, guildId, isMobile, onOpenChannels }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [threads, setThreads] = useState([]);
    const [tags, setTags] = useState([]);
    const [sort, setSort] = useState('latest');
    const [filterTagId, setFilterTagId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [subscribed, setSubscribed] = useState(null); // null = loading, true/false = état
    const [subLoading, setSubLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [permThread, setPermThread] = useState(null);

    const members  = useMemberStore(s => s.byGuild[String(guildId)] ?? []);
    const myMember = members.find(m => String(m.userId) === String(user?.id));
    const myPerms  = BigInt(myMember?.cachedGuildPermissions ?? 0);
    const canManage = hasPerm(myPerms, 'MANAGE_THREADS');

    const { menu, openMenu, closeMenu } = useContextMenu();
    const loadNotifSettings = useNotifSettingsStore(s => s.load);
    const hasUnread         = useChannelStore(s => s.hasUnread);
    const markReadStore     = useChannelStore(s => s.markRead);
    useNotifSettingsStore(s => s.byChannel);
    const readStateByChannel = useChannelStore(s => s.readStateByChannel);

    const load = useCallback(() => {
        if (!channel?.id || !guildId) return;
        setLoading(true);
        Promise.all([
            listActiveForumPosts(guildId, channel.id, { sort }).catch(() => []),
            listArchivedForumPosts(guildId, channel.id).catch(() => []),
            listForumTags(guildId, channel.id).catch(() => []),
        ]).then(([active, archived, fetchedTags]) => {
            const all = [...(Array.isArray(active) ? active : []), ...(Array.isArray(archived) ? archived : [])];
            setThreads(sortThreads(all));
            setTags(Array.isArray(fetchedTags) ? fetchedTags : []);
        }).finally(() => setLoading(false));
    }, [channel?.id, guildId, sort]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!channel?.id || !guildId || !channel.lastMessageId) return;
        ackChannel(guildId, channel.id, String(channel.lastMessageId)).catch(() => {});
        markReadStore(channel.id);
    }, [channel?.id, guildId]);

    useEffect(() => {
        if (!channel?.id || !guildId) return;
        getForumSubscription(guildId, channel.id)
            .then(data => setSubscribed(data.subscribed))
            .catch(() => setSubscribed(false));
    }, [channel?.id, guildId]);

    const handleCreated = (thread) => {
        setShowForm(false);
        setThreads(ts => sortThreads([thread, ...ts]));
        if (thread?.id) navigate(`/dashboard/tchatv2/guilds/${guildId}/channels/${thread.id}`);
    };

    const handleDelete = async (e, t) => {
        e.stopPropagation();
        if (!window.confirm(`Supprimer le post "${t.name}" ?`)) return;
        try {
            await deleteThread(guildId, t.id);
            setThreads(ts => ts.filter(x => x.id !== t.id));
        } catch { /* intentional */ }
    };

    const handleToggleLock = async (e, t) => {
        e.stopPropagation();
        const locked = !t.threadMetadata?.locked;
        try {
            const updated = await updateThread(guildId, t.id, { locked });
            setThreads(ts => sortThreads(ts.map(x => x.id === t.id ? updated : x)));
        } catch { /* intentional */ }
    };

    const handleTogglePin = async (e, t) => {
        e.stopPropagation();
        const pinned = !t.threadMetadata?.pinned;
        const position = pinned
            ? threads.filter(x => x.threadMetadata?.pinned).length
            : 0;
        try {
            const updated = await updateThread(guildId, t.id, { pinned, position });
            setThreads(ts => sortThreads(ts.map(x => x.id === t.id ? { ...updated, position } : x)));
        } catch { /* intentional */ }
    };

    const handleMove = async (e, t, direction) => {
        e.stopPropagation();
        const pinned = threads.filter(x => x.threadMetadata?.pinned);
        const idx = pinned.findIndex(x => x.id === t.id);
        const swapIdx = idx + direction;
        if (swapIdx < 0 || swapIdx >= pinned.length) return;

        const newOrder = [...pinned];
        [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
        const items = newOrder.map((p, i) => ({ id: String(p.id), position: i }));

        try {
            await reorderForumPosts(guildId, channel.id, items);
            setThreads(ts => sortThreads(ts.map(x => {
                const found = items.find(it => it.id === String(x.id));
                return found ? { ...x, position: found.position } : x;
            })));
        } catch { /* intentional */ }
    };

    const handleToggleSubscribe = async () => {
        if (subLoading) return;
        setSubLoading(true);
        try {
            if (subscribed) {
                await unsubscribeFromForum(guildId, channel.id);
                setSubscribed(false);
            } else {
                await subscribeToForum(guildId, channel.id);
                setSubscribed(true);
            }
        } catch { /* intentional */ }
        finally { setSubLoading(false); }
    };

    const openThreadMenu = (e, t) => {
        e.preventDefault();
        e.stopPropagation();
        loadNotifSettings(guildId, t.id);
        const items = buildForumPostContextItems({
            thread: t,
            guildId,
            hasUnread: hasUnread(t.id),
            canManage,
            onMarkRead: async () => {
                if (!t.lastMessageId) return;
                try { await ackChannel(guildId, t.id, String(t.lastMessageId)); } catch { /* skip */ }
                markReadStore(t.id);
            },
            onUnfollow: async () => {
                try { await leaveThread(guildId, t.id); } catch { /* skip */ }
            },
            onOpen: () => navigate(`/dashboard/tchatv2/guilds/${guildId}/channels/${t.id}`),
            onToggleLock: () => handleToggleLock({ stopPropagation: () => {} }, t),
            onCopyLink: () => {
                const url = `${window.location.origin}/dashboard/tchatv2/guilds/${guildId}/channels/${t.id}`;
                navigator.clipboard.writeText(url);
            },
            onTogglePin: () => handleTogglePin({ stopPropagation: () => {} }, t),
            onDelete: async () => {
                if (!window.confirm(`Supprimer le post "${t.name}" ?`)) return;
                try {
                    await deleteThread(guildId, t.id);
                    setThreads(ts => ts.filter(x => x.id !== t.id));
                } catch { /* skip */ }
            },
            onCopyThreadId: () => navigator.clipboard.writeText(String(t.id)),
        });
        openMenu(e, items);
    };

    const displayed = filterTagId
        ? threads.filter(t => {
            const tids = (t.tags ?? []).map(tag => String(tag.tagId ?? tag));
            return tids.includes(filterTagId);
        })
        : threads;

    const pinnedIds = new Set(displayed.filter(t => t.threadMetadata?.pinned).map(t => t.id));
    const pinnedList = displayed.filter(t => pinnedIds.has(t.id));

    return (
        <div className="tv2-main">
            <div className="tv2-header">
                {isMobile && (
                    <button className="tv2-icon-btn tv2-hamburger" onClick={onOpenChannels} aria-label="Menu">
                        <Menu size={20} />
                    </button>
                )}
                <MessagesSquare size={16} className="tv2-header-hash" />
                <span className="tv2-header-title">{channel?.name}</span>
                {channel?.topic && <span className="tv2-header-topic">— {channel.topic}</span>}
                <div className="tv2-header-spacer" />
                <button className="tv2-icon-btn tv2-btn-primary-sm" onClick={() => setShowForm(v => !v)} title="Nouveau post">
                    <Plus size={16} />
                </button>
                <button
                    className={`tv2-icon-btn ${subscribed ? 'is-active' : ''}`}
                    onClick={handleToggleSubscribe}
                    disabled={subLoading || subscribed === null}
                    title={subscribed ? 'Se désabonner des notifications' : 'S\'abonner aux notifications'}
                >
                    {subscribed ? <Bell size={16} /> : <BellOff size={16} />}
                </button>
            </div>

            {/* Sort + Tag Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid var(--tv2-border)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                    {SORT_OPTIONS.map(({ value, label, Icon }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setSort(value)}
                            className={sort === value ? 'tv2-btn-primary tv2-btn-xs' : 'tv2-btn-ghost tv2-btn-xs'}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                        >
                            <Icon size={11} />
                            {label}
                        </button>
                    ))}
                </div>
                {tags.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <Tag size={12} style={{ opacity: 0.5 }} />
                        {tags.map(tag => (
                            <button
                                key={tag.id}
                                type="button"
                                onClick={() => setFilterTagId(prev => prev === String(tag.id) ? null : String(tag.id))}
                                className={filterTagId === String(tag.id) ? 'tv2-btn-primary tv2-btn-xs' : 'tv2-btn-ghost tv2-btn-xs'}
                                style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}
                            >
                                {tag.emoji && <span>{tag.emoji}</span>}
                                {tag.name}
                                {filterTagId === String(tag.id) && <X size={10} />}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {subscribed !== null && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    fontSize: 11,
                    color: subscribed ? 'var(--tv2-brand)' : 'var(--tv2-text-secondary)',
                    borderBottom: '1px solid var(--tv2-border)',
                    background: subscribed ? 'var(--tv2-brand-bg, rgba(99,102,241,0.06))' : 'transparent',
                }}>
                    {subscribed
                        ? <><Bell size={11} /> Abonné — vous recevrez des notifications pour les nouveaux posts</>
                        : <><BellOff size={11} /> Non abonné — activez les notifications avec la cloche</>
                    }
                </div>
            )}

            <div className="tv2-forum-content">
                {showForm && (
                    <NewPostForm
                        guildId={guildId}
                        channelId={channel?.id}
                        onCreated={handleCreated}
                        onCancel={() => setShowForm(false)}
                    />
                )}

                {loading ? (
                    <div className="tv2-empty">Chargement…</div>
                ) : displayed.length === 0 && !showForm ? (
                    <div className="tv2-empty">
                        <MessagesSquare size={32} className="tv2-empty-icon" />
                        <p>Aucun post dans ce forum.</p>
                        <small>Créez le premier post avec le bouton +</small>
                    </div>
                ) : (
                    <ul className="tv2-forum-list">
                        {displayed.map((t, _listIdx) => {
                            const isPinned = !!t.threadMetadata?.pinned;
                            const isLocked = !!t.threadMetadata?.locked;
                            const pinnedIdx = pinnedList.findIndex(x => x.id === t.id);

                            const threadReadId = readStateByChannel[String(t.id)];
                            let threadUnread = false;
                            if (t.lastMessageId) {
                                if (!threadReadId) {
                                    threadUnread = true;
                                } else {
                                    try { threadUnread = BigInt(String(t.lastMessageId)) > BigInt(threadReadId); } catch { /* skip */ }
                                }
                            }

                            return (
                                <li key={t.id}
                                    className={['tv2-forum-item', isPinned ? 'is-pinned' : '', isLocked ? 'is-locked' : '', threadUnread ? 'is-unread' : ''].filter(Boolean).join(' ')}
                                    onClick={() => navigate(`/dashboard/tchatv2/guilds/${guildId}/channels/${t.id}`)}
                                    onContextMenu={(e) => openThreadMenu(e, t)}>
                                    {isPinned && canManage && (
                                        <div className="tv2-forum-item-order" onClick={e => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                className="tv2-icon-btn"
                                                title="Monter"
                                                disabled={pinnedIdx === 0}
                                                onClick={e => handleMove(e, t, -1)}
                                            ><ChevronUp size={13} /></button>
                                            <button
                                                type="button"
                                                className="tv2-icon-btn"
                                                title="Descendre"
                                                disabled={pinnedIdx === pinnedList.length - 1}
                                                onClick={e => handleMove(e, t, 1)}
                                            ><ChevronDown size={13} /></button>
                                        </div>
                                    )}

                                    {(function() {
                                        const cover = t.coverImage ?? t.attachments?.[0]?.url ?? null;
                                        return cover ? (
                                            <div className="tv2-forum-item-thumb"><img src={cover} alt="" /></div>
                                        ) : (
                                            <div className="tv2-forum-item-icon"><MessageCircle size={18} /></div>
                                        );
                                    })()}

                                    <div className="tv2-forum-item-body">
                                        <span className="tv2-forum-item-name">
                                            {isPinned && <Pin size={11} style={{ marginRight: 4, opacity: 0.7 }} />}
                                            {isLocked && <Lock size={11} style={{ marginRight: 4, opacity: 0.7 }} />}
                                            {t.name}
                                        </span>
                                        {t.memberCount != null && (
                                            <span className="tv2-forum-item-meta">{t.memberCount} participant{t.memberCount !== 1 ? 's' : ''}</span>
                                        )}
                                    </div>

                                    <div className="tv2-forum-item-side">
                                        {threadUnread && <span className="tv2-forum-unread-dot" title="Messages non lus" />}
                                        <Clock size={12} />
                                        <span>{formatDate(t.createdAt)}</span>

                                        {canManage && (
                                            <div className="tv2-forum-item-actions" onClick={e => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    className={`tv2-icon-btn ${isPinned ? 'is-active' : ''}`}
                                                    title={isPinned ? 'Désépingler' : 'Épingler'}
                                                    onClick={e => handleTogglePin(e, t)}
                                                ><Pin size={13} /></button>
                                                <button
                                                    type="button"
                                                    className={`tv2-icon-btn ${isLocked ? 'is-active' : ''}`}
                                                    title={isLocked ? 'Déverrouiller' : 'Verrouiller'}
                                                    onClick={e => handleToggleLock(e, t)}
                                                >{isLocked ? <Unlock size={13} /> : <Lock size={13} />}</button>
                                                <button
                                                    type="button"
                                                    className="tv2-icon-btn tv2-forum-perm-btn"
                                                    title="Permissions"
                                                    onClick={e => { e.stopPropagation(); setPermThread(t); }}
                                                ><Shield size={13} /></button>
                                                <button
                                                    type="button"
                                                    className="tv2-icon-btn is-danger"
                                                    title="Supprimer"
                                                    onClick={e => handleDelete(e, t)}
                                                ><Trash2 size={13} /></button>
                                            </div>
                                        )}

                                        {!canManage && (
                                            <button
                                                type="button"
                                                className="tv2-icon-btn tv2-forum-item-perm-btn"
                                                title="Permissions"
                                                onClick={e => { e.stopPropagation(); setPermThread(t); }}
                                            ><Shield size={13} /></button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {permThread && (
                <ChannelPermissionsDrawer
                    open={true}
                    onClose={() => setPermThread(null)}
                    guildId={guildId}
                    channel={permThread}
                />
            )}
            {menu && <ContextMenu {...menu} onClose={closeMenu} />}
        </div>
    );
}
