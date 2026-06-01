import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAudioNotification } from '@/hooks/useAudioNotification';
import { connectSocket, disconnectSocket, focusChannel, blurChannel } from '../api/socket';
import { fetchChannels, fetchMembers } from '../api/client';
import { useSocketStore } from '../stores/socketStore';
import { useMessageStore } from '../stores/messageStore';
import { useChannelStore } from '../stores/channelStore';
import { useGuildStore } from '../stores/guildStore';
import { useMemberStore } from '../stores/memberStore';
import { usePresenceStore } from '../stores/presenceStore';
import { useReadStateStore } from '../stores/readStateStore';
import { useTypingStore } from '../stores/typingStore';
import { useNotifSettingsStore, LEVEL } from '../stores/notifSettingsStore';

export function useV2Socket() {
    const { user, accessToken } = useAuth();
    const navigate     = useNavigate();
    const setConnected = useSocketStore(s => s.setConnected);
    const { play }     = useAudioNotification();
    const upsertMsg      = useMessageStore(s => s.upsertMessage);
    const tombstoneMsg   = useMessageStore(s => s.tombstoneMessage);
    const resolveOpt     = useMessageStore(s => s.resolveOptimistic);
    const applyReact     = useMessageStore(s => s.applyReactionUpdate);
    const applyPollVote  = useMessageStore(s => s.applyPollVote);
    const bumpLastMsg    = useChannelStore(s => s.bumpLastMessage);
    const setMention     = useChannelStore(s => s.setMention);
    const upsertChannel  = useChannelStore(s => s.upsertChannel);
    const guildForChan   = useChannelStore(s => s.guildIdForChannel);
    const setStatus      = usePresenceStore(s => s.setStatus);
    useEffect(() => {
        if (!user || !accessToken) return;

        const socket = connectSocket(accessToken, {
            onConnect: () => {
                setConnected(true);
                socket.emit('PRESENCE_UPDATE', { status: 'online' });
                if (user?.id) setStatus(user.id, 'online');
            },
            onDisconnect: () => setConnected(false),
            onError: (reason) => {
                if (reason === 'auth') {
                    disconnectSocket();
                    navigate('/login');
                }
            },
        });

        socket.on('MESSAGE_CREATE', ({ channelId, message }) => {
            // L'auteur a fini d'écrire → retire son indicateur de frappe
            if (message.authorId != null) {
                useTypingStore.getState().clearTyping(channelId, message.authorId);
            }
            const isOwnMsg = message.nonce && String(message.authorId) === String(user?.id);
            if (message.nonce) {
                resolveOpt(channelId, message.nonce, message);
            } else {
                upsertMsg(channelId, message);
            }
            const guildId = guildForChan(channelId);
            if (guildId && message.id) bumpLastMsg(guildId, channelId, message.id);

            // Audio notifications — skip own messages
            if (!isOwnMsg && message.content) {
                const myId = user?.id;
                const cid  = String(channelId);
                if (message.content.includes('@everyone') || message.content.includes('@here')) {
                    play('mention_everyone', [cid]);
                } else if (myId && message.content.includes(`<@${myId}>`)) {
                    play('mention_user', [cid]);
                } else if (/<@&\d+>/.test(message.content)) {
                    play('mention_rank', [cid]);
                } else {
                    play('message', [cid]);
                }
            }
        });

        socket.on('GUILD_MESSAGE_NOTIFY', ({ channelId, guildId, messageId, mentionedUserIds, mentionedRoleIds, hasMentionEveryone }) => {
            if (guildId && messageId) bumpLastMsg(guildId, channelId, messageId);
            const myId = user?.id;
            const isMentioned =
                hasMentionEveryone ||
                (mentionedUserIds ?? []).some(id => String(id) === String(myId)) ||
                (mentionedRoleIds ?? []).length > 0;

            const { level, isMuted } = useNotifSettingsStore.getState().getSettings(channelId);
            if (isMuted) return;
            if (level === LEVEL.NONE) return;
            if (level === LEVEL.MENTIONS_ONLY && !isMentioned) return;

            if (isMentioned) {
                setMention(channelId);
                // Si mention dans un thread de forum → badge rouge aussi sur le forum parent
                const allChannels = useChannelStore.getState().byGuild;
                for (const chs of Object.values(allChannels)) {
                    const thread = chs.find(c => String(c.id) === String(channelId));
                    if (thread?.parentId) {
                        const parent = chs.find(c => String(c.id) === String(thread.parentId));
                        if (parent?.type === 15) { setMention(String(thread.parentId)); break; }
                    }
                }
            }
        });

        socket.on('FORUM_POST_NOTIFY', ({ forumChannelId, subscriberUserIds }) => {
            const myId = String(user?.id);
            if (!subscriberUserIds.includes(myId)) return;

            const { level, isMuted } = useNotifSettingsStore.getState().getSettings(forumChannelId);
            if (isMuted) return;
            if (level === LEVEL.NONE) return;

            play('message', [forumChannelId]);
            setMention(forumChannelId);
        });

        socket.on('THREAD_MESSAGE_NOTIFY', ({ guildId, forumChannelId, threadId, subscriberUserIds, messageId }) => {
            const myId = String(user?.id);
            if (!subscriberUserIds.includes(myId)) return;

            const { level, isMuted } = useNotifSettingsStore.getState().getSettings(forumChannelId);
            if (isMuted) return;
            if (level === LEVEL.NONE) return;

            setMention(forumChannelId);
            if (threadId) setMention(threadId);
            if (guildId && messageId) {
                bumpLastMsg(guildId, forumChannelId, messageId);
                if (threadId) bumpLastMsg(guildId, threadId, messageId);
            }
        });

        socket.on('MESSAGE_UPDATE', ({ channelId, message }) => {
            upsertMsg(channelId, message);
        });

        socket.on('MESSAGE_DELETE', ({ channelId, messageId }) => {
            tombstoneMsg(channelId, messageId);
        });

        socket.on('PRESENCE_UPDATE', ({ userId, status }) => {
            setStatus(userId, status);
        });

        socket.on('CHANNEL_UPDATE', (channel) => {
            const guildId = guildForChan(String(channel.id)) || (channel.guildId ? String(channel.guildId) : null);
            if (!guildId) return;
            upsertChannel(guildId, channel);

            // Un CHANNEL_UPDATE peut signaler un changement d'overwrites de permissions.
            // La liste des membres est filtrée par VIEW_CHANNEL côté backend ; si le salon
            // modifié est le salon actif (ou sa catégorie parente, dont héritent les enfants),
            // on refetch les membres pour refléter qui peut désormais voir le salon.
            const chanState = useChannelStore.getState();
            const activeId  = chanState.activeChannelId;
            if (!activeId) return;
            const activeChannel = chanState.activeChannel();
            const updatedId     = String(channel.id);
            const isActive    = updatedId === String(activeId);
            const isParentCat = activeChannel?.parentId != null && updatedId === String(activeChannel.parentId);
            if (isActive || isParentCat) {
                fetchMembers(guildId, { channelId: activeId })
                    .then(ms => useMemberStore.getState().setMembers(guildId, ms ?? []))
                    .catch(() => {});
            }
        });

        socket.on('THREAD_CREATE', (thread) => {
            const guildId = thread.guildId ? String(thread.guildId) : null;
            if (guildId) upsertChannel(guildId, thread);
        });

        socket.on('MESSAGE_REACTION_ADD', ({ channelId, messageId, summary, emoji, userId }) => {
            applyReact(channelId, messageId, summary, emoji, userId, user?.id, 'add');
        });

        socket.on('MESSAGE_REACTION_REMOVE', ({ channelId, messageId, summary, emoji, userId }) => {
            applyReact(channelId, messageId, summary, emoji, userId, user?.id, 'remove');
        });

        socket.on('READ_STATE_UPDATE', ({ channelId, userId, lastReadMessageId }) => {
            useReadStateStore.getState().setReadState(channelId, userId, lastReadMessageId);
        });

        socket.on('POLL_VOTE_ADD', ({ pollId, optionIds, userId, counts }) => {
            applyPollVote(pollId, optionIds, userId, counts);
        });

        socket.on('TYPING_START', ({ channelId, userId }) => {
            if (String(userId) === String(user?.id)) return; // ignore soi-même
            useTypingStore.getState().markTyping(channelId, userId);
        });

        socket.on('GUILD_MEMBER_ADD', (member) => {
            const guildId = member?.guildId ? String(member.guildId) : null;
            if (guildId) useMemberStore.getState().upsertMember(guildId, member);
        });

        socket.on('GUILD_MEMBER_REMOVE', ({ guildId, userId }) => {
            if (guildId) useMemberStore.getState().removeMember(guildId, userId);
        });

        socket.on('GUILD_CREATE', (guild) => {
            if (!guild?.id) return;
            useGuildStore.getState().upsertGuild(guild);
            // Récupère les channels pour que la guilde soit utilisable immédiatement
            fetchChannels(guild.id)
                .then(channels => useChannelStore.getState().setChannels(
                    String(guild.id), Array.isArray(channels) ? channels : []))
                .catch(() => {});
        });

        return () => {
            disconnectSocket();
            setConnected(false);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, accessToken]);

    return { focusChannel, blurChannel };
}
