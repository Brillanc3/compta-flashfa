import { create } from 'zustand';

// Durée d'affichage d'un "en train d'écrire" avant expiration auto (le throttle
// serveur ré-émet toutes les 5s tant que l'utilisateur tape).
const TYPING_TTL_MS = 6000;

export const useTypingStore = create((set, get) => ({
    /* channelId (string) -> { userId (string) -> timeoutId } */
    _timers: {},
    /* channelId (string) -> userId[] (string) */
    byChannel: {},

    /** Marque un utilisateur comme en train d'écrire dans un channel. */
    markTyping: (channelId, userId) => {
        const cid = String(channelId);
        const uid = String(userId);
        const { _timers } = get();

        // Reset le timer existant pour ce user/channel
        const existing = _timers[cid]?.[uid];
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => get()._expire(cid, uid), TYPING_TTL_MS);

        set((s) => {
            const list = s.byChannel[cid] ?? [];
            const nextList = list.includes(uid) ? list : [...list, uid];
            return {
                byChannel: { ...s.byChannel, [cid]: nextList },
                _timers:   { ...s._timers, [cid]: { ...(s._timers[cid] ?? {}), [uid]: timer } },
            };
        });
    },

    /** Retire immédiatement un utilisateur (ex: il vient d'envoyer un message). */
    clearTyping: (channelId, userId) => {
        const cid = String(channelId);
        const uid = String(userId);
        const timer = get()._timers[cid]?.[uid];
        if (timer) clearTimeout(timer);
        get()._expire(cid, uid);
    },

    _expire: (cid, uid) => set((s) => {
        const list = (s.byChannel[cid] ?? []).filter(u => u !== uid);
        const timers = { ...(s._timers[cid] ?? {}) };
        delete timers[uid];
        return {
            byChannel: { ...s.byChannel, [cid]: list },
            _timers:   { ...s._timers, [cid]: timers },
        };
    }),
}));
