import React, { useEffect, useMemo, useState } from 'react';
import { AtSign, Hash, Users, Megaphone } from 'lucide-react';

/** parsed = { trigger: '@' | '#' | ':', start, end, query } | null */
// eslint-disable-next-line react-refresh/only-export-components
export function parseMentionContext(text, caret) {
    if (caret == null) return null;
    const upTo = text.slice(0, caret);
    const m = upTo.match(/(^|\s)([@#:])([A-Za-z0-9_-]{0,30})$/);
    if (!m) return null;
    const trigger = m[2];
    const query   = m[3] ?? '';
    if (trigger === ':' && query.length < 2) return null;
    const start   = caret - query.length - 1;
    return { trigger, query, start, end: caret };
}

// eslint-disable-next-line react-refresh/only-export-components
export function applyMention(text, ctx, token) {
    if (!ctx) return text;
    return text.slice(0, ctx.start) + token + ' ' + text.slice(ctx.end);
}

export default function MentionPopover({ ctx, members = [], roles = [], channels = [], guildEmojis = [], onPick }) {
    const [idx, setIdx] = useState(0);

    const items = useMemo(() => {
        if (!ctx) return [];
        const q = ctx.query.toLowerCase();
        if (ctx.trigger === ':') {
            return guildEmojis
                .filter(e => e.name.toLowerCase().includes(q))
                .slice(0, 10)
                .map(e => ({
                    kind:  'emoji',
                    id:    String(e.id),
                    label: e.name,
                    url:   e.url,
                    token: `<:${e.name}:${e.id}>`,
                }));
        }
        if (ctx.trigger === '#') {
            return channels
                .filter(c => c.type !== 4 && (c.name ?? '').toLowerCase().includes(q))
                .slice(0, 8)
                .map(c => ({ kind: 'channel', id: c.id, label: c.name, token: `<#${c.id}>` }));
        }
        const memberHits = members
            .filter(m => (m.nickname || m.user?.name || m.user?.username || '').toLowerCase().includes(q))
            .slice(0, 6)
            .map(m => ({
                kind: 'user',
                id:   m.userId ?? m.id,
                label: m.nickname || m.user?.name || m.user?.username,
                token: `<@${m.userId ?? m.id}>`,
            }));
        const roleHits = roles
            .filter(r => r.mentionable !== false && (r.name ?? '').toLowerCase().includes(q))
            .slice(0, 4)
            .map(r => ({
                kind: 'role',
                id:   r.id,
                label: r.name,
                color: r.color,
                token: `<@&${r.id}>`,
            }));
        const specials = [];
        if ('everyone'.startsWith(q)) specials.push({ kind: 'special', id: 'everyone', label: 'everyone', token: '@everyone' });
        if ('here'.startsWith(q))     specials.push({ kind: 'special', id: 'here',     label: 'here',     token: '@here' });
        return [...specials, ...roleHits, ...memberHits];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctx?.trigger, ctx?.query, members, roles, channels, guildEmojis]);

    useEffect(() => { setIdx(0); }, [ctx?.query, ctx?.trigger]);

    useEffect(() => {
        if (!ctx || items.length === 0) return;
        const onKey = (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => (i + 1) % items.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => (i - 1 + items.length) % items.length); }
            else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                onPick?.(items[idx]);
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [ctx, items, idx, onPick]);

    if (!ctx || items.length === 0) return null;

    const headLabel = ctx.trigger === '#' ? 'Salons'
                    : ctx.trigger === ':' ? 'Emojis du serveur'
                    : 'Mentionner';

    return (
        <div className="tv2-mention-pop" role="listbox">
            <div className="tv2-mention-head">
                {headLabel}
                {ctx.query && <span className="tv2-mention-q">: {ctx.query}</span>}
            </div>
            {items.map((it, i) => (
                <button
                    key={`${it.kind}-${it.id}`}
                    className={`tv2-mention-item ${i === idx ? 'is-active' : ''}`}
                    onMouseEnter={() => setIdx(i)}
                    onMouseDown={(e) => { e.preventDefault(); onPick?.(it); }}
                    role="option"
                    aria-selected={i === idx}
                >
                    <span className="tv2-mention-icon">
                        {it.kind === 'emoji'
                            ? <img src={it.url} alt={it.label} className="tv2-mention-emoji-thumb" />
                            : it.kind === 'channel' ? <Hash size={13} />
                            : it.kind === 'role'    ? <Users size={13} style={it.color ? { color: `#${it.color.toString(16).padStart(6, '0')}` } : undefined} />
                            : it.kind === 'special' ? <Megaphone size={13} />
                            :                         <AtSign size={13} />}
                    </span>
                    <span className="tv2-mention-label">{it.label}</span>
                    <span className="tv2-mention-kind">
                        {it.kind === 'special' ? 'broadcast' : it.kind}
                    </span>
                </button>
            ))}
        </div>
    );
}
