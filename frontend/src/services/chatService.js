// src/services/chatService.js
import apiClient from "./api";

/* ================================
 *  CATEGORIES
 * ================================ */

export function getCategories(companyId) {
    const headers = companyId ? { "x-company-id": String(companyId) } : {};
    return apiClient.get(`/chat/categories`, { headers }).then(r => r.data);
}

export function createCategory(data) {
    return apiClient.post(`/chat/categories`, data).then(r => r.data);
}

export function updateCategory(categoryId, data) {
    return apiClient.patch(`/chat/categories/${categoryId}`, data).then(r => r.data);
}

export function deleteCategory(categoryId) {
    return apiClient.delete(`/chat/categories/${categoryId}`).then(r => r.data);
}


/* ================================
 *  CHANNELS
 * ================================ */

export function getChannels(companyId) {
    const headers = companyId ? { "x-company-id": String(companyId) } : {};
    return apiClient.get(`/chat/channels`, { headers }).then(r => r.data);
}

export function getChannelsHash(companyId) {
    const headers = companyId ? { "x-company-id": String(companyId) } : {};
    return apiClient.get(`/chat/channels/hash`, { headers }).then(r => r.data);
}

export function getUnreadCount(companyId) {
    const headers = companyId ? { "x-company-id": String(companyId) } : {};
    return apiClient.get(`/chat/unread-count`, { headers }).then((r) => r.data);
}

export function getTotalUnreadCounts() {
    return apiClient.get(`/chat/total-unread-counts`).then((r) => r.data);
}

export function createChannel(data) {
    return apiClient.post(`/chat/channels`, data).then(r => r.data);
}

export function getChannel(channelId, companyId) {
    const headers = companyId ? { "x-company-id": String(companyId) } : {};
    return apiClient.get(`/chat/channels/${channelId}`, { headers }).then(r => r.data);
}

export function updateChannel(channelId, data) {
    return apiClient.patch(`/chat/channels/${channelId}`, data).then(r => r.data);
}

export function deleteChannel(channelId) {
    return apiClient.delete(`/chat/channels/${channelId}`).then(r => r.data);
}


/* ================================
 *  MESSAGES
 * ================================ */

export function getMessages(channelId, { cursor = null, limit = 100, companyId = null, signal = null } = {}) {
    const headers = companyId ? { "x-company-id": String(companyId) } : {};
    return apiClient.get(`/chat/channels/${channelId}/messages`, {
        params: {
            limit,
            ...(cursor ? { cursor } : {}),
        },
        headers,
        ...(signal ? { signal } : {}),
    }).then(r => r.data);
}

function normalizeMessageInput(input) {
    // Support calls like:
    // - sendMessage(channelId, { content: "hi", files: [File] })
    // - sendMessage(channelId, { content: { content: "hi", files: [File] } })
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return { text: "", files: [] };
    }

    let obj = input;

    // Unwrap accidental nesting: { content: { content, files } }
    if (obj.content && typeof obj.content === "object" && !Array.isArray(obj.content)) {
        const inner = obj.content;
        if ("files" in inner || "content" in inner) {
            obj = inner;
        }
    }

    const text = typeof obj.content === "string" ? obj.content : "";

    const rawFiles = Array.isArray(obj.files) ? obj.files : [];
    const files = [];

    for (const item of rawFiles) {
        const f = item?.file ?? item; // support { file: File }
        if (!f) continue;

        // File extends Blob in the browser
        if (typeof Blob !== "undefined" && f instanceof Blob) {
            files.push(f);
        }
    }

    return { text, files };
}

export function sendMessageMultipart(channelId, { content = "", files = [], replyToId = null, onUploadProgress = null } = {}) {
    const fd = new FormData();
    fd.append("content", String(content ?? ""));
    if (replyToId != null) fd.append("replyToId", String(replyToId));

    const safeFiles = Array.isArray(files) ? files : [];

    safeFiles.forEach((f) => {
        if (!f) return;

        // File extends Blob
        if (typeof Blob !== "undefined" && !(f instanceof Blob)) return;

        // fieldname attendu backend: "attachments"
        // Si ce n'est pas un File (ex: Blob), on fournit un nom.
        if (typeof File !== "undefined" && f instanceof File) {
            fd.append("attachments", f);
        } else {
            fd.append("attachments", f, "attachment");
        }
    });

    const config = {};
    if (typeof onUploadProgress === 'function') {
        config.onUploadProgress = (e) => {
            if (e.total) onUploadProgress(Math.round(e.loaded * 100 / e.total));
        };
    }

    // ⚠️ Ne pas forcer "Content-Type": axios ajoutera le boundary correctement
    return apiClient.post(`/chat/channels/${channelId}/messages`, fd, config).then((r) => r.data);
}

