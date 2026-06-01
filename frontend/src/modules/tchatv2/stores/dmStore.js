import { create } from 'zustand';

export const useDmStore = create((set) => ({
    dms:         [],    // [{ id, type, name, recipients: [{ id, username }] }]
    activeDmId:  null,

    setDms: (dms) => set({ dms }),

    upsertDm: (dm) => set((s) => {
        const exists = s.dms.some(d => d.id === dm.id);
        if (exists) return { dms: s.dms.map(d => d.id === dm.id ? { ...d, ...dm } : d) };
        return { dms: [dm, ...s.dms] };
    }),

    removeDm: (channelId) => set((s) => ({
        dms: s.dms.filter(d => d.id !== String(channelId)),
    })),

    setActiveDmId: (id) => set({ activeDmId: id ? String(id) : null }),
}));
