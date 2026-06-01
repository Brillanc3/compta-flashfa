import { create } from 'zustand';

function loadReadState() {
    try { return JSON.parse(localStorage.getItem('tv2:readState') || '{}'); } catch { return {}; }
}

function saveReadState(state) {
    try { localStorage.setItem('tv2:readState', JSON.stringify(state)); } catch { /* intentional */ }
}

export const useChannelStore = create((set, get) => ({
    /* guildId (string) -> Channel[] */
    byGuild: {},
    activeChannelId: null,
    readStateByChannel: loadReadState(),
    mentionByChannel: {}, // { channelId: boolean } — true if unread mention

    setChannels: (guildId, channels) => set((s) => {
        const key = String(guildId);
        const readUpdate = {};
        for (const ch of channels) {
            const cid = String(ch.id);
            if (!s.readStateByChannel[cid] && ch.lastMessageId) {
                readUpdate[cid] = String(ch.lastMessageId);
            }
        }
        const hasUpdates = Object.keys(readUpdate).length > 0;
        const newReadState = hasUpdates ? { ...s.readStateByChannel, ...readUpdate } : s.readStateByChannel;
        if (hasUpdates) saveReadState(newReadState);
        return {
            byGuild: { ...s.byGuild, [key]: channels },
            ...(hasUpdates ? { readStateByChannel: newReadState } : {}),
        };
    }),

    setActiveChannelId: (id) => set({ activeChannelId: id ? String(id) : null }),

    upsertChannel: (guildId, channel) => set((s) => {
        const key  = String(guildId);
        const list = s.byGuild[key] ?? [];
        const cid  = String(channel.id);
        const idx  = list.findIndex(c => String(c.id) === cid);
        const next = idx === -1 ? [...list, channel] : list.map((c, i) => i === idx ? { ...c, ...channel } : c);
        return { byGuild: { ...s.byGuild, [key]: next } };
    }),

    removeChannel: (guildId, channelId) => set((s) => {
        const key  = String(guildId);
        const list = s.byGuild[key] ?? [];
        const cid  = String(channelId);
        return { byGuild: { ...s.byGuild, [key]: list.filter(c => String(c.id) !== cid) } };
    }),

    channelsForGuild: (guildId) => get().byGuild[String(guildId)] ?? [],

    activeChannel: () => {
        const { byGuild, activeChannelId } = get();
        if (!activeChannelId) return null;
        for (const list of Object.values(byGuild)) {
            const found = list.find(c => String(c.id) === activeChannelId);
            if (found) return found;
        }
        return null;
    },

    setMention: (channelId) => set(s => ({
        mentionByChannel: { ...s.mentionByChannel, [String(channelId)]: true },
    })),

    clearMention: (channelId) => set(s => {
        const next = { ...s.mentionByChannel };
        delete next[String(channelId)];
        return { mentionByChannel: next };
    }),

    /* Mark a channel as read up to a specific messageId (e.g. after sending) */
    setReadState: (channelId, messageId) => set((s) => {
        const cid = String(channelId);
        const next = { ...s.readStateByChannel, [cid]: String(messageId) };
        saveReadState(next);
        return { readStateByChannel: next };
    }),

    /* Mark a channel as read up to its current lastMessageId */
    markRead: (channelId) => set((s) => {
        const cid = String(channelId);
        const nextMentions = { ...s.mentionByChannel };
        delete nextMentions[cid];
        let lastMsgId = null;
        for (const list of Object.values(s.byGuild)) {
            const ch = list.find(c => String(c.id) === cid);
            if (ch?.lastMessageId) { lastMsgId = String(ch.lastMessageId); break; }
        }
        if (!lastMsgId) return { mentionByChannel: nextMentions };
        const next = { ...s.readStateByChannel, [cid]: lastMsgId };
        saveReadState(next);
        return { readStateByChannel: next, mentionByChannel: nextMentions };
    }),

    /* Mark every channel of a guild as read up to its current lastMessageId */
    markGuildRead: (guildId) => set((s) => {
        const channels = s.byGuild[String(guildId)] ?? [];
        const next = { ...s.readStateByChannel };
        const nextMentions = { ...s.mentionByChannel };
        for (const ch of channels) {
            if (ch.type === 4) continue; // skip category channels
            const cid = String(ch.id);
            delete nextMentions[cid];
            if (ch.lastMessageId) next[cid] = String(ch.lastMessageId);
        }
        saveReadState(next);
        return { readStateByChannel: next, mentionByChannel: nextMentions };
    }),

    /* Update channel's lastMessageId when a new WS message arrives */
    bumpLastMessage: (guildId, channelId, messageId) => set((s) => {
        const key = String(guildId);
        const cid = String(channelId);
        const mid = String(messageId);
        const list = s.byGuild[key] ?? [];
        const idx = list.findIndex(c => String(c.id) === cid);
        if (idx === -1) return {};
        const next = [...list];
        next[idx] = { ...next[idx], lastMessageId: mid };
        return { byGuild: { ...s.byGuild, [key]: next } };
    }),

    /* Find guildId for a given channelId */
    guildIdForChannel: (channelId) => {
        const { byGuild } = get();
        const cid = String(channelId);
        for (const [gid, list] of Object.entries(byGuild)) {
            if (list.some(c => String(c.id) === cid)) return gid;
        }
        return null;
    },

    hasUnread: (channelId) => {
        const { byGuild, readStateByChannel } = get();
        const cid = String(channelId);
        let channel = null;
        for (const list of Object.values(byGuild)) {
            channel = list.find(c => String(c.id) === cid);
            if (channel) break;
        }
        if (!channel?.lastMessageId) return false;
        const lastMsgId = String(channel.lastMessageId);
        const readId = readStateByChannel[cid];
        if (!readId) return true;
        try { return BigInt(lastMsgId) > BigInt(readId); } catch { return false; }
    },

    guildHasUnread: (guildId) => {
        const { byGuild, readStateByChannel } = get();
        const channels = byGuild[String(guildId)] ?? [];
        return channels.filter(ch => ch.type !== 4).some(ch => {
            if (!ch.lastMessageId) return false;
            const lastMsgId = String(ch.lastMessageId);
            const readId = readStateByChannel[String(ch.id)];
            if (!readId) return true;
            try { return BigInt(lastMsgId) > BigInt(readId); } catch { return false; }
        });
    },

    totalUnreadCount: () => {
        const { byGuild, readStateByChannel } = get();
        let count = 0;
        for (const channels of Object.values(byGuild)) {
            for (const ch of channels) {
                if (ch.type === 4) continue; // skip category channels
                if (!ch.lastMessageId) continue;
                const readId = readStateByChannel[String(ch.id)];
                if (!readId) { count++; continue; }
                try { if (BigInt(String(ch.lastMessageId)) > BigInt(readId)) count++; } catch { /* skip */ }
            }
        }
        return count;
    },

    markAllRead: () => set((s) => {
        const next = { ...s.readStateByChannel };
        const nextMentions = {};
        for (const channels of Object.values(s.byGuild)) {
            for (const ch of channels) {
                if (ch.type === 4) continue; // skip categories (matches totalUnreadCount)
                if (ch.lastMessageId) {
                    next[String(ch.id)] = String(ch.lastMessageId);
                }
            }
        }
        saveReadState(next);
        return { readStateByChannel: next, mentionByChannel: nextMentions };
    }),
}));
