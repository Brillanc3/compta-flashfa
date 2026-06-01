import { create } from 'zustand';
import apiClient from '@/services/api';

export const usePresenceStore = create((set, get) => ({
    presences: {}, // { [userId]: { status, customEmoji, customText, username } }
    isLoaded: false,

    loadPresences: async (companyId) => {
        try {
            const headers = companyId ? { 'x-company-id': String(companyId) } : {};
            const res = await apiClient.get('/chat/presence', { headers });
            const list = Array.isArray(res.data) ? res.data : [];
            const map = {};
            list.forEach(p => {
                map[p.userId] = {
                    status: p.status,
                    customEmoji: p.customEmoji,
                    customText: p.customText,
                    name: p.user?.name,
                    username: p.user?.username,
                    rank: p.rank ?? null,
                };
            });
            set({ presences: map, isLoaded: true });
        } catch (err) {
            console.error('[presence] loadPresences failed:', err);
        }
    },

    updatePresence: (userId, data) => {
        set(s => ({
            presences: {
                ...s.presences,
                [userId]: { ...s.presences[userId], ...data },
            },
        }));
    },

    setMyStatus: async (status, customEmoji, customText) => {
        try {
            await apiClient.put('/chat/presence', { status, customEmoji, customText });
        } catch (err) {
            console.error('[presence] setMyStatus failed:', err);
        }
    },

    getStatus: (userId) => {
        return get().presences[userId]?.status ?? 'OFFLINE';
    },
}));