/**
 * Compatible:
 * - sendMessage(channelId, "hello")
 * - sendMessage(channelId, { content: "hello", files: [File, ...] })
 * - sendMessage(channelId, { content: { content: "hello", files: [...] } })  // accidental nesting
 */
export function sendMessage(channelId, content, options = {}) {
    if (content && typeof content === "object" && !Array.isArray(content)) {
        const { text, files } = normalizeMessageInput(content);
        const replyToId = content.replyToId ?? null;

        if (files.length > 0) {
            return sendMessageMultipart(channelId, { content: text, files, replyToId, onUploadProgress: options.onUploadProgress ?? null });
        }

        const body = { content: text };
        if (replyToId != null) body.replyToId = replyToId;
        return apiClient.post(`/chat/channels/${channelId}/messages`, body).then((r) => r.data);
    }

    // Legacy string
    return apiClient
        .post(`/chat/channels/${channelId}/messages`, { content: String(content ?? "") })
        .then((r) => r.data);
}

export function editMessage(channelId, messageId, content) {
    return apiClient
        .patch(`/chat/channels/${channelId}/messages/${messageId}`, { content })
        .then((r) => r.data);
}

export function deleteMessage(channelId, messageId) {
    return apiClient
        .delete(`/chat/channels/${channelId}/messages/${messageId}`)
        .then((r) => r.data);
}

export function getMessageEditHistory(channelId, messageId) {
    return apiClient
        .get(`/chat/channels/${channelId}/messages/${messageId}/history`)
        .then((r) => r.data);
}


/* ================================
 *  READ STATE
 * ================================ */

export function getReadState(channelId, companyId) {
    const headers = companyId ? { "x-company-id": String(companyId) } : {};
    return apiClient.get(`/chat/channels/${channelId}/read-state`, { headers }).then(r => r.data);
}

export function updateReadState(channelId, companyId) {
    const headers = companyId ? { "x-company-id": String(companyId) } : {};
    return apiClient.post(`/chat/channels/${channelId}/read-state`, {}, { headers })
        .then((r) => r.data);
}

export function markGuildAsRead(companyId) {
    return apiClient.post(`/chat/companies/${companyId}/mark-all-read`).then(r => r.data);
}

export function ackChannelRead(channelId, messageId) {
    return apiClient.post(`/chat/channels/${channelId}/ack`, { messageId: String(messageId) });
}


/* ================================
 *  PERMISSIONS
 * ================================ */

export function getPermissionCatalog() {
    return apiClient.get(`/chat/permissions/catalog`).then(r => r.data);
}

// Rank global
export function getRankPermissions(rankId) {
    return apiClient.get(`/chat/permissions/rank/${rankId}`).then(r => r.data);
}

export function setRankPermissions(rankId, data) {
    return apiClient.post(`/chat/permissions/rank/${rankId}`, data).then(r => r.data);
}

/* ================================
 * OVERRIDES RANK pour un salon
 * ================================ */

export function getChannelRankOverrides(channelId) {
    return apiClient.get(`/chat/channels/${channelId}/overrides/rank`).then(r => r.data);
}

export function setChannelRankOverride(channelId, rankId, data) {
    return apiClient.post(`/chat/channels/${channelId}/overrides/rank/${rankId}`, data).then(r => r.data);
}

export function deleteChannelRankOverride(channelId, rankId) {
    return apiClient.delete(`/chat/channels/${channelId}/overrides/rank/${rankId}`).then(r => r.data);
}


/* ================================
 * OVERRIDES USER pour un salon
 * ================================ */

export function getChannelUserOverrides(channelId) {
    return apiClient.get(`/chat/channels/${channelId}/overrides/user`).then(r => r.data);
}

export function setChannelUserOverride(channelId, userId, data) {
    return apiClient.post(`/chat/channels/${channelId}/overrides/user/${userId}`, data).then(r => r.data);
}

export function deleteChannelUserOverride(channelId, userId) {
    return apiClient.delete(`/chat/channels/${channelId}/overrides/user/${userId}`).then(r => r.data);
}

/* ================================
 * CHANNEL ↔ CATEGORY SYNC
 * ================================ */

export function syncChannelToCategory(channelId) {
    return apiClient.post(`/chat/channels/${channelId}/sync`).then(r => r.data);
}

/* ================================
 * OVERRIDES RANK pour une catégorie
 * ================================ */

