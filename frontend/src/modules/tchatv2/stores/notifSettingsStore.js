import { create } from 'zustand';
import { getNotifSettings, setNotifSettings, listGuildNotifSettings } from '../api/client';

export const LEVEL = Object.freeze({
    DEFAULT:       0,
    ALL_MESSAGES:  1,
    MENTIONS_ONLY: 2,
    NONE:          3,
});

export const MUTE_FOREVER = '9999-12-31T00:00:00.000Z';

function computeIsMuted(mutedUntil) {
    if (!mutedUntil) return false;
    return new Date(mutedUntil).getTime() > Date.now();
}

export const useNotifSettingsStore = create((set, get) => ({
    byChannel: {},

    getSettings(channelId) {
        const row = get().byChannel[String(channelId)];
        if (!row) return { level: 0, mutedUntil: null, isMuted: false };
        return { level: row.level, mutedUntil: row.mutedUntil, isMuted: computeIsMuted(row.mutedUntil) };
    },

    async load(guildId, channelId) {
        const cid = String(channelId);
        try {
            const data = await getNotifSettings(guildId, cid);
            set(s => ({ byChannel: { ...s.byChannel, [cid]: { level: data.level, mutedUntil: data.mutedUntil } } }));
        } catch { /* silencieux — défaut affiché */ }
    },

    async loadGuild(guildId) {
        try {
            const rows = await listGuildNotifSettings(guildId);
            set(s => {
                const byChannel = { ...s.byChannel };
                for (const r of rows) {
                    byChannel[r.channelId] = { level: r.level, mutedUntil: r.mutedUntil };
                }
                return { byChannel };
            });
        } catch { /* silencieux */ }
    },

    async update(guildId, channelId, body) {
        const cid = String(channelId);
        const data = await setNotifSettings(guildId, cid, body);
        set(s => ({ byChannel: { ...s.byChannel, [cid]: { level: data.level, mutedUntil: data.mutedUntil } } }));
        return data;
    },

    setLocal(channelId, partial) {
        const cid = String(channelId);
        set(s => ({
            byChannel: { ...s.byChannel, [cid]: { ...(s.byChannel[cid] ?? { level: 0, mutedUntil: null }), ...partial } },
        }));
    },
}));
