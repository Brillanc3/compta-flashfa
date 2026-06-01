import { create } from 'zustand';

function compareIds(a, b) {
    /* BigInt-style string sort: pad to same length then lex compare */
    const pa = a.padStart(20, '0');
    const pb = b.padStart(20, '0');
    return pa < pb ? -1 : pa > pb ? 1 : 0;
}

function insertSorted(ids, newId) {
    const idx = ids.findIndex(id => compareIds(id, newId) > 0);
    if (idx === -1) return [...ids, newId];
    return [...ids.slice(0, idx), newId, ...ids.slice(idx)];
}

/**
 * Normalize a server message:
 * - parse reactionsSummary (JSON string) into `reactions: [{emoji, count, me}]`
 * - alias `referencedMessage` → `replyTo`
 */
function normalize(message) {
    if (!message) return message;
    if (message._normalized) return message;

    let reactions = Array.isArray(message.reactions) ? message.reactions : null;
    if (!reactions && typeof message.reactionsSummary === 'string') {
        try {
            const parsed = JSON.parse(message.reactionsSummary);
            if (Array.isArray(parsed)) reactions = parsed.map(r => ({ ...r }));
        } catch { reactions = []; }
    }
    if (!reactions) reactions = [];

    const mine = new Set(Array.isArray(message.userReactions) ? message.userReactions : []);
    reactions = reactions.map(r => ({ ...r, me: !!r.me || mine.has(r.emoji) }));

    const replyTo = message.replyTo ?? message.referencedMessage ?? null;
    return { ...message, reactions, replyTo, _normalized: true };
}

function mergeReactions(existing, summary, emoji, userIdMatchesMe, action) {
    const meEmojis = new Set((existing ?? []).filter(r => r.me).map(r => r.emoji));
    if (userIdMatchesMe) {
        if (action === 'add') meEmojis.add(emoji);
        else                  meEmojis.delete(emoji);
    }
    return (summary ?? []).map(r => ({ ...r, me: meEmojis.has(r.emoji) }));
}

