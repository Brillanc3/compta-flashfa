import React, { memo, useState } from 'react';
import { Edit3, Trash2, Reply, Pin, Smile, ImageOff, RotateCcw } from 'lucide-react';
import { ReactionBar, QuickReactPicker } from './MessageReactions';
import { useChatStore } from '../store/useChatStore';
import MessageEditHistoryModal from './MessageEditHistoryModal';
import PollDisplay from './PollDisplay';

// <@&rankId>  <@userId>  @everyone
const MENTION_TOKEN_RE = /<@&(\d+)>|<@(\d+)>|@everyone/g;

function MentionChip({ token, members, ranks }) {
    if (token === '@everyone') {
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold text-xs">@everyone</span>;
    }
    const rankMatch = token.match(/^<@&(\d+)>$/);
    if (rankMatch) {
        const rank = (ranks ?? []).find(r => String(r.id) === rankMatch[1]);
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-semibold text-xs">@{rank?.name ?? rankMatch[1]}</span>;
    }
    const userMatch = token.match(/^<@(\d+)>$/);
    if (userMatch) {
        const member = (members ?? []).find(m => String(m.id) === userMatch[1]);
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-brand-primary/20 text-brand-primary font-semibold text-xs">@{member?.name ?? userMatch[1]}</span>;
    }
    return <span>{token}</span>;
}

function MessageContent({ content, members, ranks }) {
    if (!content) return null;
    const parts = [];
    let last = 0;
    const re = new RegExp(MENTION_TOKEN_RE.source, 'g');
    let m;
    while ((m = re.exec(content)) !== null) {
        if (m.index > last) parts.push({ type: 'text', v: content.slice(last, m.index) });
        parts.push({ type: 'mention', v: m[0] });
        last = m.index + m[0].length;
    }
    if (last < content.length) parts.push({ type: 'text', v: content.slice(last) });
    return (
        <>
            {parts.map((p, i) =>
                p.type === 'mention'
                    ? <MentionChip key={i} token={p.v} members={members} ranks={ranks} />
                    : <span key={i} className="whitespace-pre-wrap break-words">{p.v}</span>
            )}
        </>
    );
}

function ReplyPreview({ replyTo, onJumpTo }) {
    if (!replyTo) return null;
    const isDeleted = Boolean(replyTo.deletedAt);
    return (
        <div
            className="flex items-center gap-1.5 mb-1 pl-2 border-l-2 border-cca-border/60 text-[11px] text-cca-textSecondary/70 italic cursor-pointer hover:border-brand-primary/60 hover:text-cca-textSecondary transition-colors"
            onClick={() => !isDeleted && onJumpTo?.(replyTo.id)}
            title={isDeleted ? undefined : "Aller au message"}
        >
            {!isDeleted && (
                <span className="font-semibold not-italic text-cca-textSecondary/80">
                    {replyTo.author?.username ?? replyTo.authorName}
                </span>
            )}
            <span className="truncate">
                {isDeleted ? '[Message d\'origine supprimé]' : String(replyTo.content ?? '').slice(0, 80)}
            </span>
        </div>
    );
}

const GROUP_THRESHOLD_MS = 5 * 60 * 1000;

function ImageAttachment({ att, idx, allAttachments, onImageClick }) {
    const [errored, setErrored] = useState(false);

    if (errored) {
        return (
            <div className="rounded-md h-24 bg-cca-surface/50 border border-cca-border/50 flex flex-col items-center justify-center gap-1 text-cca-textSecondary/40 select-none">
                <ImageOff className="w-5 h-5" />
                <span className="text-[10px]">Image introuvable</span>
            </div>
        );
    }

    return (
        <img
            src={att.url}
            alt=""
            loading="lazy"
            className="rounded-md max-h-48 object-contain bg-cca-base cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => onImageClick?.(allAttachments, idx)}
            onError={() => setErrored(true)}
        />
    );
}

