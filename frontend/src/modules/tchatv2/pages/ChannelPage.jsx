import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Menu, Pin, MessageCircle, Users, ShieldAlert, Link2, Webhook, Search, Bell, BellOff } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useChannelStore } from '../stores/channelStore';
import { useMessageStore } from '../stores/messageStore';
import { useMemberStore } from '../stores/memberStore';
import { useRoleStore } from '../stores/roleStore';
import { usePresenceStore } from '../stores/presenceStore';
import { useAuth } from '@/contexts/AuthContext';
import { useReadStateStore } from '../stores/readStateStore';
import { fetchMessages, fetchMembers, fetchRoles, fetchPresences, ackRead, fetchReadStates, getPostSubscription, subscribeToPost, unsubscribeFromPost } from '../api/client';
import { useForumPostSubStore } from '../stores/forumPostSubStore';
import { focusChannel, blurChannel } from '../api/socket';
import { hasPerm } from '../lib/permissions';
import VirtualizedMessageList from '../components/MessageList/VirtualizedMessageList';
import Composer from '../components/Composer/Composer';
import PinnedDrawer from '../components/Pin/PinnedDrawer';
import ThreadListDrawer from '../components/Thread/ThreadListDrawer';
import RoleManagerDrawer from '../components/Role/RoleManagerDrawer';
import MemberPanel from '../components/MemberPanel';
import TypingIndicator from '../components/TypingIndicator';
import InviteDrawer from '../components/Invite/InviteDrawer';
import WebhookDrawer from '../components/Webhook/WebhookDrawer';
import ForumPage from './ForumPage';
import ChatSearchPanel from '@/chat/components/ChatSearchPanel';

const EMPTY = [];

