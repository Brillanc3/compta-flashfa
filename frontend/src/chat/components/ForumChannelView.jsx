import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Clock, TrendingUp, HelpCircle, Plus, Tag, X } from 'lucide-react';
import { TagBadge } from './ThreadTagPicker';

const API_BASE = '/api/tchatv2';

async function fetchWithAuth(url, opts = {}) {
    const res = await fetch(url, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
        credentials: 'include',
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const e = new Error(body.message ?? 'Request failed');
        e.status = res.status;
        throw e;
    }
    return res.json();
}

const SORT_OPTIONS = [
    { value: 'latest',     label: 'Récents',      Icon: Clock },
    { value: 'popular',    label: 'Populaires',   Icon: TrendingUp },
    { value: 'unanswered', label: 'Sans réponse', Icon: HelpCircle },
];

function ThreadCard({ thread, tags, onClick }) {
    const threadTagIds = (thread.tags ?? []).map(t => String(t.tagId ?? t));
    const threadTags = tags.filter(t => threadTagIds.includes(String(t.id)));
    const msgCount = thread._count?.messages ?? 0;
    const isPinned = thread.threadMetadata?.pinned;

    return (
        <button
            type="button"
            onClick={() => onClick?.(thread)}
            className="w-full text-left rounded-xl border border-cca-border bg-cca-surface hover:bg-cca-surface/80 p-4 transition-all hover:border-brand-primary/40 group"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        {isPinned && <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Épinglé</span>}
                        <h3 className="text-sm font-semibold text-cca-textPrimary truncate group-hover:text-brand-primary transition-colors">
                            {thread.name}
                        </h3>
                    </div>

                    {threadTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                            {threadTags.map(tag => <TagBadge key={tag.id} tag={tag} />)}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1 text-cca-textSecondary shrink-0">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="text-xs">{msgCount}</span>
                </div>
            </div>
        </button>
    );
}

export default function ForumChannelView({ guildId, channelId, onOpenThread }) {
    const [threads, setThreads] = useState([]);
    const [tags, setTags] = useState([]);
    const [sort, setSort] = useState('latest');
    const [filterTagId, setFilterTagId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!guildId || !channelId) return;
        setLoading(true);
        setError(null);
        try {
            const [{ threads: t }, { tags: g }] = await Promise.all([
                fetchWithAuth(`${API_BASE}/guilds/${guildId}/channels/${channelId}/forum-threads/active?sort=${sort}`),
                fetchWithAuth(`${API_BASE}/guilds/${guildId}/channels/${channelId}/forum-tags`),
            ]);
            setThreads(t ?? []);
            setTags(g ?? []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [guildId, channelId, sort]);

    useEffect(() => { load(); }, [load]);

    const displayed = filterTagId
        ? threads.filter(t => {
            const ids = (t.tags ?? []).map(tag => String(tag.tagId ?? tag));
            return ids.includes(filterTagId);
        })
        : threads;

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-cca-border bg-cca-surface shrink-0">
                {/* Sort */}
                <div className="flex items-center gap-1 bg-cca-base rounded-lg p-1">
                    {SORT_OPTIONS.map(({ value, label, Icon }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setSort(value)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all
                                ${sort === value
                                    ? 'bg-brand-primary/20 text-brand-primary'
                                    : 'text-cca-textSecondary hover:text-cca-textPrimary'
                                }`}
                        >
                            <Icon className="w-3 h-3" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Tag filter */}
                {tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                        <Tag className="w-3.5 h-3.5 text-cca-textSecondary" />
                        {tags.map(tag => (
                            <button
                                key={tag.id}
                                type="button"
                                onClick={() => setFilterTagId(prev => prev === String(tag.id) ? null : String(tag.id))}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all
                                    ${filterTagId === String(tag.id)
                                        ? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
                                        : 'bg-cca-base border-cca-border text-cca-textSecondary hover:border-brand-primary'
                                    }`}
                            >
                                {tag.emoji && <span>{tag.emoji}</span>}
                                {tag.name}
                                {filterTagId === String(tag.id) && <X className="w-2.5 h-2.5" />}
                            </button>
                        ))}
                    </div>
                )}

                <div className="ml-auto text-xs text-cca-textSecondary">
                    {displayed.length} thread{displayed.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <span className="text-sm text-cca-textSecondary">Chargement…</span>
                    </div>
                )}

                {error && (
                    <div className="text-sm text-red-400 p-3 rounded-lg bg-red-400/10 border border-red-400/20">
                        {error}
                    </div>
                )}

                {!loading && !error && displayed.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-cca-textSecondary">
                        <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
                        <p className="text-sm">Aucun thread</p>
                        {filterTagId && (
                            <button
                                type="button"
                                onClick={() => setFilterTagId(null)}
                                className="mt-2 text-xs text-brand-primary hover:underline"
                            >
                                Effacer le filtre
                            </button>
                        )}
                    </div>
                )}

                {!loading && displayed.map(thread => (
                    <ThreadCard
                        key={String(thread.id)}
                        thread={thread}
                        tags={tags}
                        onClick={onOpenThread}
                    />
                ))}
            </div>
        </div>
    );
}
