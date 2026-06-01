import React, { useEffect, useRef, useState } from 'react';
import { AtSign, Tag } from 'lucide-react';

const STATUS_COLORS = {
    ONLINE: 'bg-green-500',
    IDLE: 'bg-yellow-500',
    DND: 'bg-red-500',
    INVISIBLE: 'bg-zinc-500',
    OFFLINE: 'bg-zinc-600',
};

function normalize(s) {
    return (s ?? '').toLowerCase().replace(/[-_.\s]/g, '');
}

const MentionDropdown = ({ query, participants, ranks, isDm, onSelect, onClose }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const listRef = useRef(null);
    const lastInputRef = useRef('keyboard'); // 'keyboard' | 'mouse'
    const nq = normalize(query ?? '');
    const q = (query ?? '').toLowerCase();

    const showEveryone = !isDm && (q === '' || 'everyone'.startsWith(q));
    const filteredUsers = (participants ?? []).filter(p => normalize(p.name).includes(nq));
    const filteredRanks = (ranks ?? []).filter(r => normalize(r.name).includes(nq));

    const items = [
        ...(showEveryone ? [{ type: 'everyone' }] : []),
        ...filteredUsers.map(p => ({ type: 'user', data: p })),
        ...filteredRanks.map(r => ({ type: 'rank', data: r })),
    ];

    useEffect(() => { setActiveIndex(0); }, [query]);

    useEffect(() => {
        const handleKey = (e) => {
            if (!items.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); lastInputRef.current = 'keyboard'; setActiveIndex(i => (i + 1) % items.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); lastInputRef.current = 'keyboard'; setActiveIndex(i => (i - 1 + items.length) % items.length); }
            else if (e.key === 'Enter') { e.preventDefault(); selectItem(items[activeIndex]); }
            else if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
        };
        document.addEventListener('keydown', handleKey, true);
        return () => document.removeEventListener('keydown', handleKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, activeIndex, onClose]);

    useEffect(() => {
        if (lastInputRef.current === 'keyboard') {
            listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex]);

    const selectItem = (item) => {
        if (!item) return;
        const token = item.type === 'everyone'
            ? '@everyone'
            : item.type === 'user'
                ? `<@${item.data.id}>`
                : `<@&${item.data.id}>`;
        onSelect?.(token);
    };

    if (!items.length) return null;

    let listIdx = 0;

    return (
        <div className="absolute bottom-full mb-2 left-0 w-72 bg-cca-surface border border-cca-border rounded-xl shadow-2xl z-50 overflow-hidden">
            <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
                {showEveryone && (() => {
                    const idx = listIdx++;
                    return (
                        <button
                            key="everyone"
                            onMouseDown={e => { e.preventDefault(); selectItem({ type: 'everyone' }); }}
                            onMouseEnter={() => { lastInputRef.current = 'mouse'; setActiveIndex(idx); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${activeIndex === idx ? 'bg-brand-primary text-white' : 'text-cca-textSecondary hover:bg-cca-base/60'}`}
                        >
                            <span className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0"><AtSign size={13} /></span>
                            <span className="font-semibold">everyone</span>
                            <span className="ml-auto text-xs opacity-60">Tous</span>
                        </button>
                    );
                })()}

                {filteredUsers.length > 0 && (
                    <>
                        <div className="px-3 py-1 text-[10px] font-bold text-cca-textSecondary uppercase tracking-wider">Membres</div>
                        {filteredUsers.map(user => {
                            const idx = listIdx++;
                            const statusColor = STATUS_COLORS[user.status ?? 'OFFLINE'];
                            return (
                                <button
                                    key={`user-${user.id}`}
                                    onMouseDown={e => { e.preventDefault(); selectItem({ type: 'user', data: user }); }}
                                    onMouseEnter={() => { lastInputRef.current = 'mouse'; setActiveIndex(idx); }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${activeIndex === idx ? 'bg-brand-primary text-white' : 'text-cca-textSecondary hover:bg-cca-base/60'}`}
                                >
                                    <div className="relative shrink-0">
                                        <span className="w-7 h-7 rounded-full bg-cca-base flex items-center justify-center text-xs font-bold border border-cca-border">
                                            {(user.name ?? '?').charAt(0).toUpperCase()}
                                        </span>
                                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-cca-surface ${statusColor}`} />
                                    </div>
                                    <span className="truncate">{user.name}</span>
                                </button>
                            );
                        })}
                    </>
                )}

                {filteredRanks.length > 0 && (
                    <>
                        <div className="px-3 py-1 text-[10px] font-bold text-cca-textSecondary uppercase tracking-wider">Rangs</div>
                        {filteredRanks.map(rank => {
                            const idx = listIdx++;
                            return (
                                <button
                                    key={`rank-${rank.id}`}
                                    onMouseDown={e => { e.preventDefault(); selectItem({ type: 'rank', data: rank }); }}
                                    onMouseEnter={() => { lastInputRef.current = 'mouse'; setActiveIndex(idx); }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${activeIndex === idx ? 'bg-brand-primary text-white' : 'text-cca-textSecondary hover:bg-cca-base/60'}`}
                                >
                                    <span className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                                        <Tag size={13} className="text-orange-400" />
                                    </span>
                                    <span className="truncate">{rank.name}</span>
                                </button>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
};

export default MentionDropdown;
