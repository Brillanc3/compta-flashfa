import React, { memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as chatService from '@/services/chatService';
import { useChatStore } from '../store/useChatStore';
import { handleError } from '../utils/errors';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export const ReactionBar = memo(function ReactionBar({ channelId, messageId, reactions = [] }) {
    const { user } = useAuth();
    const addReactionToMessage = useChatStore(s => s.addReactionToMessage);
    const removeReactionFromMessage = useChatStore(s => s.removeReactionFromMessage);

    const handleToggle = async (emoji) => {
        if (!channelId) return;
        const existing = reactions.find(r => r.emoji === emoji);
        const hasReacted = existing?.userIds?.includes(user?.id);
        if (hasReacted) {
            removeReactionFromMessage(channelId, messageId, emoji, user.id);
            chatService.removeReaction(channelId, messageId, emoji).catch(err => handleError(err, 'removeReaction'));
        } else {
            const newCount = (existing?.count ?? 0) + 1;
            addReactionToMessage(channelId, messageId, { emoji, userId: user.id, count: newCount });
            chatService.addReaction(channelId, messageId, emoji).catch(err => handleError(err, 'addReaction'));
        }
    };

    if (!reactions.length) return null;

    return (
        <div className="flex flex-wrap gap-1 mt-1">
            {reactions.map(r => {
                const reacted = r.userIds?.includes(user?.id);
                return (
                    <button
                        key={r.emoji}
                        type="button"
                        onClick={() => handleToggle(r.emoji)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                            reacted
                                ? 'bg-brand-primary/20 border-brand-primary/40 text-brand-primary'
                                : 'bg-cca-surface border-cca-border text-cca-textSecondary hover:bg-cca-base'
                        }`}
                    >
                        <span>{r.emoji}</span>
                        <span className="font-semibold">{r.count}</span>
                    </button>
                );
            })}
        </div>
    );
});

export const QuickReactPicker = memo(function QuickReactPicker({ channelId, messageId, reactions = [], onClose }) {
    const { user } = useAuth();
    const addReactionToMessage = useChatStore(s => s.addReactionToMessage);

    const handleReact = async (emoji) => {
        if (user) {
            const existing = reactions.find(r => r.emoji === emoji);
            const newCount = (existing?.count ?? 0) + 1;
            addReactionToMessage(channelId, messageId, { emoji, userId: user.id, count: newCount });
        }
        try {
            await chatService.addReaction(channelId, messageId, emoji);
        } catch (err) {
            handleError(err, 'quickReact');
        }
        onClose();
    };

    return (
        <div className="flex items-center gap-0.5 px-1 py-1 bg-cca-surface border border-cca-border rounded-lg shadow-lg">
            {QUICK_EMOJIS.map(e => (
                <button
                    key={e}
                    type="button"
                    onClick={() => handleReact(e)}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-cca-base transition-colors text-base"
                >
                    {e}
                </button>
            ))}
        </div>
    );
});
