import { create } from 'zustand';
import axios from 'axios';

const API_BASE = '/api/v2';

const useSearchStore = create((set, get) => ({
    query: '',
    results: [],
    total: 0,
    hasMore: false,
    nextCursor: null,
    isOpen: false,
    isLoading: false,
    error: null,
    filters: {
        channelId: '',
        fromUserId: '',
        before: '',
        after: '',
    },

    setQuery: (query) => set({ query }),

    setFilter: (key, value) =>
        set((s) => ({ filters: { ...s.filters, [key]: value } })),

    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),

    clear: () =>
        set({
            query: '',
            results: [],
            total: 0,
            hasMore: false,
            nextCursor: null,
            error: null,
            filters: { channelId: '', fromUserId: '', before: '', after: '' },
        }),

    search: async (guildId, { cursor } = {}) => {
        const { query, filters } = get();
        if (!query || query.length < 2) return;

        set({ isLoading: true, error: null });
        if (!cursor) set({ results: [], nextCursor: null });

        try {
            const params = new URLSearchParams({ q: query, limit: 25 });
            if (filters.channelId) params.set('in', filters.channelId);
            if (filters.fromUserId) params.set('from', filters.fromUserId);
            if (filters.before) params.set('before', filters.before);
            if (filters.after) params.set('after', filters.after);
            if (cursor) params.set('cursor', cursor);

            const { data } = await axios.get(
                `${API_BASE}/guilds/${guildId}/search?${params.toString()}`
            );

            set((s) => ({
                results: cursor ? [...s.results, ...data.results] : data.results,
                total: data.total,
                hasMore: data.hasMore,
                nextCursor: data.nextCursor,
                isLoading: false,
            }));
        } catch (err) {
            set({ isLoading: false, error: err?.response?.data?.message || 'Search failed' });
        }
    },

    loadMore: (guildId) => {
        const { nextCursor, hasMore, isLoading } = get();
        if (!hasMore || isLoading || !nextCursor) return;
        get().search(guildId, { cursor: nextCursor });
    },
}));

export { useSearchStore };
