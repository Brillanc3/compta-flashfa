import { create } from 'zustand';

export const useMemberStore = create((set) => ({
    /* guildId (string) -> Member[] */
    byGuild: {},

    setMembers: (guildId, members) =>
        set((s) => ({ byGuild: { ...s.byGuild, [String(guildId)]: members } })),

    upsertMember: (guildId, member) => set((s) => {
        const key  = String(guildId);
        const uid  = String(member.userId);
        const list = s.byGuild[key] ?? [];
        const idx  = list.findIndex(m => String(m.userId) === uid);
        const next = idx === -1 ? [...list, member] : list.map((m, i) => i === idx ? { ...m, ...member } : m);
        return { byGuild: { ...s.byGuild, [key]: next } };
    }),

    removeMember: (guildId, userId) => set((s) => {
        const key  = String(guildId);
        const uid  = String(userId);
        const list = (s.byGuild[key] ?? []).filter(m => String(m.userId) !== uid);
        return { byGuild: { ...s.byGuild, [key]: list } };
    }),
}));
