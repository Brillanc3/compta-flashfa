import { create } from 'zustand';

export const useRoleStore = create((set) => ({
    /* guildId (string) -> Role[] */
    byGuild: {},

    setRoles: (guildId, roles) =>
        set((s) => ({ byGuild: { ...s.byGuild, [String(guildId)]: roles } })),

    upsertRole: (guildId, role) => set((s) => {
        const key  = String(guildId);
        const rid  = String(role.id);
        const list = s.byGuild[key] ?? [];
        const idx  = list.findIndex(r => String(r.id) === rid);
        const next = idx === -1 ? [...list, role] : list.map((r, i) => i === idx ? { ...r, ...role } : r);
        return { byGuild: { ...s.byGuild, [key]: next } };
    }),

    removeRole: (guildId, roleId) => set((s) => {
        const key  = String(guildId);
        const rid  = String(roleId);
        const list = (s.byGuild[key] ?? []).filter(r => String(r.id) !== rid);
        return { byGuild: { ...s.byGuild, [key]: list } };
    }),
}));
