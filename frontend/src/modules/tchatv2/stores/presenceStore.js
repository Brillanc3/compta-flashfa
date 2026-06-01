import { create } from 'zustand';

export const usePresenceStore = create((set) => ({
    /* userId (string) -> 'online'|'idle'|'dnd'|'offline' */
    statuses: {},

    setStatus: (userId, status) =>
        set((s) => ({ statuses: { ...s.statuses, [String(userId)]: status } })),

    setBulkStatuses: (entries) => set((s) => {
        const next = { ...s.statuses };
        entries.forEach(({ userId, status }) => { next[String(userId)] = status; });
        return { statuses: next };
    }),

    getStatus: (userId) => {
        return usePresenceStore.getState().statuses[String(userId)] ?? 'offline';
    },
}));
