import React, { useState, useRef } from 'react';
import { Smile, Reply, Edit3, Pin, MessageSquarePlus, Trash2 } from 'lucide-react';
import { EmojiPopover } from './ReactionBar';
import { addReaction } from '../../api/client';
import { useMessageStore } from '../../stores/messageStore';
import { useAuth } from '@/contexts/AuthContext';

export default function MessageActions({
    message, guildId, isOwn, canManage,
    onReply, onEdit, onPin, onThread, onDelete,
}) {
    const [picking, setPicking] = useState(false);
    const anchorRef = useRef(null);
    const { user } = useAuth();
    const applyReact = useMessageStore(s => s.applyReactionUpdate);

    const react = async (emoji) => {
        const reactions = Array.isArray(message.reactions) ? message.reactions : [];
        const already = reactions.find(r => r.emoji === emoji);
        const optimistic = already
            ? reactions.map(r => r.emoji === emoji ? { ...r, count: (r.count ?? 0) + 1 } : r)
            : [...reactions, { emoji, count: 1 }];
        applyReact(message.channelId, message.id, optimistic, emoji, user?.id, user?.id, 'add');
        try {
            await addReaction(guildId, message.channelId, message.id, emoji);
        } catch {
            applyReact(message.channelId, message.id, reactions, emoji, user?.id, user?.id, 'remove');
        }
    };

    return (
        <div className="tv2-msg-actions">
            <div className="tv2-msg-actions-bar">
                <button ref={anchorRef} type="button" className="tv2-msg-act" title="Réagir"
                        onClick={() => setPicking(v => !v)}>
                    <Smile size={16} />
                </button>
                <button type="button" className="tv2-msg-act" title="Répondre" onClick={() => onReply?.(message)}>
                    <Reply size={16} />
                </button>
                {isOwn && (
                    <button type="button" className="tv2-msg-act" title="Modifier" onClick={() => onEdit?.(message)}>
                        <Edit3 size={16} />
                    </button>
                )}
                {canManage && (
                    <button type="button" className="tv2-msg-act" title={message.pinned ? 'Désépingler' : 'Épingler'}
                            onClick={() => onPin?.(message)}>
                        <Pin size={16} className={message.pinned ? 'is-on' : ''} />
                    </button>
                )}
                <button type="button" className="tv2-msg-act" title="Créer un fil" onClick={() => onThread?.(message)}>
                    <MessageSquarePlus size={16} />
                </button>
                {(isOwn || canManage) && (
                    <button type="button" className="tv2-msg-act is-danger" title="Supprimer"
                            onClick={() => onDelete?.(message)}>
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
            {picking && (
                <div className="tv2-msg-emoji-anchor">
                    <EmojiPopover anchorRef={anchorRef} onPick={react} onClose={() => setPicking(false)} />
                </div>
            )}
        </div>
    );
}
