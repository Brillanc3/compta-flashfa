import React from 'react';

export default function MentionChip({ kind, label, color, onClick }) {
    const tone = kind === 'everyone' ? 'is-everyone'
              : kind === 'role'     ? 'is-role'
              : kind === 'channel'  ? 'is-channel'
              : 'is-user';
    const style = (kind === 'role' && color) ? { color: `#${color.toString(16).padStart(6, '0')}` } : undefined;
    const prefix = kind === 'channel' ? '#' : '@';
    return (
        <span
            className={`tv2-mention ${tone}${onClick ? ' is-link' : ''}`}
            style={style}
            onClick={onClick}
        >
            {prefix}{label}
        </span>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function renderMentionContent(content, { members = [], roles = [], channels = [], emojis = [], canUseEmojis = true, onChannelClick } = {}) {
    if (!content) return null;
    const out = [];
    const RE = /<@&(\d+)>|<@!?(\d+)>|<#(\d+)>|<:([^:>]+):(\d+)>|@everyone|@here/g;
    let last = 0;
    let m;
    let i = 0;
    while ((m = RE.exec(content)) !== null) {
        if (m.index > last) out.push(<span key={`t${i++}`}>{content.slice(last, m.index)}</span>);
        if (m[0] === '@everyone' || m[0] === '@here') {
            out.push(<MentionChip key={`e${i++}`} kind="everyone" label={m[0].slice(1)} />);
        } else if (m[1]) {
            const role = roles.find(r => String(r.id) === m[1]);
            out.push(<MentionChip key={`r${i++}`} kind="role" label={role?.name ?? m[1]} color={role?.color} />);
        } else if (m[2]) {
            const member = members.find(mb => String(mb.userId ?? mb.id) === m[2]);
            const name = member?.nickname || member?.user?.name || member?.user?.username || m[2];
            out.push(<MentionChip key={`u${i++}`} kind="user" label={name} />);
        } else if (m[3]) {
            const ch = channels.find(c => String(c.id) === m[3]);
            const chLabel = ch?.name ?? 'Inconnu';
            const chClick = ch && onChannelClick ? () => onChannelClick(m[3]) : undefined;
            out.push(<MentionChip key={`c${i++}`} kind="channel" label={chLabel} onClick={chClick} />);
        } else if (m[4]) {
            const emojiName = m[4];
            const emojiId   = m[5];
            const emoji = canUseEmojis ? emojis.find(e => String(e.id) === emojiId) : null;
            if (emoji) {
                out.push(
                    <img
                        key={`ce${i++}`}
                        src={emoji.url}
                        alt={`:${emojiName}:`}
                        title={`:${emojiName}:`}
                        className="tv2-custom-emoji"
                    />
                );
            } else {
                out.push(<span key={`ce${i++}`} className="tv2-custom-emoji-fallback">:{emojiName}:</span>);
            }
        }
        last = m.index + m[0].length;
    }
    if (last < content.length) out.push(<span key={`t${i++}`}>{content.slice(last)}</span>);
    return out;
}
