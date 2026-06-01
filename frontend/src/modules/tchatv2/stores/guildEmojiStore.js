import { create } from 'zustand';
import { fetchGuildEmojis } from '../api/client';

export const useGuildEmojiStore = create((set, get) => ({
    byGuild: {},
    loading: {},

    async load(guildId) {
        const key = String(guildId);
        if (get().byGuild[key] !== undefined || get().loading[key]) return;
        set(s => ({ loading: { ...s.loading, [key]: true } }));
        try {
            const data = await fetchGuildEmojis(guildId);
            set(s => ({
                byGuild: { ...s.byGuild, [key]: data.emojis ?? [] },
                loading: { ...s.loading, [key]: false },
            }));
        } catch {
            set(s => ({ loading: { ...s.loading, [key]: false } }));
        }
    },

    invalidate(guildId) {
        const key = String(guildId);
        set(s => {
            const next = { ...s.byGuild };
            delete next[key];
            return { byGuild: next };
        });
    },

    add(guildId, emoji) {
        const key = String(guildId);
        set(s => ({
            byGuild: { ...s.byGuild, [key]: [...(s.byGuild[key] ?? []), emoji] },
        }));
    },

    remove(guildId, emojiId) {
        const key = String(guildId);
        set(s => ({
            byGuild: {
                ...s.byGuild,
                [key]: (s.byGuild[key] ?? []).filter(e => String(e.id) !== String(emojiId)),
            },
        }));
    },
}));
