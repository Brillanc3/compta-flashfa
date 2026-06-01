import React, { useEffect, useRef, useCallback } from 'react';
import { X, Search, Loader2, Hash, Calendar } from 'lucide-react';
import { useSearchStore } from '../store/useSearchStore';

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function SearchResult({ result, onJump }) {
    return (
        <button
            type="button"
            onClick={() => onJump(result)}
            className="w-full text-left px-4 py-3 hover:bg-cca-surface/60 transition-colors border-b border-cca-border/30 last:border-0"
        >
            <div className="flex items-center gap-2 mb-1 text-xs text-cca-textSecondary">
                <Hash className="w-3 h-3 shrink-0" />
                <span className="font-medium truncate">{result.channelName}</span>
                <span className="ml-auto shrink-0">{formatDate(result.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-cca-textPrimary">{result.authorUsername}</span>
                {result.authorNickname && (
                    <span className="text-xs text-cca-textSecondary">({result.authorNickname})</span>
                )}
            </div>
            <p className="text-sm text-cca-textSecondary line-clamp-2 break-words">{result.content}</p>
        </button>
    );
}

export default function ChatSearchPanel({ guildId, channels = [], onClose, onJumpToChannel }) {
    const inputRef = useRef(null);
    const {
        query, results, total, hasMore, isLoading, error, filters,
        setQuery, setFilter, search, loadMore, clear,
    } = useSearchStore();

    useEffect(() => {
        inputRef.current?.focus();
        return () => clear();
    }, [clear]);

    const handleSearch = useCallback(
        (e) => {
            e?.preventDefault();
            if (guildId && query.length >= 2) search(guildId);
        },
        [guildId, query, search]
    );

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter') handleSearch();
            if (e.key === 'Escape') onClose();
        },
        [handleSearch, onClose]
    );

    const handleJump = useCallback(
        (result) => {
            if (typeof onJumpToChannel === 'function') {
                onJumpToChannel(result.channelId, result.id);
            }
        },
        [onJumpToChannel]
    );

    return (
        <div className="flex flex-col h-full w-80 bg-cca-base border-l border-cca-border/50 shadow-xl z-20">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-cca-border/50">
                <Search className="w-4 h-4 text-cca-textSecondary shrink-0" />
                <span className="text-sm font-semibold text-cca-textPrimary flex-1">Recherche</span>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded hover:bg-cca-surface/60 text-cca-textSecondary hover:text-cca-textPrimary transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Search input */}
            <div className="px-4 pt-3 pb-2">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Rechercher (min. 2 caracteres)"
                        className="flex-1 bg-cca-surface/80 text-cca-textPrimary text-sm rounded-md px-3 py-2 outline-none border border-cca-border/40 focus:border-brand-primary/60 placeholder:text-cca-textSecondary/60"
                    />
                    <button
                        type="button"
                        onClick={handleSearch}
                        disabled={query.length < 2 || isLoading}
                        className="px-3 py-2 bg-brand-primary text-white text-sm rounded-md hover:bg-brand-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="px-4 pb-3 space-y-2">
                {/* Channel filter */}
                <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-cca-textSecondary shrink-0" />
                    <select
                        value={filters.channelId}
                        onChange={(e) => setFilter('channelId', e.target.value)}
                        className="flex-1 bg-cca-surface/80 text-cca-textSecondary text-xs rounded px-2 py-1.5 outline-none border border-cca-border/40 focus:border-brand-primary/60"
                    >
                        <option value="">Tous les canaux</option>
                        {channels?.filter(c => c.type !== 4).map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Date filters */}
                <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-cca-textSecondary shrink-0" />
                    <input
                        type="date"
                        value={filters.after ? filters.after.slice(0, 10) : ''}
                        onChange={(e) => setFilter('after', e.target.value ? new Date(e.target.value).toISOString() : '')}
                        className="flex-1 bg-cca-surface/80 text-cca-textSecondary text-xs rounded px-2 py-1.5 outline-none border border-cca-border/40 focus:border-brand-primary/60"
                        title="Apres"
                    />
                    <span className="text-cca-textSecondary text-xs">-</span>
                    <input
                        type="date"
                        value={filters.before ? filters.before.slice(0, 10) : ''}
                        onChange={(e) => setFilter('before', e.target.value ? new Date(e.target.value).toISOString() : '')}
                        className="flex-1 bg-cca-surface/80 text-cca-textSecondary text-xs rounded px-2 py-1.5 outline-none border border-cca-border/40 focus:border-brand-primary/60"
                        title="Avant"
                    />
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {error && (
                    <div className="px-4 py-3 text-sm text-red-400">{error}</div>
                )}

                {!isLoading && !error && results.length === 0 && query.length >= 2 && (
                    <div className="px-4 py-8 text-center text-sm text-cca-textSecondary">
                        Aucun resultat pour &ldquo;{query}&rdquo;
                    </div>
                )}

                {results.length > 0 && (
                    <>
                        <div className="px-4 py-2 text-xs text-cca-textSecondary border-b border-cca-border/30">
                            {total} resultat{total > 1 ? 's' : ''}
                        </div>
                        {results.map((r) => (
                            <SearchResult key={r.id} result={r} onJump={handleJump} />
                        ))}
                        {hasMore && (
                            <button
                                type="button"
                                onClick={() => loadMore(guildId)}
                                disabled={isLoading}
                                className="w-full py-3 text-sm text-brand-primary hover:bg-cca-surface/40 transition-colors disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Charger plus'}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
