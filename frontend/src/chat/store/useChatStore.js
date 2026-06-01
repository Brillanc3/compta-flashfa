import { create } from "zustand";
import LZString from "lz-string";
import * as chatApi from "@/services/chatService";
import { useDmStore } from "./useDmStore";

let _sessionId = 0;
let _messagesAbortController = null;


/* -----------------------------------------------------------
 * Helper localStorage (safe)
 * --------------------------------------------------------- */
function safeGetLS(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSetLS(key, value) {
    try {
        if (value === null || value === undefined) {
            localStorage.removeItem(key);
        } else {
            const val = typeof value === "object" ? JSON.stringify(value) : String(value);
            localStorage.setItem(key, val);
        }
    } catch { /* empty */ }
}


/**
 * LZ-String based compression
 */
function safeSetCompressedJSON(key, data) {
    try {
        const json = JSON.stringify(data);
        const compressed = LZString.compressToUTF16(json);
        localStorage.setItem(key, compressed);
    } catch (e) {
        console.warn("[LZString] Compression failed, saving raw JSON", e);
        safeSetLS(key, data);
    }
}

function safeGetCompressedJSON(key) {
    try {
        const compressed = localStorage.getItem(key);
        if (!compressed) return null;
        
        // Tentative de décompression
        const decompressed = LZString.decompressFromUTF16(compressed);
        if (decompressed) {
            return JSON.parse(decompressed);
        }
        
        // Fallback si c'était pas compressé (migration)
        return JSON.parse(compressed);
    } catch {
        return null;
    }
}

/**
 * Strips unnecessary fields from objects to save cache space
 */
function stripChannel(c) {
    return {
        id: c.id,
        name: c.name,
        topic: c.topic,
        categoryId: c.categoryId,
        position: c.position,
        type: c.type,
        syncedWithCategory: c.syncedWithCategory,
        permissions: c.permissions,
        lastRead: c.lastRead,
        lastMessageId: c.lastMessageId
    };
}

function stripCategory(cat) {
    return {
        id: cat.id,
        name: cat.name,
        position: cat.position
    };
}

function computeChannelHash(channels) {
    return channels.map(c => String(c.id)).sort().join(',');
}

function stripMessage(m) {
    return {
        id: m.id,
        content: m.content,
        authorId: m.authorId,
        authorName: m.authorName,
        authorAvatar: m.authorAvatar,
        createdAt: m.createdAt,
        editedAt: m.editedAt,
        deletedAt: m.deletedAt ?? null,
        replyTo: m.replyTo ?? null,
        reactions: m.reactions ?? [],
        attachments: m.attachments?.map(a => ({ url: a.url, publicId: a.publicId }))
    };
}

function getLastChannelKey(companyId) {
    const cid = companyId ? String(companyId) : "";
    return cid ? `chat:lastChannelId:${cid}` : "chat:lastChannelId";
}



/* -----------------------------------------------------------
 * Helper permissions
 * --------------------------------------------------------- */
function derivePermissionBooleans(perms) {
    if (!perms || typeof perms !== "object") {
        return { canView: false, canSend: false, canManageMessages: false };
    }

    if (perms.can && typeof perms.can === "object") {
        return {
            canView: !!perms.can.viewChannel,
            canSend: !!perms.can.sendMessages,
            canManageMessages: !!perms.can.manageMessages,
        };
    }

    // Case: perms is already the 'can' object (preloaded)
    if (typeof perms.viewChannel !== "undefined") {
        return {
            canView: !!perms.viewChannel,
            canSend: !!perms.sendMessages,
            canManageMessages: !!perms.manageMessages,
        };
    }

    return {
        canView: !!perms.VIEW_CHANNEL,
        canSend: !!perms.SEND_MESSAGES,
        canManageMessages: !!perms.MANAGE_MESSAGES,
    };
}

/* -----------------------------------------------------------
 * Reaction helpers
 * --------------------------------------------------------- */

function updateReaction(reactions, emoji, userId, count) {
    const idx = reactions.findIndex(r => r.emoji === emoji);
    if (idx === -1) {
        return [...reactions, { emoji, count, userIds: [userId] }];
    }
    const updated = [...reactions];
    const r = { ...updated[idx] };
    r.count = count;
    const existing = r.userIds ?? (r.userId != null ? [r.userId] : []);
    r.userIds = existing.some(id => Number(id) === Number(userId)) ? existing : [...existing, userId];
    updated[idx] = r;
    return updated;
}

function removeReactionHelper(reactions, emoji, userId) {
    return reactions.map(r => {
        if (r.emoji !== emoji) return r;
        // normalize: API loads reactions as { userId } (singular), WS events produce { userIds }
        const existing = r.userIds ?? (r.userId != null ? [r.userId] : []);
        const userIds = existing.filter(id => Number(id) !== Number(userId));
        return { ...r, count: Math.max(0, r.count - 1), userIds };
    }).filter(r => r.count > 0);
}

/* -----------------------------------------------------------
 * STORE (Discord-like)
 * --------------------------------------------------------- */

export const useChatStore = create((set, get) => ({

    /* ---------------------------------------------
     * STATE
     * ------------------------------------------- */
    categories: [],
    channels: [],
    messages: {},           // { channelId: Message[] }
    pins: {},               // { [channelId]: [pin, ...] }
    permissionsByChannel: {},
    readStateByChannel: {},

    activeChannelId: null,
    activeChannel: null,
    canViewChannel: false,
    canSendMessage: false,
    canManageMessages: false,

    isLoadingChannels: false,
    isLoadingMessages: false,

    uploadProgress: {},  // { [tempId]: 0-100 }

    // In-memory caching per company
    companyCache: {}, // { [companyId]: { categories, channels, permissionsByChannel } }

    // Cache scoping (évite les reloads inutiles entre navigations)
    initializedCompanyId: null,
    didLoadChannelList: false,

    // Race condition protection
    loadingSessionId: 0,

    // Message editing
    messageBeingEdited: null,   // { id, content }

    /* =============================================
     * loadInitial()
     * =========================================== */
    loadInitial: async () => {
        try {
            set({ isLoadingChannels: true });

            const companyId = safeGetLS("chat:selectedCompanyId") || safeGetLS("lastCompanyId");

            const rawCategories = await chatApi.getCategories(companyId);
            const rawChannels = await chatApi.getChannels(companyId);

            const categories = Array.isArray(rawCategories)
                ? rawCategories
                : rawCategories?.categories || [];

            const channels = Array.isArray(rawChannels)
                ? rawChannels
                : rawChannels?.channels || [];

            set({
                categories,
                channels,
                readStateByChannel: Object.fromEntries(
                    channels.map((c) => [
                        String(c.id),
                        c.lastRead ? String(c.lastRead) : (c.lastMessageId ? String(c.lastMessageId) : null)
                    ])
                ),
                activeChannelId: null,
                activeChannel: null,
                permissionsByChannel: {},
                canViewChannel: false,
                canSendMessage: false,
                canManageMessages: false,
                initializedCompanyId: companyId ? String(companyId) : null,
                didLoadChannelList: true,
                isLoadingChannels: false,
            });
        } catch (e) {
            console.error("[useChatStore] loadInitial failed:", e);
            set({ isLoadingChannels: false });
        }
    },

    /* =============================================
     * ensureInitialized(companyId)
     * - garde le store "chaud" entre les navigations
     * - recharge uniquement si company a changé ou si non initialisé
     * =========================================== */
    ensureInitialized: async (companyIdArg) => {
        const rawCompanyId =
            companyIdArg !== undefined && companyIdArg !== null
                ? String(companyIdArg)
                : safeGetLS("chat:selectedCompanyId") || safeGetLS("lastCompanyId");

        const companyId = rawCompanyId ? String(rawCompanyId) : null;
        if (!companyId) return;

        const state = get();
        const sessionId = ++_sessionId;

        // 1. Déjà sur la bonne company ? On ne fait rien
        if (state.initializedCompanyId === companyId && state.didLoadChannelList) {
            return;
        }

        // 2. Recherche du cache (Mémoire puis LocalStorage compressé)
        const cacheKey = `chat:cache:${companyId}`;
        const memCache = state.companyCache[companyId];
        const cachedData = memCache || safeGetCompressedJSON(cacheKey);
        const hasCache = cachedData && Array.isArray(cachedData.channels);

        if (hasCache) {
            // Affiche le cache immédiatement en attendant la vérif hash
            set({
                initializedCompanyId: companyId,
                loadingSessionId: sessionId,
                categories: cachedData.categories || [],
                channels: cachedData.channels || [],
                permissionsByChannel: cachedData.permissionsByChannel || {},
                didLoadChannelList: true,
                isLoadingChannels: false,
            });
        } else {
            // Pas de cache : loader
            set({
                isLoadingChannels: true,
                initializedCompanyId: companyId,
                loadingSessionId: sessionId,
                didLoadChannelList: false,
                categories: [],
                channels: [],
                messages: {},
                permissionsByChannel: {},
                readStateByChannel: {},
                activeChannelId: null,
                activeChannel: null,
            });
        }

        // Helper pour restaurer le dernier salon (ignore les erreurs FK)
        const restoreLastChannel = async (channelList) => {
            try {
                const stored = safeGetLS(getLastChannelKey(companyId));
                if (stored && channelList.some(c => String(c.id) === String(stored))) {
                    await get().selectChannel(stored);
                } else if (channelList.length > 0 && !get().activeChannelId) {
                    await get().selectChannel(channelList[0].id);
                }
            } catch {
                // Canal supprimé ou inaccessible — ignoré
            }
        };

        try {
            if (hasCache) {
                // Hash check AVANT selectChannel : selectChannel incrémente _sessionId
                // et corromprait le guard loadingSessionId !== sessionId du full refresh
                let cacheValid = false;
                try {
                    const { hash: serverHash } = await chatApi.getChannelsHash(companyId);
                    cacheValid = Boolean(serverHash && cachedData.hash && cachedData.hash === serverHash);
                } catch {
                    // Hash endpoint indisponible → refresh complet
                }

                if (cacheValid) {
                    safeSetLS("chat:selectedCompanyId", companyId);
                    await restoreLastChannel(get().channels);
                    return;
                }
                // Hash différent → refresh silencieux en fond
            }

            // Refresh complet
            const [rawCategories, rawChannels] = await Promise.all([
                chatApi.getCategories(companyId),
                chatApi.getChannels(companyId)
            ]);

            if (get().loadingSessionId !== sessionId) return;

            const categories = (Array.isArray(rawCategories) ? rawCategories : rawCategories?.categories || []).map(stripCategory);
            const channels = (Array.isArray(rawChannels) ? rawChannels : rawChannels?.channels || []).map(stripChannel);
            const hash = computeChannelHash(channels);

            const permissionsByChannel = Object.fromEntries(
                channels.filter((c) => c.permissions).map((c) => [String(c.id), c.permissions])
            );

            set({
                categories,
                channels,
                permissionsByChannel,
                readStateByChannel: Object.fromEntries(
                    channels.map((c) => [String(c.id), c.lastRead ? String(c.lastRead) : (c.lastMessageId ? String(c.lastMessageId) : null)])
                ),
                didLoadChannelList: true,
                isLoadingChannels: false,
                companyCache: {
                    ...get().companyCache,
                    [companyId]: { categories, channels, permissionsByChannel, hash }
                }
            });

            safeSetCompressedJSON(cacheKey, { categories, channels, permissionsByChannel, hash });
            safeSetLS("chat:selectedCompanyId", companyId);

            await restoreLastChannel(channels);
        } catch (e) {
            console.error("[useChatStore] ensureInitialized failed:", e);
            set({ isLoadingChannels: false });
        }
    },

    /* =============================================
     * selectChannel(channelId)
     * =========================================== */
    selectChannel: async (channelId) => {
        if (!channelId) {
            set({
                activeChannelId: null,
                activeChannel: null,
                canViewChannel: false,
                canSendMessage: false,
                canManageMessages: false,
            });
            return;
        }

        const state = get();
        const sessionId = ++_sessionId;
        set({ loadingSessionId: sessionId });

        // Annule le chargement de messages précédent
        if (_messagesAbortController) {
            _messagesAbortController.abort();
        }
        _messagesAbortController = new AbortController();
        const abortSignal = _messagesAbortController.signal;

        const channels = Array.isArray(state.channels) ? state.channels : [];
        const channel = channels.find((c) => String(c.id) === String(channelId));

        if (!channel) {
            console.warn("Attempt to select invalid channel", channelId);
            return;
        }

        // --- OPTIMIZATION (Discord-like) ---
        // On regarde si on a déjà préchargé les permissions
        let perms = state.permissionsByChannel[String(channelId)];

        if (!perms) {
            try {
                perms = await chatApi.getMyPermissions(channelId, state.initializedCompanyId);
            } catch {
                console.warn("Cannot view this channel");
                return;
            }
        }

        if (get().loadingSessionId !== sessionId) return;

        const { canView, canSend, canManageMessages } = derivePermissionBooleans(perms);
        if (!canView) return;

        // Désélectionner le DM
        useDmStore.getState().setActiveConversation(null);

        set({
            activeChannelId: channelId,
            activeChannel: channel,
            canViewChannel: canView,
            canSendMessage: canSend,
            canManageMessages,
        });

        // Persiste le dernier salon (par company)
        const companyId = state.initializedCompanyId || safeGetLS("lastCompanyId");
        safeSetLS(getLastChannelKey(companyId), channelId);

        await get().loadMessages(channelId, sessionId, abortSignal);
        try {
            const result = await chatApi.updateReadState(channelId, state.initializedCompanyId);

            if (get().loadingSessionId !== sessionId) return;

            const lastReadId = result?.lastReadMessageId
                ? String(result.lastReadMessageId)
                : null;

            if (lastReadId) {
                set((state) => {
                    const cid = String(channelId);

                    const updatedReadState = {
                        ...state.readStateByChannel,
                        [cid]: lastReadId,
                    };

                    const updatedChannels = state.channels.map((c) =>
                        String(c.id) === cid
                            ? { ...c, lastRead: lastReadId }
                            : c
                    );

                    return {
                        readStateByChannel: updatedReadState,
                        channels: updatedChannels,
                        activeChannel: {
                            ...state.activeChannel,
                            lastRead: lastReadId,
                        },
                    };
                });
            }
        } catch (err) {
            console.warn("[useChatStore] updateReadState failed:", err);
        }
    },

    /* =============================================
     * loadMessages()
     * =========================================== */
    loadMessages: async (channelId, externalSessionId = null, signal = null) => {
        try {
            const sessionId = externalSessionId || ++_sessionId;
            if (!externalSessionId) {
                set({ loadingSessionId: sessionId });
                if (_messagesAbortController) _messagesAbortController.abort();
                _messagesAbortController = new AbortController();
                signal = _messagesAbortController.signal;
            }

            const currentMsgs = get().messages[channelId];
            const hasMsgs = Array.isArray(currentMsgs) && currentMsgs.length > 0;

            if (!hasMsgs) {
                set({ isLoadingMessages: true });
            }

            const companyId = get().initializedCompanyId;
            const data = await chatApi.getMessages(channelId, { limit: 100, companyId, signal });

            if (get().loadingSessionId !== sessionId) return;

            let items = [];
            if (Array.isArray(data)) items = data;
            else if (Array.isArray(data?.items)) items = data.items;
            else if (Array.isArray(data?.messages)) items = data.messages;

            // ordre chronologique asc + stripping
            items = items.map(stripMessage).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

            // On garde seulement les 100 derniers
            if (items.length > 100) items = items.slice(-100);

            set((state) => ({
                messages: {
                    ...state.messages,
                    [channelId]: items,
                },
                isLoadingMessages: false,
            }));
        } catch (e) {
            if (e?.name === "AbortError" || e?.code === "ERR_CANCELED") return;
            console.error("[useChatStore] loadMessages failed:", e);
            set({ isLoadingMessages: false });
        }
    },

    /* =============================================
     * sendMessage()
     * =========================================== */
    sendMessage: async (channelId, content) => {
        const files = Array.isArray(content?.files) ? content.files.filter(Boolean) : [];
        const hasFiles = files.length > 0;
        let tempId = null;

        if (hasFiles) {
            tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const optimistic = {
                id: tempId,
                content: typeof content?.content === 'string' ? content.content : '',
                authorId: null,
                authorName: '',
                authorAvatar: null,
                createdAt: new Date().toISOString(),
                editedAt: null,
                replyTo: null,
                reactions: [],
                attachments: [],
                status: 'sending',
            };
            set((s) => ({
                messages: { ...s.messages, [channelId]: [...(s.messages[channelId] ?? []), optimistic] },
                uploadProgress: { ...s.uploadProgress, [tempId]: 0 },
            }));
        }

        try {
            const message = await chatApi.sendMessage(channelId, content, {
                onUploadProgress: hasFiles ? (pct) => {
                    set((s) => ({ uploadProgress: { ...s.uploadProgress, [tempId]: pct } }));
                } : null,
            });

            if (hasFiles) {
                set((s) => {
                    const existing = s.messages[channelId] ?? [];
                    const withoutOptimistic = existing.filter((m) => m.id !== tempId);
                    const { [tempId]: _dropped, ...progressRest } = s.uploadProgress;

                    if (!message?.id) {
                        return { messages: { ...s.messages, [channelId]: withoutOptimistic }, uploadProgress: progressRest };
                    }
                    if (withoutOptimistic.some((m) => String(m.id) === String(message.id))) {
                        return { messages: { ...s.messages, [channelId]: withoutOptimistic }, uploadProgress: progressRest };
                    }
                    return {
                        messages: { ...s.messages, [channelId]: [...withoutOptimistic, message] },
                        uploadProgress: progressRest,
                        readStateByChannel: { ...s.readStateByChannel, [String(channelId)]: String(message.id) },
                    };
                });
            } else {
                if (!message || !message.id) return;
                set((state) => {
                    const existing = state.messages[channelId] || [];
                    if (existing.some((m) => String(m.id) === String(message.id))) return {};
                    return {
                        messages: { ...state.messages, [channelId]: [...existing, message] },
                        readStateByChannel: { ...state.readStateByChannel, [String(channelId)]: String(message.id) },
                    };
                });
            }
        } catch (err) {
            if (hasFiles && tempId) {
                set((s) => {
                    const { [tempId]: _dropped, ...progressRest } = s.uploadProgress;
                    return {
                        messages: {
                            ...s.messages,
                            [channelId]: (s.messages[channelId] ?? []).map((m) =>
                                m.id === tempId ? { ...m, status: 'failed', _retryContent: content } : m
                            ),
                        },
                        uploadProgress: progressRest,
                    };
                });
            }
            console.error("sendMessage failed:", err);
            throw err;
        }
    },

    /* =============================================
     * retryMessage()
     * =========================================== */
    retryMessage: async (channelId, tempId) => {
        const msgs = get().messages[channelId] ?? [];
        const failedMsg = msgs.find((m) => m.id === tempId);
        if (!failedMsg?._retryContent) return;
        const content = failedMsg._retryContent;
        set((s) => ({
            messages: { ...s.messages, [channelId]: (s.messages[channelId] ?? []).filter((m) => m.id !== tempId) },
        }));
        await get().sendMessage(channelId, content);
    },

    /* =============================================
     * appendMessageFromEvent(message)
     * Triggered by WebSocket
     * =========================================== */
    appendMessageFromEvent: (channelId, msg) =>
        set((state) => {
            const existing = state.messages[channelId] || [];

            // Empêche le doublon
            if (existing.some((m) => String(m.id) === String(msg.id))) {
                return {};
            }

            const updated = [...existing, msg].sort(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            );

            // Met à jour lastMessageId sur le salon pour que hasUnread() soit correct
            const cid = String(channelId);
            const msgId = String(msg.id);
            const updatedChannels = state.channels.map((c) => {
                if (String(c.id) !== cid) return c;
                try {
                    if (!c.lastMessageId || BigInt(msgId) > BigInt(String(c.lastMessageId))) {
                        return { ...c, lastMessageId: msgId };
                    }
                } catch { /* empty */ }
                return c;
            });

            return {
                messages: {
                    ...state.messages,
                    [channelId]: updated,
                },
                channels: updatedChannels,
            };
        }),

    updateMessageFromEvent: (channelId, msg) =>
        set((state) => {
            const list = state.messages[channelId] || [];
            return {
                messages: {
                    ...state.messages,
                    [channelId]: list.map((m) =>
                        String(m.id) === String(msg.id) ? { ...m, ...msg } : m
                    ),
                },
            };
        }),

    deleteMessageFromEvent: (channelId, messageId) =>
        set((state) => {
            const list = state.messages[channelId] || [];
            return {
                messages: {
                    ...state.messages,
                    [channelId]: list.map((m) =>
                        String(m.id) === String(messageId)
                            ? { ...m, deletedAt: new Date().toISOString(), content: '' }
                            : m
                    ),
                },
            };
        }),


    /* =============================================
     * editMessage()
     * =========================================== */
    editMessage: async (channelId, messageId, content) => {
        try {
            await chatApi.editMessage(channelId, messageId, content);

            set((state) => {
                const list = state.messages[channelId] || [];
                return {
                    messages: {
                        ...state.messages,
                        [channelId]: list.map((m) =>
                            String(m.id) === String(messageId)
                                ? { ...m, content, editedAt: new Date().toISOString() }
                                : m
                        ),
                    },
                    messageBeingEdited: null,
                };
            });
        } catch (err) {
            console.error("editMessage() failed", err);
            throw err;
        }
    },

    startEditingMessage: (message) =>
        set({
            messageBeingEdited: {
                id: message.id,
                content: message.content,
            },
        }),

    stopEditing: () => set({ messageBeingEdited: null }),

    /* =============================================
     * deleteMessage()
     * =========================================== */
    deleteMessage: async (channelId, messageId) => {
        try {
            await chatApi.deleteMessage(channelId, messageId);

            set((state) => {
                const list = state.messages[channelId] || [];
                return {
                    messages: {
                        ...state.messages,
                        [channelId]: list.map((m) =>
                            String(m.id) === String(messageId)
                                ? { ...m, deletedAt: new Date().toISOString(), content: '' }
                                : m
                        ),
                    },
                };
            });
        } catch (err) {
            console.error("deleteMessage() failed", err);
            throw err;
        }
    },

    /* =============================================
     * updateChannel()
     * =========================================== */
    updateChannel: async (channelId, patch) => {
        try {
            await chatApi.updateChannel(channelId, patch);

            set((state) => ({
                channels: state.channels.map((c) =>
                    String(c.id) === String(channelId) ? { ...c, ...patch } : c
                ),
                activeChannel:
                    state.activeChannel?.id === channelId
                        ? { ...state.activeChannel, ...patch }
                        : state.activeChannel,
            }));
        } catch (err) {
            console.error("updateChannel() failed", err);
        }
    },

    /* =============================================
     * deleteChannel()
     * =========================================== */
    deleteChannel: async (channelId) => {
        try {
            await chatApi.deleteChannel(channelId);

            const prevChannels = get().channels;
            const companyId = get().initializedCompanyId;
            const newChannels = prevChannels.filter((c) => String(c.id) !== String(channelId));

            set((state) => ({
                channels: newChannels,
                activeChannelId: state.activeChannelId === channelId ? null : state.activeChannelId,
                activeChannel: state.activeChannelId === channelId ? null : state.activeChannel,
            }));

            // Mise à jour du cache LS pour éviter le flash au prochain refresh
            if (companyId) {
                const cacheKey = `chat:cache:${companyId}`;
                const cached = safeGetCompressedJSON(cacheKey);
                if (cached) {
                    safeSetCompressedJSON(cacheKey, {
                        ...cached,
                        channels: newChannels,
                        hash: computeChannelHash(newChannels),
                    });
                }
            }
        } catch (err) {
            console.error("deleteChannel() failed", err);
        }
    },

    /* =============================================
     * deleteCategory()
     * =========================================== */
    deleteCategory: async (categoryId) => {
        try {
            await chatApi.deleteCategory(categoryId);

            set((state) => ({
                categories: state.categories.filter(
                    (cat) => String(cat.id) !== String(categoryId)
                ),
            }));
        } catch (err) {
            console.error("deleteCategory() failed", err);
        }
    },

    hasUnread: (channelId) => {
        const state = get();
        const cid = String(channelId);

        const channel = state.channels.find((c) => String(c.id) === cid);
        if (!channel) return false;

        const lastMessageId = channel.lastMessageId
            ? String(channel.lastMessageId)
            : null;

        const lastReadId = state.readStateByChannel[cid]
            ? String(state.readStateByChannel[cid])
            : null;

        if (!lastMessageId) return false;
        if (!lastReadId) return false;

        try {
            return BigInt(lastMessageId) > BigInt(lastReadId);
        } catch {
            return false;
        }
    },

    updateChannelSynced: (channelId, synced) => set((s) => {
        const cid = String(channelId);
        return {
            channels: s.channels.map((c) =>
                String(c.id) === cid ? { ...c, syncedWithCategory: synced } : c
            ),
            activeChannel:
                s.activeChannel && String(s.activeChannel.id) === cid
                    ? { ...s.activeChannel, syncedWithCategory: synced }
                    : s.activeChannel,
        };
    }),

    markAsRead: async (channelId) => {
        try {
            const state = get();
            const result = await chatApi.updateReadState(channelId, state.initializedCompanyId);
            const lastReadId = result?.lastReadMessageId ? String(result.lastReadMessageId) : null;

            if (lastReadId) {
                set((s) => {
                    const cid = String(channelId);
                    return {
                        readStateByChannel: {
                            ...s.readStateByChannel,
                            [cid]: lastReadId,
                        },
                        channels: s.channels.map((c) =>
                            String(c.id) === cid ? { ...c, lastRead: lastReadId } : c
                        ),
                        activeChannel:
                            s.activeChannel?.id === channelId
                                ? { ...s.activeChannel, lastRead: lastReadId }
                                : s.activeChannel,
                    };
                });
            }
        } catch (err) {
            console.error("[useChatStore] markAsRead failed:", err);
        }
    },

    /* =============================================
     * Reaction actions
     * =========================================== */
    addReactionToMessage: (channelId, messageId, { emoji, userId, count }) => {
        set(s => {
            const key = String(channelId);
            const msgs = s.messages[key] ?? [];
            return {
                messages: {
                    ...s.messages,
                    [key]: msgs.map(m =>
                        String(m.id) === String(messageId)
                            ? { ...m, reactions: updateReaction(m.reactions ?? [], emoji, userId, count) }
                            : m
                    ),
                },
            };
        });
    },

    removeReactionFromMessage: (channelId, messageId, emoji, userId) => {
        set(s => {
            const key = String(channelId);
            const msgs = s.messages[key] ?? [];
            return {
                messages: {
                    ...s.messages,
                    [key]: msgs.map(m =>
                        String(m.id) === String(messageId)
                            ? { ...m, reactions: removeReactionHelper(m.reactions ?? [], emoji, userId) }
                            : m
                    ),
                },
            };
        });
    },

    /* =============================================
     * Pin actions
     * =========================================== */
    addPin: (channelId, pin) => {
        set(s => {
            const key = String(channelId);
            const existing = s.pins[key] ?? [];
            if (existing.some(p => String(p.messageId) === String(pin.messageId))) return s;
            return { pins: { ...s.pins, [key]: [pin, ...existing] } };
        });
    },

    removePin: (channelId, messageId) => {
        set(s => {
            const key = String(channelId);
            return {
                pins: {
                    ...s.pins,
                    [key]: (s.pins[key] ?? []).filter(p => String(p.messageId) !== String(messageId)),
                },
            };
        });
    },

    loadPins: async (channelId) => {
        try {
            const { getChannelPins } = await import('@/services/chatService');
            const pins = await getChannelPins(channelId);
            set(s => ({ pins: { ...s.pins, [String(channelId)]: pins } }));
        } catch (err) {
            console.error('[chat] loadPins failed:', err);
        }
    },
}));