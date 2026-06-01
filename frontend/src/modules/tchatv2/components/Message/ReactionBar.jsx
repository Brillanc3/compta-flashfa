import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Smile } from 'lucide-react';
import { addReaction, removeReaction } from '../../api/client';
import { useMessageStore } from '../../stores/messageStore';

const QUICK = ['👍', '❤️', '🔥', '😂', '🎉', '😢', '👀', '🚀'];
const POP_W = 270;
const POP_H = 46;
const MARGIN = 8;

function EmojiPopover({ onPick, onClose, anchorRef }) {
    const ref = useRef(null);
    const [pos, setPos] = useState({ left: 0, top: 0, ready: false });

    useLayoutEffect(() => {
        const a = anchorRef?.current;
        if (!a) return;
        const r = a.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // Default: above anchor, aligned to its right edge.
        let top  = r.top - POP_H - 6;
        let left = r.right - POP_W;
        if (top < MARGIN) top = r.bottom + 6;                       // flip down if no space above
        if (top + POP_H > vh - MARGIN) top = vh - POP_H - MARGIN;    // clamp bottom
        if (left < MARGIN) left = MARGIN;                            // clamp left
        if (left + POP_W > vw - MARGIN) left = vw - POP_W - MARGIN;  // clamp right
        setPos({ left, top, ready: true });
    }, [anchorRef]);

    useEffect(() => {
        const onDown = (e) => {
            if (ref.current?.contains(e.target)) return;
            if (anchorRef?.current?.contains(e.target)) return;
            onClose?.();
        };
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        const onScroll = () => onClose?.();
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
    }, [onClose, anchorRef]);

    const node = (
        <div
            ref={ref}
            className="tv2-emoji-pop tv2-emoji-pop--fixed"
            style={{ left: pos.left, top: pos.top, visibility: pos.ready ? 'visible' : 'hidden' }}
            role="dialog"
        >
            {QUICK.map(e => (
                <button key={e} type="button" className="tv2-emoji-btn" onClick={() => { onPick(e); onClose?.(); }}>
                    {e}
                </button>
            ))}
        </div>
    );
    return createPortal(node, document.body);
}

export default function ReactionBar({ message, guildId, currentUserId }) {
    const [picking, setPicking] = useState(false);
    const anchorRef = useRef(null);
    const applyReact = useMessageStore(s => s.applyReactionUpdate);
    const reactions = Array.isArray(message.reactions) ? message.reactions : [];

    const toggle = async (emoji) => {
        const r = reactions.find(x => x.emoji === emoji);
        const mine = r?.users?.some(u => String(u) === String(currentUserId)) || r?.me;
        const action = mine ? 'remove' : 'add';

        // Update optimiste : on applique localement sans attendre le socket
        const optimisticSummary = reactions
            .map(rx => rx.emoji === emoji
                ? action === 'remove'
                    ? { ...rx, count: Math.max(0, (rx.count ?? 1) - 1) }
                    : { ...rx, count: (rx.count ?? 0) + 1 }
                : rx
            )
            .filter(rx => (rx.count ?? 1) > 0);
        if (action === 'add' && !reactions.find(rx => rx.emoji === emoji)) {
            optimisticSummary.push({ emoji, count: 1 });
        }
        applyReact(message.channelId, message.id, optimisticSummary, emoji, currentUserId, currentUserId, action);

        try {
            if (mine) await removeReaction(guildId, message.channelId, message.id, emoji);
            else      await addReaction(guildId, message.channelId, message.id, emoji);
        } catch {
            // rollback : le socket event va corriger, sinon on revert l'optimiste
            applyReact(message.channelId, message.id, reactions, emoji, currentUserId, currentUserId, action === 'add' ? 'remove' : 'add');
        }
    };

    return (
        <div className="tv2-reactions">
            {reactions.map(r => {
                const mine = r.me || r.users?.some(u => String(u) === String(currentUserId));
                return (
                    <button
                        key={r.emoji}
                        type="button"
                        className={`tv2-reaction ${mine ? 'is-mine' : ''}`}
                        onClick={() => toggle(r.emoji)}
                        title={r.emoji}
                    >
                        <span className="tv2-reaction-emoji">{r.emoji}</span>
                        <span className="tv2-reaction-count">{r.count ?? r.users?.length ?? 1}</span>
                    </button>
                );
            })}
            {reactions.length > 0 && (
                <div className="tv2-react-add-wrap">
                    <button
                        ref={anchorRef}
                        type="button"
                        className="tv2-reaction tv2-reaction-add"
                        onClick={() => setPicking(v => !v)}
                        aria-label="Ajouter une réaction"
                    >
                        <Smile size={14} />
                    </button>
                    {picking && <EmojiPopover anchorRef={anchorRef} onPick={toggle} onClose={() => setPicking(false)} />}
                </div>
            )}
        </div>
    );
}

export { EmojiPopover };