export const useMessageStore = create((set, get) => ({
    /* channelId (string) -> string[] (messageIds, ascending) */
    byChannel: {},
    /* messageId (string) -> Message */
    byId: {},
    /* channelId (string) -> PendingMessage[] */
    pendingByChannel: {},

    /* Prepend older messages (scroll up load) */
    prependMessages: (channelId, messages) => set((s) => {
        const cid    = String(channelId);
        const normalized = messages.map(normalize);
        const newIds = normalized.map(m => String(m.id));
        const newById = {};
        normalized.forEach(m => { newById[String(m.id)] = m; });

        const existing = s.byChannel[cid] ?? [];
        const merged   = [...new Set([...newIds, ...existing])].sort(compareIds);

        return {
            byChannel: { ...s.byChannel, [cid]: merged },
            byId:      { ...s.byId, ...newById },
        };
    }),

    /* Append or update messages (initial load / WS receive) */
    upsertMessage: (channelId, message) => set((s) => {
        const cid = String(channelId);
        const norm = normalize(message);
        const mid = String(norm.id);
        const ids = s.byChannel[cid] ?? [];
        const next = ids.includes(mid) ? ids : insertSorted(ids, mid);

        return {
            byChannel: { ...s.byChannel, [cid]: next },
            byId:      { ...s.byId, [mid]: norm },
        };
    }),

    deleteMessage: (channelId, messageId) => set((s) => {
        const cid  = String(channelId);
        const mid  = String(messageId);
        const ids  = (s.byChannel[cid] ?? []).filter(id => id !== mid);
        const byId = { ...s.byId };
        delete byId[mid];
        return { byChannel: { ...s.byChannel, [cid]: ids }, byId };
    }),

    tombstoneMessage: (channelId, messageId) => set((s) => {
        const cid = String(channelId);
        const mid = String(messageId);

        // Retire de la liste visible
        const nextIds = (s.byChannel[cid] ?? []).filter(id => id !== mid);

        // Met deletedAt dans byId (pour les lookups replyTo)
        const existing = s.byId[mid];
        const nextById = existing
            ? { ...s.byId, [mid]: { ...existing, deletedAt: new Date().toISOString() } }
            : s.byId;

        // Propage deletedAt dans les replyTo embedded des autres messages
        const updatedById = Object.fromEntries(
            Object.entries(nextById).map(([id, msg]) => {
                if (msg.replyTo && String(msg.replyTo.id) === mid && !msg.replyTo.deletedAt) {
                    return [id, { ...msg, replyTo: { ...msg.replyTo, deletedAt: new Date().toISOString() } }];
                }
                return [id, msg];
            })
        );

        return {
            byChannel: { ...s.byChannel, [cid]: nextIds },
            byId: updatedById,
        };
    }),

    /* Optimistic: add pending message with nonce */
    appendOptimistic: (channelId, pending) => set((s) => {
        const cid  = String(channelId);
        const list = s.pendingByChannel[cid] ?? [];
        return { pendingByChannel: { ...s.pendingByChannel, [cid]: [...list, pending] } };
    }),

    /* Optimistic: server confirmed — remove pending, store real message */
    resolveOptimistic: (channelId, nonce, realMessage) => set((s) => {
        const cid  = String(channelId);
        const list = (s.pendingByChannel[cid] ?? []).filter(p => p.nonce !== nonce);
        const norm = normalize(realMessage);
        const mid  = String(norm.id);
        const ids  = s.byChannel[cid] ?? [];
        const next = ids.includes(mid) ? ids : insertSorted(ids, mid);

        return {
            pendingByChannel: { ...s.pendingByChannel, [cid]: list },
            byChannel:        { ...s.byChannel, [cid]: next },
            byId:             { ...s.byId, [mid]: norm },
        };
    }),

    /* Apply MESSAGE_REACTION_ADD / REMOVE socket events */
    applyReactionUpdate: (channelId, messageId, summary, emoji, userId, currentUserId, action) => set((s) => {
        const mid = String(messageId);
        const msg = s.byId[mid];
        if (!msg) return {};
        const isMine = String(userId) === String(currentUserId);
        const next = mergeReactions(msg.reactions, summary, emoji, isMine, action);
        return { byId: { ...s.byId, [mid]: { ...msg, reactions: next } } };
    }),

    /* Optimistic: send failed */
    markFailed: (channelId, nonce) => set((s) => {
        const cid  = String(channelId);
        const list = (s.pendingByChannel[cid] ?? []).map(
            p => p.nonce === nonce ? { ...p, failed: true } : p
        );
        return { pendingByChannel: { ...s.pendingByChannel, [cid]: list } };
    }),

    /* Retry failed pending */
    clearFailed: (channelId, nonce) => set((s) => {
        const cid  = String(channelId);
        const list = (s.pendingByChannel[cid] ?? []).filter(p => p.nonce !== nonce);
        return { pendingByChannel: { ...s.pendingByChannel, [cid]: list } };
    }),

    messagesForChannel: (channelId) => {
        const { byChannel, byId } = get();
        return (byChannel[String(channelId)] ?? []).map(id => byId[id]).filter(Boolean);
    },

    /* Apply POLL_VOTE_ADD socket event — update vote counts in message.poll */
    applyPollVote: (pollId, optionIds, userId, counts) => set((s) => {
        const entry = Object.values(s.byId).find(m => m.poll && String(m.poll.id) === String(pollId));
        if (!entry) return {};
        const mid = String(entry.id);
        const existingVotes = entry.poll.votes ?? [];
        const newVotes = optionIds.map(oid => ({ pollId: String(pollId), optionId: String(oid), userId }));
        const mergedVotes = [...existingVotes, ...newVotes];
        const updatedPoll = { ...entry.poll, votes: mergedVotes, counts };
        return { byId: { ...s.byId, [mid]: { ...entry, poll: updatedPoll } } };
    }),
}));
