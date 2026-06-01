import { create } from 'zustand';

/**
 * Stores per-channel read states for all members.
 * Shape: { [channelId]: { [userId]: lastReadMessageId (string) } }
 */
export const useReadStateStore = create((set) => ({
    readStates: {},

    setReadState(channelId, userId, lastReadMessageId) {
        set((s) => ({
            readStates: {
                ...s.readStates,
                [String(channelId)]: {
                    ...(s.readStates[String(channelId)] ?? {}),
                    [String(userId)]: String(lastReadMessageId),
                },
            },
        }));
    },

    setChannelReadStates(channelId, states) {
        // states: [{ userId, lastReadMessageId }]
        const map = {};
        for (const s of states) {
            map[String(s.userId)] = String(s.lastReadMessageId);
        }
        set((prev) => ({
            readStates: {
                ...prev.readStates,
                [String(channelId)]: map,
            },
        }));
    },

    getReadersOf(channelId, messageId, excludeUserId) {
        // Returns userIds who have read up to at least messageId
        const cid = String(channelId);
        const mid = String(messageId);
        const channelMap = useReadStateStore.getState().readStates[cid] ?? {};
        return Object.entries(channelMap)
            .filter(([uid, readMsgId]) => {
                if (String(uid) === String(excludeUserId)) return false;
                try { return BigInt(readMsgId) >= BigInt(mid); } catch { return false; }
            })
            .map(([uid]) => uid);
    },
}));