export function getCategoryRankOverrides(categoryId) {
    return apiClient.get(`/chat/categories/${categoryId}/overrides/rank`).then(r => r.data);
}

export function setCategoryRankOverride(categoryId, rankId, data) {
    return apiClient.post(`/chat/categories/${categoryId}/overrides/rank/${rankId}`, data).then(r => r.data);
}

export function deleteCategoryRankOverride(categoryId, rankId) {
    return apiClient.delete(`/chat/categories/${categoryId}/overrides/rank/${rankId}`).then(r => r.data);
}

/* ================================
 * OVERRIDES USER pour une catégorie
 * ================================ */

export function getCategoryUserOverrides(categoryId) {
    return apiClient.get(`/chat/categories/${categoryId}/overrides/user`).then(r => r.data);
}

export function setCategoryUserOverride(categoryId, userId, data) {
    return apiClient.post(`/chat/categories/${categoryId}/overrides/user/${userId}`, data).then(r => r.data);
}

export function deleteCategoryUserOverride(categoryId, userId) {
    return apiClient.delete(`/chat/categories/${categoryId}/overrides/user/${userId}`).then(r => r.data);
}


/* ================================
 *  PERMISSION EFFECTIVE
 * ================================ */

export function getMyPermissions(channelId, companyId) {
    const headers = companyId ? { "x-company-id": String(companyId) } : {};
    return apiClient.get(`/chat/channels/${channelId}/permissions`, { headers }).then(r => r.data);
}

/* ================================
 *  DMS
 * ================================ */

export function getDmConversations() {
    return apiClient.get(`/chat/dm`).then(r => r.data);
}

export function getOrCreateDmConversation(targetUserId) {
    return apiClient.get(`/chat/dm/${targetUserId}`).then(r => r.data);
}

export function getDmMessages(conversationId) {
    return apiClient.get(`/chat/dm/conversations/${conversationId}/messages`).then(r => r.data);
}

export function sendDmMessage(conversationId, content) {
    return apiClient.post(`/chat/dm/conversations/${conversationId}/messages`, { content }).then(r => r.data);
}

/* ================================
 *  DMS V2 (tchatv2 natif)
 * ================================ */

export function v2GetDms() {
    return apiClient.get('/tchatv2/dm').then(r => r.data);
}

export function v2OpenDm(targetUserId) {
    return apiClient.post(`/tchatv2/dm/${targetUserId}`).then(r => r.data);
}

export function v2CreateGroupDm(memberIds, name = '') {
    return apiClient.post('/tchatv2/dm/group', { memberIds, name }).then(r => r.data);
}

export function v2CloseDm(channelId) {
    return apiClient.delete(`/tchatv2/dm/${channelId}`).then(r => r.data);
}

export function v2GetDmMessages(channelId, { before, limit } = {}) {
    const params = {};
    if (before) params.before = before;
    if (limit)  params.limit  = limit;
    return apiClient.get(`/tchatv2/dm/${channelId}/messages`, { params }).then(r => r.data);
}

export function v2SendDmMessage(channelId, content) {
    return apiClient.post(`/tchatv2/dm/${channelId}/messages`, { content }).then(r => r.data);
}


/* ================================
 *  PRESENCE
 * ================================ */

export const getPresence = () =>
    apiClient.get('/chat/presence').then(r => r.data);

export const updatePresence = (data) =>
    apiClient.put('/chat/presence', data).then(r => r.data);

export const heartbeatPresence = () =>
    apiClient.post('/chat/presence/heartbeat').then(r => r.data);


/* ================================
 *  PINS
 * ================================ */

export const getChannelPins = (channelId) =>
    apiClient.get(`/chat/channels/${channelId}/pins`).then(r => r.data);

export const pinMessage = (channelId, messageId) =>
    apiClient.post(`/chat/channels/${channelId}/messages/${messageId}/pin`).then(r => r.data);

export const unpinMessage = (channelId, messageId) =>
    apiClient.delete(`/chat/channels/${channelId}/messages/${messageId}/pin`);


/* ================================
 *  CHANNEL MEMBERS
 * ================================ */

export const getChannelMembers = (channelId) =>
    apiClient.get(`/chat/channels/${channelId}/members`).then(r => r.data);

/* ================================
 *  REACTIONS
 * ================================ */

export const addReaction = (channelId, messageId, emoji) =>
    apiClient.post(`/chat/channels/${channelId}/messages/${messageId}/reactions`, { emoji }).then(r => r.data);

export const removeReaction = (channelId, messageId, emoji) =>
    apiClient.delete(`/chat/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);