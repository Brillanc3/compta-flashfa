import React from 'react';
import { useTypingStore } from '../stores/typingStore';
import { useMemberStore } from '../stores/memberStore';

const EMPTY = [];

function nameFor(member, userId) {
    if (!member) return null;
    return member.nickname || member.user?.name || member.user?.username || String(userId);
}

export default function TypingIndicator({ guildId, channelId }) {
    const userIds = useTypingStore(s => s.byChannel[String(channelId)] || EMPTY);
    const members = useMemberStore(s => s.byGuild[String(guildId)] || EMPTY);

    if (userIds.length === 0) return null;

    const names = userIds
        .map(uid => nameFor(members.find(m => String(m.userId) === String(uid)), uid))
        .filter(Boolean);

    if (names.length === 0) return null;

    let text;
    if (names.length === 1) {
        text = <><strong>{names[0]}</strong> est en train d'écrire…</>;
    } else if (names.length === 2) {
        text = <><strong>{names[0]}</strong> et <strong>{names[1]}</strong> sont en train d'écrire…</>;
    } else if (names.length === 3) {
        text = <><strong>{names[0]}</strong>, <strong>{names[1]}</strong> et <strong>{names[2]}</strong> sont en train d'écrire…</>;
    } else {
        text = <>Plusieurs personnes sont en train d'écrire…</>;
    }

    return (
        <div className="tv2-typing-indicator" aria-live="polite">
            <span className="tv2-typing-dots"><span /><span /><span /></span>
            <span className="tv2-typing-text">{text}</span>
        </div>
    );
}
