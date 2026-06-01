import React, { memo, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pin, MessageCircle, Reply, Edit3, MessageSquarePlus, Trash2, Copy, Fingerprint } from 'lucide-react';
import { renderMentionContent } from '../Message/MentionChip';
import EditMessageInline from '../Message/EditMessageInline';
import ReactionBar from '../Message/ReactionBar';
import MessageActions from '../Message/MessageActions';
import ConfirmModal from '../Modal/ConfirmModal';
import CreateThreadModal from '../Thread/CreateThreadModal';
import ContextMenu from '../ContextMenu/ContextMenu';
import MessageEditHistoryModal from '../Message/MessageEditHistoryModal';
import MemberProfilePopup from '../MemberProfilePopup';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useMemberStore } from '../../stores/memberStore';
import { useRoleStore } from '../../stores/roleStore';
import { useChannelStore } from '../../stores/channelStore';
import { useMessageStore } from '../../stores/messageStore';
import { useGuildEmojiStore } from '../../stores/guildEmojiStore';
import { useAuth } from '@/contexts/AuthContext';
import { deleteMessage, deleteDmMessage, pinMessage, unpinMessage } from '../../api/client';
import PollDisplay from '@/chat/components/PollDisplay';
import InviteEmbed from '../Message/InviteEmbed';

const EMPTY_ARR = [];

const PRESENCE_COLORS = {
    online:  '#22c55e',
    idle:    '#eab308',
    dnd:     '#ef4444',
    offline: '#94a3b8',
};

function formatTime(ts) {
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
}

