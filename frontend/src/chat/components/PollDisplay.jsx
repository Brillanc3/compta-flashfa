import React, { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Circle, BarChart2 } from 'lucide-react';
import { votePoll } from '@/modules/tchatv2/api/client';

function OptionBar({ option, count, total, selected, multiple, onClick, expired }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const Icon = multiple ? CheckSquare : Circle;

    return (
        <button
            type="button"
            onClick={!expired ? onClick : undefined}
            disabled={expired}
            className={`relative w-full text-left rounded-lg border transition-all overflow-hidden mb-2
                ${selected
                    ? 'border-brand-primary bg-brand-primary/10'
                    : 'border-cca-border bg-cca-base hover:bg-cca-surface/60'}
                ${expired ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
            `}
        >
            <div
                className="absolute inset-0 bg-brand-primary/10 transition-all"
                style={{ width: `${pct}%` }}
            />
            <div className="relative flex items-center gap-2 px-3 py-2">
                <Icon className={`w-4 h-4 shrink-0 ${selected ? 'text-brand-primary' : 'text-cca-textSecondary'}`} />
                <span className="flex-1 text-sm text-cca-textPrimary">{option.text}</span>
                <span className="text-xs text-cca-textSecondary font-mono">{count} ({pct}%)</span>
            </div>
        </button>
    );
}

export default function PollDisplay({ poll: initialPoll, guildId, onPollUpdate }) {
    const [poll, setPoll] = useState(initialPoll);
    const [selected, setSelected] = useState([]);
    const [voting, setVoting] = useState(false);
    const [voted, setVoted] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (onPollUpdate) {
            onPollUpdate((updatedPoll) => {
                setPoll(prev => ({ ...prev, ...updatedPoll }));
            });
        }
    }, [onPollUpdate]);

    const expired = poll.expiresAt && new Date(poll.expiresAt) < new Date();

    const counts = {};
    let total = 0;
    if (poll.votes) {
        for (const v of poll.votes) {
            const oid = String(v.optionId);
            counts[oid] = (counts[oid] ?? 0) + 1;
            total++;
        }
    }

    const toggleOption = useCallback((optionId) => {
        if (voted || expired) return;
        const oid = String(optionId);
        setSelected(prev => {
            if (!poll.multiple) return prev.includes(oid) ? [] : [oid];
            return prev.includes(oid) ? prev.filter(x => x !== oid) : [...prev, oid];
        });
    }, [voted, expired, poll.multiple]);

    const handleVote = useCallback(async () => {
        if (selected.length === 0 || voting || voted || !guildId) return;
        setVoting(true);
        setError(null);
        try {
            await votePoll(guildId, poll.id, selected);
            setVoted(true);
            setPoll(prev => ({
                ...prev,
                votes: [
                    ...(prev.votes ?? []),
                    ...selected.map(oid => ({ pollId: poll.id, optionId: oid, userId: '__me__' })),
                ],
            }));
        } catch (e) {
            setError(e.message);
        } finally {
            setVoting(false);
        }
    }, [selected, voting, voted, guildId, poll.id]);

    return (
        <div className="mt-2 rounded-xl border border-cca-border bg-cca-surface p-3 max-w-sm">
            <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-4 h-4 text-brand-primary shrink-0" />
                <p className="text-sm font-semibold text-cca-textPrimary">{poll.question}</p>
            </div>

            {expired && (
                <p className="text-xs text-amber-400 mb-2">Sondage expiré</p>
            )}

            <div>
                {(poll.options ?? []).map(opt => {
                    const oid = String(opt.id);
                    const count = counts[oid] ?? 0;
                    return (
                        <OptionBar
                            key={oid}
                            option={opt}
                            count={count}
                            total={total}
                            selected={selected.includes(oid)}
                            multiple={poll.multiple}
                            onClick={() => toggleOption(oid)}
                            expired={expired || voted}
                        />
                    );
                })}
            </div>

            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}

            {!expired && !voted && (
                <button
                    type="button"
                    disabled={selected.length === 0 || voting}
                    onClick={handleVote}
                    className="mt-2 w-full py-1.5 rounded-lg bg-brand-primary text-white text-sm font-medium
                               disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-primary/90 transition-colors"
                >
                    {voting ? 'Vote en cours…' : 'Voter'}
                </button>
            )}

            <p className="text-xs text-cca-textSecondary mt-2 text-right">
                {total} vote{total !== 1 ? 's' : ''}
                {poll.multiple && ' · choix multiples'}
            </p>
        </div>
    );
}
