import { create } from 'zustand';

export const useTypingStore = create((set, get) => ({
    typing: {}, // { [channelId]: { [userId]: { userName, expiresAt } } }

    startTyping: (channelId, userId, userName) => {
        const key = String(channelId);
        const expiresAt = Date.now() + 5000;
        set(s => ({
            typing: {
                ...s.typing,
                [key]: {
                    ...(s.typing[key] ?? {}),
                    [String(userId)]: { userName, expiresAt },
                },
            },
        }));
    },

    stopTyping: (channelId, userId) => {
        const key = String(channelId);
        set(s => {
            const channel = { ...(s.typing[key] ?? {}) };
            delete channel[String(userId)];
            return { typing: { ...s.typing, [key]: channel } };
        });
    },

    getTypingUsers: (channelId, excludeUserId) => {
        const key = String(channelId);
        const now = Date.now();
        const channel = get().typing[key] ?? {};
        return Object.entries(channel)
            .filter(([uid, v]) => v.expiresAt > now && String(uid) !== String(excludeUserId))
            .map(([, v]) => ({ userName: v.userName }));
    },

    pruneExpired: () => {
        const now = Date.now();
        set(s => {
            let changed = false;
            const typing = {};
            for (const [cid, users] of Object.entries(s.typing)) {
                const filtered = {};
                for (const [uid, v] of Object.entries(users)) {
                    if (v.expiresAt > now) filtered[uid] = v;
                    else changed = true;
                }
                if (Object.keys(filtered).length > 0) typing[cid] = filtered;
                else if (s.typing[cid]) changed = true;
            }
            return changed ? { typing } : s;
        });
    },
}));