function ReadByIndicator({ readBy, members }) {
    if (!readBy || readBy.length === 0) return null;
    const MAX_SHOWN = 5;
    const shown = readBy.slice(0, MAX_SHOWN);
    const extra = readBy.length - MAX_SHOWN;
    return (
        <div className="tv2-read-by" title={`Vu par ${readBy.length} membre${readBy.length > 1 ? 's' : ''}`}>
            {shown.map((uid) => {
                const member = members.find(m => String(m.id) === String(uid));
                const name = member?.nickname || member?.username || uid;
                const avatarUrl = member?.avatarHash
                    ? `/avatars/${member.avatarHash}`
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=5474A0&color=fff&size=32`;
                return (
                    <img
                        key={uid}
                        src={avatarUrl}
                        alt={name}
                        title={name}
                        className="tv2-read-by-avatar"
                    />
                );
            })}
            {extra > 0 && <span className="tv2-read-by-extra">+{extra}</span>}
        </div>
    );
}

function MessageItem({ message, compact = false, presenceStatus, guildId, canManage = false, canUseEmojis = true, onReplyTo, onJumpTo, readBy = [], isNew = false }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [editing, setEditing]     = useState(false);
    const [confirmDel, setCDel]     = useState(false);
    const [threadOpen, setThread]   = useState(false);
    const [showHistory, setHistory] = useState(false);
    const [popup, setPopup]         = useState(null);
    const [lightboxUrl, setLightboxUrl] = useState(null);
    const { menu, openMenu, closeMenu } = useContextMenu();

    const members  = useMemberStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const roles    = useRoleStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const channels = useChannelStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const tombstoneInStore = useMessageStore(s => s.tombstoneMessage);
    const guildEmojis     = useGuildEmojiStore(s => s.byGuild[String(guildId)] || EMPTY_ARR);
    const loadGuildEmojis = useGuildEmojiStore(s => s.load);

    useEffect(() => {
        if (guildId) loadGuildEmojis(guildId);
    }, [guildId, loadGuildEmojis]);

    const isOwn        = String(message.authorId) === String(user?.id);
    const isWebhook    = !!(message.flags & 64);
    const isMentioned  = !!message.content && (
        message.content.includes(`<@${user?.id}>`) ||
        message.content.includes('@everyone') ||
        message.content.includes('@here')
    );

    const { authorUsername, authorNickname, authorAvatarHash, content, createdAt, editedAt, failed, pinned, threadId } = message;
    const authorMember = !isWebhook ? members.find(m => String(m.userId ?? m.id) === String(message.authorId)) : null;
    const displayName = isWebhook
        ? (authorUsername || 'Webhook')
        : (authorNickname || authorMember?.user?.name || authorUsername || '?');
    const topRole = authorMember?.roleIds
        ?.map(id => roles.find(r => String(r.id) === String(id)))
        .filter(Boolean)
        .find(r => r.hoist) ?? null;
    const nameColor = topRole?.color ? '#' + topRole.color.toString(16).padStart(6, '0') : undefined;

    const handleAuthorClick = useCallback((e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        if (isWebhook) {
            const syntheticMember = {
                id: message.authorId,
                userId: message.authorId,
                avatarHash: authorAvatarHash || null,
                user: { name: authorUsername || 'Webhook', username: authorUsername || 'webhook' },
                roleIds: [],
            };
            setPopup(prev => prev ? null : { member: syntheticMember, rect, isBot: true });
            return;
        }
        if (!authorMember) return;
        setPopup(prev => prev ? null : { member: authorMember, rect });
    }, [authorMember, isWebhook, message.authorId, authorAvatarHash, authorUsername]);
    const avatarUrl   = authorAvatarHash
        ? `/avatars/${authorAvatarHash}`
        : authorMember?.user?.imageUrl
            ? authorMember.user.imageUrl
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=5474A0&color=fff&size=80`;

    const handleDelete = async () => {
        if (guildId) await deleteMessage(guildId, message.channelId, message.id);
        else         await deleteDmMessage(message.channelId, message.id);
        tombstoneInStore(message.channelId, message.id);
    };
    const handlePin = async () => {
        if (message.pinned) await unpinMessage(guildId, message.channelId, message.id);
        else                await pinMessage(guildId, message.channelId, message.id);
    };

    const buildMsgItems = () => {
        const its = [];
        its.push({ icon: <Reply size={14} />, text: 'Répondre', action: () => onReplyTo?.(message) });
        if (isOwn) its.push({ icon: <Edit3 size={14} />, text: 'Modifier', action: () => setEditing(true) });
        if (canManage) its.push({
            icon: <Pin size={14} />,
            text: message.pinned ? 'Désépingler' : 'Épingler',
            action: handlePin,
        });
        its.push({ icon: <MessageSquarePlus size={14} />, text: 'Créer un fil', action: () => setThread(true) });
        its.push({ type: 'separator' });
        its.push({ icon: <Copy size={14} />, text: 'Copier le texte', disabled: !content, action: () => navigator.clipboard.writeText(content ?? '') });
        its.push({ icon: <Fingerprint size={14} />, text: "Copier l'ID", action: () => navigator.clipboard.writeText(String(message.id)) });
        if (isOwn || canManage) {
            its.push({ type: 'separator' });
            its.push({ icon: <Trash2 size={14} />, text: 'Supprimer le message', danger: true, action: () => setCDel(true) });
        }
        return its;
    };

    const cls = [
        'tv2-message',
        compact ? 'is-compact' : '',
        failed ? 'is-failed' : '',
        isMentioned ? 'is-mentioned' : '',
        pinned ? 'is-pinned' : '',
        isNew ? 'is-new-msg' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={cls} data-message-id={message.id} onContextMenu={e => !editing && openMenu(e, buildMsgItems())}>
            {!compact ? (
                <div className="tv2-message-avatar">
                    <img src={avatarUrl} alt={displayName} />
                    {presenceStatus && (
                        <span className="tv2-message-presence"
                              style={{ background: PRESENCE_COLORS[presenceStatus] ?? PRESENCE_COLORS.offline }} />
                    )}
                </div>
            ) : (
                <div className="tv2-message-spacer">
                    <span className="tv2-message-time-compact">{formatTime(createdAt)}</span>
                </div>
            )}

            <div className="tv2-message-body">
                {!compact && (
                    <div className="tv2-message-meta">
                        <span
                            className="tv2-message-author"
                            style={nameColor ? { color: nameColor, cursor: 'pointer' } : { cursor: 'pointer' }}
                            onClick={handleAuthorClick}
                        >{displayName}</span>
                        {isWebhook && <span className="tv2-tag" style={{ verticalAlign: 'middle' }}>Webhook</span>}
                        <span className="tv2-message-time">{formatTime(createdAt)}</span>
                        {pinned && <span className="tv2-message-flag"><Pin size={11} /> épinglé</span>}
                    </div>
                )}

                {message.replyTo && (() => {
                    const replyDeleted = Boolean(message.replyTo.deletedAt);
                    return (
                        <button
                            type="button"
                            className="tv2-reply-preview"
                            onClick={() => !replyDeleted && onJumpTo?.(message.replyTo.id)}
                            style={replyDeleted ? { cursor: 'default' } : undefined}
                        >
                            {!replyDeleted && (
                                <span className="tv2-reply-author">{message.replyTo.authorNickname ?? message.replyTo.authorUsername ?? 'auteur'}</span>
                            )}
                            <span className="tv2-reply-text">
                                {replyDeleted ? '[Message d\'origine supprimé]' : (message.replyTo.content ?? '').slice(0, 80)}
                            </span>
                        </button>
                    );
                })()}

                {editing ? (
                    <EditMessageInline message={message} guildId={guildId} onCancel={() => setEditing(false)} />
                ) : (
                    <div className="tv2-message-content">
                        {renderMentionContent(content, {
                            members, roles, channels, emojis: guildEmojis, canUseEmojis,
                            onChannelClick: (chId) => navigate(`/dashboard/tchatv2/guilds/${guildId}/channels/${chId}`),
                        })}
                        {editedAt && (
                            <button
                                type="button"
                                className="tv2-message-edited tv2-message-edited--inline"
                                onClick={() => setHistory(true)}
                                title="Voir l'historique des modifications"
                            >
                                (modifié)
                            </button>
                        )}
                        {failed && (
                            <span className="tv2-msg-failed">
                                Échec — <button className="tv2-msg-retry" onClick={message.retry}>Réessayer</button>
                            </span>
                        )}
                    </div>
                )}

                {message.embeds?.length > 0 && !editing && (
                    <div className="tv2-embeds">
                        {message.embeds.map((embed) => {
                            const raw = (() => { try { return embed.rawJson ? JSON.parse(embed.rawJson) : null; } catch { return null; } })();
                            const fields = raw?.fields ?? [];
                            const footerIconUrl = raw?.footer?.icon_url || null;
                            const authorIconUrl = raw?.author?.icon_url || null;
                            const colorBar = typeof embed.color === 'number'
                                ? `#${embed.color.toString(16).padStart(6, '0')}`
                                : 'rgb(var(--chat-accent))';
                            return (
                                <div key={String(embed.id)} className="tv2-embed" style={{ borderLeftColor: colorBar }}>
                                    {embed.authorName && (
                                        <div className="tv2-embed-author">
                                            {authorIconUrl && <img src={authorIconUrl} alt="" className="tv2-embed-author-icon" />}
                                            {embed.authorUrl
                                                ? <a href={embed.authorUrl} target="_blank" rel="noopener noreferrer" className="tv2-embed-author-name">{embed.authorName}</a>
                                                : <span className="tv2-embed-author-name">{embed.authorName}</span>
                                            }
                                        </div>
                                    )}
                                    {embed.title && (
                                        embed.url
                                            ? <a href={embed.url} target="_blank" rel="noopener noreferrer" className="tv2-embed-title">{embed.title}</a>
                                            : <div className="tv2-embed-title">{embed.title}</div>
                                    )}
                                    {embed.description && <div className="tv2-embed-description">{embed.description}</div>}
                                    {fields.length > 0 && (
                                        <div className="tv2-embed-fields">
                                            {fields.map((f, i) => (
                                                <div key={i} className={`tv2-embed-field${f.inline ? ' is-inline' : ''}`}>
                                                    <div className="tv2-embed-field-name">{f.name}</div>
                                                    <div className="tv2-embed-field-value">{f.value}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {embed.imageUrl && (
                                        <img src={embed.imageUrl} alt="" className="tv2-embed-image" loading="lazy" />
                                    )}
                                    {embed.thumbnailUrl && (
                                        <img src={embed.thumbnailUrl} alt="" className="tv2-embed-thumbnail" loading="lazy" />
                                    )}
                                    {(embed.footerText || raw?.timestamp) && (
                                        <div className="tv2-embed-footer">
                                            {footerIconUrl && <img src={footerIconUrl} alt="" className="tv2-embed-footer-icon" />}
                                            {embed.footerText && <span>{embed.footerText}</span>}
                                            {embed.footerText && raw?.timestamp && <span className="tv2-embed-footer-sep">•</span>}
                                            {raw?.timestamp && <span>{new Date(raw.timestamp).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {!editing && <InviteEmbed content={content} />}

                {message.poll && !editing && (
                    <PollDisplay poll={message.poll} guildId={guildId} />
                )}

                {message.attachments?.length > 0 && (
                    <div className="tv2-attachments">
                        {message.attachments.map(att => (
                            att.contentType?.startsWith('image/') ? (
                                <div key={att.id} className="tv2-attachment-img-wrap" onClick={() => setLightboxUrl(att.url)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setLightboxUrl(att.url)}>
                                    <img src={att.url} alt={att.filename} className="tv2-attachment-img" loading="lazy" />
                                </div>
                            ) : (
                                <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="tv2-attachment-file">
                                    {att.filename}
                                </a>
                            )
                        ))}
                    </div>
                )}

                <ReactionBar message={message} guildId={guildId} currentUserId={user?.id} />

                <ReadByIndicator readBy={readBy} members={members} />

                {threadId && (
                    <button type="button" className="tv2-thread-link" onClick={() => onJumpTo?.(threadId)}>
                        <MessageCircle size={13} /> Voir le fil
                    </button>
                )}
            </div>

            {!editing && !message.isPending && (
                <MessageActions
                    message={message}
                    guildId={guildId}
                    isOwn={isOwn}
                    canManage={canManage}
                    onReply={onReplyTo}
                    onEdit={() => setEditing(true)}
                    onPin={handlePin}
                    onThread={() => setThread(true)}
                    onDelete={() => setCDel(true)}
                />
            )}

            <ConfirmModal
                open={confirmDel}
                onClose={() => setCDel(false)}
                onConfirm={handleDelete}
                title="Supprimer le message ?"
                body="Le message sera supprimé pour tout le monde. Cette action est définitive."
                confirmLabel="Supprimer"
                preview={String(content ?? '').slice(0, 280)}
            />
            <CreateThreadModal
                open={threadOpen}
                onClose={() => setThread(false)}
                guildId={guildId}
                channelId={message.channelId}
                messageId={message.id}
                seedName={(content ?? '').slice(0, 60) || 'Discussion'}
            />
            {menu && <ContextMenu {...menu} onClose={closeMenu} />}
            {showHistory && (
                <MessageEditHistoryModal
                    guildId={guildId}
                    channelId={message.channelId}
                    messageId={message.id}
                    onClose={() => setHistory(false)}
                />
            )}
            {popup && (
                <MemberProfilePopup
                    member={popup.member}
                    guildId={guildId}
                    anchorRect={popup.rect}
                    onClose={() => setPopup(null)}
                    isBot={popup.isBot ?? false}
                />
            )}
            {lightboxUrl && (
                <div className="tv2-lightbox" onClick={() => setLightboxUrl(null)} role="dialog" aria-modal="true">
                    <img src={lightboxUrl} alt="" className="tv2-lightbox-img" onClick={e => e.stopPropagation()} />
                    <button className="tv2-lightbox-close" onClick={() => setLightboxUrl(null)} aria-label="Fermer">×</button>
                </div>
            )}
        </div>
    );
}

export default memo(MessageItem);
