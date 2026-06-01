import { create } from "zustand";
import * as chatApi from "../../services/chatService";
import { useChatStore } from "./useChatStore";

const LS_KEY = "chat:dm-conversations-v2";

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveToStorage(convs) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(convs));
    } catch { /* empty */ }
}

export const useDmStore = create((set, get) => ({
    conversations: loadFromStorage(),
    messages: {}, // { channelId: V2Message[] }
    activeConversationId: null,
    activeConversation: null,

    isLoadingConversations: false,
    isLoadingMessages: false,

    // Charger la liste des DMs depuis /tchatv2/dm
    loadConversations: async ({ force = false } = {}) => {
        const { conversations, isLoadingConversations } = get();
        if (!force && conversations.length > 0) {
            chatApi.v2GetDms()
                .then(convs => {
                    saveToStorage(convs);
                    set({ conversations: convs });
                })
                .catch(err => console.warn('loadConversations background refresh:', err));
            return;
        }
        if (isLoadingConversations) return;
        try {
            set({ isLoadingConversations: true });
            const convs = await chatApi.v2GetDms();
            saveToStorage(convs);
            set({ conversations: convs, isLoadingConversations: false });
        } catch (e) {
            console.error("loadConversations error:", e);
            set({ isLoadingConversations: false });
        }
    },

    setActiveConversation: async (conversationId) => {
        if (!conversationId) {
            set({ activeConversationId: null, activeConversation: null });
            return;
        }

        const { conversations, messages } = get();
        const conv = conversations.find(c => c.id === conversationId);

        if (!conv) return;

        // Désélectionner le channel normal
        const chatStore = useChatStore.getState();
        if (chatStore.activeChannelId) {
            chatStore.selectChannel(null);
        }

        const currentMsgs = messages[conversationId];
        const hasMsgs = Array.isArray(currentMsgs) && currentMsgs.length > 0;

        if (!hasMsgs) {
            set({ activeConversationId: conversationId, activeConversation: conv, isLoadingMessages: true });
        } else {
            set({ activeConversationId: conversationId, activeConversation: conv });
        }

        try {
            const data = await chatApi.v2GetDmMessages(conversationId);
            let msgs = Array.isArray(data) ? data : (data?.messages || []);
            if (msgs.length > 100) msgs = msgs.slice(-100);

            set(state => ({
                messages: { ...state.messages, [conversationId]: msgs },
                isLoadingMessages: false,
            }));
        } catch (e) {
            console.error("fetch dm messages error:", e);
            set({ isLoadingMessages: false });
        }
    },

    // Ouvrir ou créer un DM 1-1 avec un user → POST /tchatv2/dm/:targetUserId
    openConversationWithUser: async (targetUserId) => {
        try {
            const conv = await chatApi.v2OpenDm(targetUserId);
            await get().loadConversations({ force: true });
            get().setActiveConversation(conv.id);
            return conv;
        } catch (e) {
            console.error("open dm error:", e);
        }
    },

    // Envoyer un message dans le DM actif → POST /tchatv2/dm/:channelId/messages
    sendMessage: async (content) => {
        const { activeConversationId } = get();
        if (!activeConversationId) return;

        try {
            const newMsg = await chatApi.v2SendDmMessage(activeConversationId, content);
            get().addMessage(activeConversationId, newMsg);
        } catch (e) {
            console.error("send dm error:", e);
        }
    },

    // Fermer (cacher) un DM → DELETE /tchatv2/dm/:channelId
    closeDm: async (channelId) => {
        try {
            await chatApi.v2CloseDm(channelId);
            set(state => ({
                conversations: state.conversations.filter(c => c.id !== channelId),
                activeConversationId: state.activeConversationId === channelId ? null : state.activeConversationId,
                activeConversation:   state.activeConversationId === channelId ? null : state.activeConversation,
            }));
            saveToStorage(get().conversations);
        } catch (e) {
            console.error("close dm error:", e);
        }
    },

    addMessage: (conversationId, msg) => {
        set(state => {
            const list = state.messages[conversationId] || [];
            if (list.some(m => m.id === msg.id)) return state;
            return {
                messages: {
                    ...state.messages,
                    [conversationId]: [...list, msg],
                },
            };
        });
    },
}));
