import React, { useEffect, useState } from 'react';
import { useTypingStore } from '../store/useTypingStore';
import { useShallow } from 'zustand/react/shallow';

export default function TypingIndicator({ channelId, currentUserId }) {
    const [, setTick] = useState(0);

    useEffect(() => {
        const t = setInterval(() => {
            useTypingStore.getState().pruneExpired();
            setTick(n => n + 1);
        }, 2000);
        return () => clearInterval(t);
    }, []);

    const typingUsers = useTypingStore(
        useShallow(s => {
            const key = String(channelId);
            const now = Date.now();
            const channel = s.typing[key] ?? {};
            return Object.entries(channel)
                .filter(([uid, v]) => v.expiresAt > now && String(uid) !== String(currentUserId))
                .map(([, v]) => v.userName);
        })
    );

    if (!typingUsers.length) return <div className="h-5" />;

    let text;
    if (typingUsers.length === 1) text = `${typingUsers[0]} est en train d'écrire`;
    else if (typingUsers.length === 2) text = `${typingUsers[0]} et ${typingUsers[1]} écrivent`;
    else text = 'Plusieurs personnes écrivent';

    return (
        <div className="flex items-center gap-1.5 px-4 h-5 text-xs text-cca-textSecondary">
            <span className="flex gap-0.5">
                {[0, 1, 2].map(i => (
                    <span
                        key={i}
                        className="w-1 h-1 rounded-full bg-cca-textSecondary/60 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </span>
            <span className="italic">{text}…</span>
        </div>
    );
}