const SingleMessage = memo(function SingleMessage({ msg, isFirst, currentUserId, canManage, channelId, onEdit, onDelete, onReply, onPin, onImageClick, onJumpToMessage, members, ranks }) {
    const [quickReact, setQuickReact] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const isSending = msg.status === 'sending';
    const isFailed = msg.status === 'failed';
    const progress = useChatStore((s) => isSending ? (s.uploadProgress[String(msg.id)] ?? 0) : null);
    const retryMessage = useChatStore((s) => s.retryMessage);

    const isOwn = msg.authorId != null && Number(msg.authorId) === Number(currentUserId);
    const editedTitle = msg.editedAt
        ? `Modifié le ${new Date(msg.editedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
        : null;
    const hasText = Boolean(String(msg.content ?? '').trim());
    const attachments = Array.isArray(msg.attachments) ? msg.attachments.filter(a => a?.url) : [];
    const isDeleted = Boolean(msg.deletedAt);
    const isMentioned = !isSending && !isFailed && !isDeleted && msg.content && (
        msg.content.includes(`<@${currentUserId}>`) ||
        msg.content.includes('@everyone')
    );
    const timeStr = new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const authorName = msg.authorName ?? msg.author?.username ?? (isSending || isFailed ? 'Vous' : 'Inconnu');

    return (
        <>
        <div data-message-id={String(msg.id)} className={`group relative flex gap-3 px-2 py-0.5 rounded-sm transition-colors ${
            isFailed
                ? 'bg-red-500/5 border-l-2 border-red-500/40'
                : isSending
                    ? 'opacity-60'
                    : isMentioned
                        ? 'bg-yellow-500/8 border-l-2 border-yellow-400/60 hover:bg-yellow-500/12'
                        : 'hover:bg-white/3'
        }`}>
            <div className="w-10 shrink-0 flex justify-center">
                {isFirst ? (
                    <div className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center bg-brand-primary/10 border border-brand-primary/20 text-[11px] font-bold text-brand-primary select-none">
                        {authorName.slice(0, 2).toUpperCase()}
                    </div>
                ) : (
                    <span className="text-[10px] text-cca-textSecondary/30 opacity-0 group-hover:opacity-100 mt-1 w-8 text-right leading-5">{timeStr}</span>
                )}
            </div>

            <div className="flex-1 min-w-0">
                {isFirst && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-sm font-bold text-cca-textPrimary">{authorName}</span>
                        <span className="text-[11px] text-cca-textSecondary/50">{timeStr}</span>
                        {msg.editedAt && <button type="button" onClick={() => setShowHistory(true)} className="text-[10px] text-cca-textSecondary/40 italic hover:text-cca-textSecondary/70 transition-colors" title={editedTitle}>(modifié)</button>}
                    </div>
                )}

                <ReplyPreview replyTo={msg.replyTo} onJumpTo={onJumpToMessage} />

                {msg.deletedAt ? (
                    <p className="text-sm text-cca-textSecondary/50 italic">[message supprimé]</p>
                ) : hasText && (
                    <div className="text-sm text-cca-textPrimary/90 leading-relaxed">
                        <MessageContent content={msg.content} members={members} ranks={ranks} />
                        {!isFirst && msg.editedAt && (
                            <button type="button" onClick={() => setShowHistory(true)} className="text-[10px] text-cca-textSecondary/40 italic ml-1 hover:text-cca-textSecondary/70 transition-colors" title={editedTitle}>(modifié)</button>
                        )}
                    </div>
                )}

                {!isDeleted && attachments.length > 0 && (
                    <div className={`mt-1 grid ${attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-1.5 max-w-xs`}>
                        {attachments.map((att, idx) => (
                            <ImageAttachment
                                key={att.publicId ?? idx}
                                att={att}
                                idx={idx}
                                allAttachments={attachments}
                                onImageClick={onImageClick}
                            />
                        ))}
                    </div>
                )}

                {!isDeleted && msg.poll && (
                    <PollDisplay poll={msg.poll} guildId={msg.guildId} />
                )}

                {isSending && progress !== null && (
                    <div className="mt-1.5 max-w-xs">
                        <div className="h-0.5 bg-cca-border/40 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-primary/70 transition-all duration-150" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[10px] text-cca-textSecondary/50 mt-0.5 block">Envoi… {progress}%</span>
                    </div>
                )}

                {isFailed && (
                    <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-red-400">Échec de l'envoi</span>
                        <button
                            type="button"
                            onClick={() => retryMessage(channelId, msg.id)}
                            className="flex items-center gap-1 text-xs text-brand-primary hover:underline"
                        >
                            <RotateCcw className="w-3 h-3" /> Réessayer
                        </button>
                    </div>
                )}

                {!isSending && !isFailed && !isDeleted && (
                    <ReactionBar channelId={channelId} messageId={msg.id} reactions={msg.reactions ?? []} />
                )}
            </div>

            {/* Hover toolbar */}
            {!isSending && !isFailed && !isDeleted && <div className="absolute top-0 right-2 opacity-0 group-hover:opacity-100 transition-opacity -translate-y-3 flex items-start">
                <div className="flex items-center gap-0.5 bg-cca-surface border border-cca-border rounded-lg px-1 py-1 shadow-xl">
                    <button type="button" onClick={() => setQuickReact(v => !v)} className="p-1 rounded hover:bg-cca-base text-cca-textSecondary hover:text-yellow-400 transition-colors" title="Réagir">
                        <Smile className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => onReply?.(msg)} className="p-1 rounded hover:bg-cca-base text-cca-textSecondary hover:text-brand-primary transition-colors" title="Répondre">
                        <Reply className="w-4 h-4" />
                    </button>
                    {canManage && (
                        <button type="button" onClick={() => onPin?.(msg)} className="p-1 rounded hover:bg-cca-base text-cca-textSecondary hover:text-yellow-300 transition-colors" title="Épingler">
                            <Pin className="w-4 h-4" />
                        </button>
                    )}
                    {isOwn && (
                        <button type="button" onClick={() => onEdit?.(msg)} className="p-1 rounded hover:bg-cca-base text-cca-textSecondary hover:text-brand-primary transition-colors" title="Modifier">
                            <Edit3 className="w-4 h-4" />
                        </button>
                    )}
                    {(isOwn || canManage) && (
                        <button type="button" onClick={() => onDelete?.(msg.id)} className="p-1 rounded hover:bg-cca-base text-cca-textSecondary hover:text-red-400 transition-colors" title="Supprimer">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
                {quickReact && (
                    <div className="absolute top-full right-0 mt-1 z-10">
                        <QuickReactPicker channelId={channelId} messageId={msg.id} reactions={msg.reactions ?? []} onClose={() => setQuickReact(false)} />
                    </div>
                )}
            </div>}
        </div>
        {showHistory && (
            <MessageEditHistoryModal
                channelId={channelId}
                messageId={String(msg.id)}
                onClose={() => setShowHistory(false)}
            />
        )}
        </>
    );
}, (a, b) =>
    a.msg.id === b.msg.id &&
    a.msg.content === b.msg.content &&
    a.msg.editedAt === b.msg.editedAt &&
    a.msg.reactions === b.msg.reactions &&
    a.msg.status === b.msg.status &&
    a.isFirst === b.isFirst &&
    a.canManage === b.canManage &&
    a.currentUserId === b.currentUserId
);

// eslint-disable-next-line react-refresh/only-export-components
export function groupMessages(messages) {
    const groups = [];
    let current = null;
    for (const msg of messages) {
        const ts = new Date(msg.createdAt).getTime();
        if (
            current &&
            String(current.authorId) === String(msg.authorId ?? msg.author?.id) &&
            ts - current.lastTs < GROUP_THRESHOLD_MS
        ) {
            current.messages.push(msg);
            current.lastTs = ts;
        } else {
            const authorId = msg.authorId ?? msg.author?.id;
            current = { authorId, messages: [msg], lastTs: ts };
            groups.push(current);
        }
    }
    return groups;
}

const MessageGroup = memo(function MessageGroup({ group, currentUserId, canManage, channelId, onEdit, onDelete, onReply, onPin, onImageClick, onJumpToMessage, members, ranks }) {
    return (
        <div className="mb-1">
            {group.messages.map((msg, i) => (
                <SingleMessage
                    key={String(msg.id)}
                    msg={msg}
                    isFirst={i === 0}
                    currentUserId={currentUserId}
                    canManage={canManage}
                    channelId={channelId}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onReply={onReply}
                    onPin={onPin}
                    onImageClick={onImageClick}
                    onJumpToMessage={onJumpToMessage}
                    members={members}
                    ranks={ranks}
                />
            ))}
        </div>
    );
});

export default MessageGroup;
