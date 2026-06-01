import { create } from 'zustand';

export const useGuildStore = create((set, get) => ({
    guilds: [],
    activeGuildId: null,

    setGuilds: (guilds) => set({ guilds }),

    setActiveGuildId: (id) => set({ activeGuildId: id ? String(id) : null }),

    upsertGuild: (guild) => set((s) => {
        const id = String(guild.id);
        const idx = s.guilds.findIndex(g => String(g.id) === id);
        if (idx === -1) return { guilds: [...s.guilds, guild] };
        const next = [...s.guilds];
        next[idx] = { ...next[idx], ...guild };
        return { guilds: next };
    }),

    activeGuild: () => {
        const { guilds, activeGuildId } = get();
        return guilds.find(g => String(g.id) === activeGuildId) ?? null;
    },
}));