export default function ChannelPage({ guildId, isMobile, onOpenChannels }) {
    const { channelId }      = useParams();
    const { user }           = useAuth();
    const setActive          = useChannelStore(s => s.setActiveChannelId);
    const markRead           = useChannelStore(s => s.markRead);
    const channelsByGuild    = useChannelStore(s => s.byGuild);
    const messages           = useMessageStore(
        useShallow(s => (s.byChannel[String(channelId)] ?? []).map(id => s.byId[id]).filter(Boolean))
    );
    const pendingByChannel   = useMessageStore(s => s.pendingByChannel);
    const prependMessages    = useMessageStore(s => s.prependMessages);
    const upsertMessage      = useMessageStore(s => s.upsertMessage);
    const setMembers         = useMemberStore(s => s.setMembers);
    const setRoles           = useRoleStore(s => s.setRoles);
    const setBulkStatuses    = usePresenceStore(s => s.setBulkStatuses);

    const [loading, setLoading]     = useState(false);
    const [hasMore, setHasMore]     = useState(true);
    const [replyTo, setReplyTo]     = useState(null);
    const [firstUnreadId, setFirstUnreadId] = useState(null);
    const [pinsOpen, setPinsOpen]   = useState(false);
    const [threadsOpen, setThreads] = useState(false);
    const [rolesOpen, setRolesOpen] = useState(false);
    const [membersOpen, setMembersOpen] = useState(() =>
        typeof window !== 'undefined' && window.innerWidth >= 1024
    );
    const [inviteOpen, setInviteOpen]   = useState(false);
    const [webhookOpen, setWebhookOpen] = useState(false);
    const [searchOpen, setSearchOpen]   = useState(false);
    const [postSubscribed, setPostSubscribed]   = useState(false);
    const [postSubLoading, setPostSubLoading]   = useState(false);
    const [subVersion, setSubVersion]           = useState(0);
    const addPost    = useForumPostSubStore(s => s.addPost);
    const removePost = useForumPostSubStore(s => s.removePost);
    const oldestIdRef               = useRef(null);

    useEffect(() => {
        if (!channelId) return;
        const controller = new AbortController();

        setActive(channelId);
        focusChannel(channelId, guildId);
        oldestIdRef.current = null;
        setHasMore(true);
        setReplyTo(null);

        // Capture read state BEFORE markRead — used for "nouveaux messages" divider
        const prevLastRead = useChannelStore.getState().readStateByChannel[String(channelId)] ?? null;
        setFirstUnreadId(prevLastRead);

        setLoading(true);
        fetchMessages(guildId, channelId, { limit: 20 }, { signal: controller.signal })
            .then(msgs => {
                msgs.forEach(m => upsertMessage(channelId, m));
                if (msgs.length < 20) setHasMore(false);
                if (msgs.length > 0) {
                    oldestIdRef.current = msgs[0].id;
                    const lastId = String(msgs[msgs.length - 1].id);
                    ackRead(guildId, channelId, lastId).catch(() => {});
                }
                markRead(channelId);
            })
            .catch((err) => { if (err?.code === 'ERR_CANCELED') return; })
            .finally(() => setLoading(false));

        fetchMembers(guildId, { channelId }).then(ms => setMembers(guildId, ms ?? [])).catch(() => {});
        fetchRoles(guildId).then(rs => setRoles(guildId, rs ?? [])).catch(() => {});
        fetchReadStates(guildId, channelId).then(states => {
            useReadStateStore.getState().setChannelReadStates(channelId, states ?? []);
        }).catch(() => {});
        fetchPresences(guildId).then(ps => {
            // Exclude own presence — managed locally to avoid race with socket registration
            const filtered = (ps ?? []).filter(p => String(p.userId) !== String(user?.id));
            setBulkStatuses(filtered);
        }).catch(() => {});

        return () => { controller.abort(); blurChannel(channelId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId, guildId]);

    const handleLoadMore = useCallback(async () => {
        if (loading || !hasMore || !oldestIdRef.current) return;
        setLoading(true);
        try {
            const msgs = await fetchMessages(guildId, channelId, { limit: 20, before: oldestIdRef.current });
            prependMessages(channelId, msgs);
            if (msgs.length < 20) setHasMore(false);
            if (msgs.length > 0) oldestIdRef.current = msgs[0].id;
        } catch { /* intentional */ }
        finally { setLoading(false); }
    }, [channelId, guildId, loading, hasMore, prependMessages]);

    const handleJumpTo = useCallback((messageId) => {
        const node = document.querySelector(`[data-message-id="${messageId}"]`);
        if (node) {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            node.classList.add('tv2-flash');
            setTimeout(() => node.classList.remove('tv2-flash'), 1500);
        }
    }, []);

    const handleTogglePostSubscription = async () => {
        if (postSubLoading) return;
        setPostSubLoading(true);
        try {
            if (postSubscribed) {
                await unsubscribeFromPost(guildId, channelId);
                setPostSubscribed(false);
                removePost(guildId, channelId);
            } else {
                await subscribeToPost(guildId, channelId);
                setPostSubscribed(true);
                if (channel) {
                    addPost(guildId, {
                        id:            String(channelId),
                        name:          channel.name,
                        parentId:      forumChannelId,
                        lastMessageId: channel.lastMessageId ? String(channel.lastMessageId) : null,
                        type:          channel.type,
                    });
                }
            }
            setSubVersion(v => v + 1);
        } catch { /* intentional */ }
        finally { setPostSubLoading(false); }
    };

    const pending  = pendingByChannel[String(channelId)] ?? EMPTY;
    const channel  = (channelsByGuild[guildId] ?? []).find(c => String(c.id) === String(channelId));
    const channelName = channel?.name ?? channelId;
    const membersRaw = useMemberStore(s => s.byGuild[String(guildId)]);
    const members  = membersRaw ?? EMPTY;
    const myMember = members.find(m => String(m.userId) === String(user?.id));
    const myPerms      = BigInt(myMember?.cachedGuildPermissions ?? 0);
    const canManage    = hasPerm(myPerms, 'MANAGE_MESSAGES');
    const canUseEmojis = hasPerm(myPerms, 'USE_EXTERNAL_EMOJIS');

    const allChannels = (channelsByGuild ?? {})[guildId] ?? [];
    const isForumPost = channel?.type === 11 && !!channel?.parentId &&
        allChannels.some(c => String(c.id) === String(channel.parentId) && c.type === 15);
    const forumChannelId = isForumPost ? String(channel.parentId) : null;

    useEffect(() => {
        if (!isForumPost || !channelId || !guildId) { setPostSubscribed(false); return; }
        getPostSubscription(guildId, channelId)
            .then(data => setPostSubscribed(!!data?.subscribed))
            .catch(() => setPostSubscribed(false));
    }, [isForumPost, channelId, guildId]);

    if (channel?.type === 15) {
        return <ForumPage channel={channel} guildId={guildId} isMobile={isMobile} onOpenChannels={onOpenChannels} />;
    }

    if (!channelId) {
        return <div className="tv2-empty">Sélectionnez un channel</div>;
    }

    return (
        <div className="tv2-main">
            <div className="tv2-header">
                {isMobile && (
                    <button className="tv2-icon-btn tv2-hamburger" onClick={onOpenChannels} aria-label="Ouvrir le menu">
                        <Menu size={20} />
                    </button>
                )}
                <span className="tv2-header-hash">#</span>
                <span className="tv2-header-title">{channelName}</span>
                {channel?.topic && <span className="tv2-header-topic">— {channel.topic}</span>}

                <div className="tv2-header-spacer" />

                <button className={`tv2-icon-btn ${threadsOpen ? 'is-active' : ''}`}
                        onClick={() => setThreads(v => !v)} title="Fils">
                    <MessageCircle size={18} />
                </button>
                <button className={`tv2-icon-btn ${pinsOpen ? 'is-active' : ''}`}
                        onClick={() => setPinsOpen(v => !v)} title="Épinglés">
                    <Pin size={18} />
                </button>
                <button className={`tv2-icon-btn tv2-header-hide-mobile ${inviteOpen ? 'is-active' : ''}`}
                        onClick={() => setInviteOpen(v => !v)} title="Invitations">
                    <Link2 size={18} />
                </button>
                <button className={`tv2-icon-btn tv2-header-hide-mobile ${webhookOpen ? 'is-active' : ''}`}
                        onClick={() => setWebhookOpen(v => !v)} title="Webhooks">
                    <Webhook size={18} />
                </button>
                <button className={`tv2-icon-btn ${searchOpen ? 'is-active' : ''}`}
                        onClick={() => setSearchOpen(v => !v)} title="Recherche">
                    <Search size={18} />
                </button>
                <button className={`tv2-icon-btn tv2-header-hide-mobile ${rolesOpen ? 'is-active' : ''}`}
                        onClick={() => setRolesOpen(v => !v)} title="Roles">
                    <ShieldAlert size={18} />
                </button>
                <button className={`tv2-icon-btn ${membersOpen ? 'is-active' : ''}`}
                        onClick={() => setMembersOpen(v => !v)} title="Membres">
                    <Users size={18} />
                </button>
                {isForumPost && (
                    <button
                        className={`tv2-icon-btn ${postSubscribed ? 'is-active' : ''}`}
                        onClick={handleTogglePostSubscription}
                        disabled={postSubLoading}
                        title={postSubscribed ? 'Ne plus suivre ce post' : 'Suivre ce post'}
                    >
                        {postSubscribed ? <Bell size={18} /> : <BellOff size={18} />}
                    </button>
                )}
            </div>

            <div className="tv2-main-row">
                <div className="tv2-main-col">
                    <VirtualizedMessageList
                        messages={messages}
                        pendingMessages={pending}
                        onLoadMore={handleLoadMore}
                        hasMore={hasMore}
                        loading={loading}
                        guildId={guildId}
                        channelId={channelId}
                        canManage={canManage}
                        canUseEmojis={canUseEmojis}
                        onReplyTo={setReplyTo}
                        onJumpTo={handleJumpTo}
                        firstUnreadId={firstUnreadId}
                    />
                    <TypingIndicator guildId={guildId} channelId={channelId} />
                    <Composer
                        channelId={channelId}
                        guildId={guildId}
                        replyTo={replyTo}
                        onClearReply={() => setReplyTo(null)}
                        userPerms={myPerms}
                    />
                </div>

                {pinsOpen && (
                    <PinnedDrawer
                        open={pinsOpen}
                        onClose={() => setPinsOpen(false)}
                        guildId={guildId}
                        channelId={channelId}
                        canManage={canManage}
                        onJumpTo={handleJumpTo}
                    />
                )}
                {threadsOpen && (
                    <ThreadListDrawer
                        open={threadsOpen}
                        onClose={() => setThreads(false)}
                        guildId={guildId}
                        channelId={channelId}
                    />
                )}
                {membersOpen && (
                    <MemberPanel
                        open={membersOpen}
                        onClose={() => setMembersOpen(false)}
                        guildId={guildId}
                        isForumPost={isForumPost}
                        threadId={isForumPost ? channelId : undefined}
                        subVersion={subVersion}
                    />
                )}
                {inviteOpen && (
                    <InviteDrawer
                        open={inviteOpen}
                        onClose={() => setInviteOpen(false)}
                        guildId={guildId}
                        channelId={channelId}
                        channelName={channelName}
                    />
                )}
                {webhookOpen && (
                    <WebhookDrawer
                        open={webhookOpen}
                        onClose={() => setWebhookOpen(false)}
                        guildId={guildId}
                        channelId={channelId}
                        channelName={channelName}
                    />
                )}
                {searchOpen && (
                    <ChatSearchPanel
                        guildId={guildId}
                        channels={channelsByGuild[guildId] ?? []}
                        onClose={() => setSearchOpen(false)}
                        onJumpToChannel={(chanId, msgId) => {
                            handleJumpTo(msgId);
                            setSearchOpen(false);
                        }}
                    />
                )}
            </div>

            <RoleManagerDrawer
                open={rolesOpen}
                onClose={() => setRolesOpen(false)}
                guildId={guildId}
            />
        </div>
    );
}
