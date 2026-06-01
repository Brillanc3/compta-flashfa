import React, { useMemo } from 'react';
import { usePresenceStore } from '../store/usePresenceStore';

const STATUS_COLORS = {
    ONLINE: 'bg-green-500',
    IDLE: 'bg-yellow-500',
    DND: 'bg-red-500',
    INVISIBLE: 'bg-zinc-500',
    OFFLINE: 'bg-zinc-600',
};

function MemberRow({ member, status, customText, onOpenDm }) {
    const initials = (member.name ?? member.username ?? '?').slice(0, 2).toUpperCase();
    const isOnline = status !== 'OFFLINE' && status !== 'INVISIBLE';

    return (
        <button
            type="button"
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-cca-surface/60 transition-colors group"
            onClick={() => onOpenDm?.(member.id)}
        >
            <div className="relative shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border border-cca-border ${
                    isOnline ? 'bg-brand-primary/15 text-brand-primary border-brand-primary/30' : 'bg-cca-surface text-cca-textSecondary/50'
                }`}>
                    {initials}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-cca-base ${STATUS_COLORS[status ?? 'OFFLINE']}`} />
            </div>
            <div className="flex-1 min-w-0 text-left">
                <div className={`text-xs font-semibold truncate ${isOnline ? 'text-cca-textPrimary' : 'text-cca-textSecondary/60'}`}>
                    {member.name ?? member.username}
                </div>
                {customText && (
                    <div className="text-[10px] text-cca-textSecondary/50 truncate">{customText}</div>
                )}
            </div>
        </button>
    );
}

export default function MemberListPanel({ members = [], onOpenDm }) {
    const presences = usePresenceStore(s => s.presences);

    const rankGroups = useMemo(() => {
        const groups = new Map();

        members.forEach(m => {
            const p = presences[m.id];
            const status = p?.status ?? 'OFFLINE';
            const rankId = m.rank?.id ?? 0;

            if (!groups.has(rankId)) {
                groups.set(rankId, {
                    rank: m.rank,
                    members: [],
                });
            }
            groups.get(rankId).members.push({ ...m, status, customText: p?.customText ?? null });
        });

        return [...groups.values()].sort((a, b) => {
            const posA = a.rank?.position ?? -1;
            const posB = b.rank?.position ?? -1;
            return posB - posA;
        });
    }, [members, presences]);

    const onlineCount = useMemo(() => (
        members.filter(m => {
            const s = presences[m.id]?.status ?? 'OFFLINE';
            return s === 'ONLINE' || s === 'IDLE' || s === 'DND';
        }).length
    ), [members, presences]);

    return (
        <div className="w-60 shrink-0 flex flex-col h-full bg-cca-surface/50 border-l border-cca-border overflow-y-auto">
            <div className="px-3 pt-4 pb-2 border-b border-cca-border/40">
                <span className="text-[10px] font-bold text-cca-textSecondary uppercase tracking-wider">
                    Membres — {members.length}
                </span>
                {onlineCount > 0 && (
                    <span className="ml-2 text-[10px] text-green-400">{onlineCount} en ligne</span>
                )}
            </div>

            <div className="px-3 py-2 space-y-3">
                {rankGroups.map(({ rank, members: rankMembers }) => {
                    const onlineInGroup = rankMembers.filter(m =>
                        m.status === 'ONLINE' || m.status === 'IDLE' || m.status === 'DND'
                    );
                    const offlineInGroup = rankMembers.filter(m =>
                        m.status === 'OFFLINE' || m.status === 'INVISIBLE'
                    );

                    return (
                        <div key={rank?.id ?? 0}>
                            <div className="text-[10px] font-bold text-cca-textSecondary uppercase tracking-wider px-2 mb-1">
                                {rank?.name ?? 'Sans rang'} — {rankMembers.length}
                            </div>
                            {onlineInGroup.map(m => (
                                <MemberRow key={m.id} member={m} status={m.status} customText={m.customText} onOpenDm={onOpenDm} />
                            ))}
                            {offlineInGroup.map(m => (
                                <MemberRow key={m.id} member={m} status="OFFLINE" customText={null} onOpenDm={onOpenDm} />
                            ))}
                        </div>
                    );
                })}

                {members.length === 0 && (
                    <div className="text-xs text-cca-textSecondary/50 text-center py-4">Aucun membre</div>
                )}
            </div>
        </div>
    );
}
