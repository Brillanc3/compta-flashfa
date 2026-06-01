import apiClient from '@/services/api';

const PREFIX = '/tchatv2';

const v2 = {
    get:    (url, cfg)       => apiClient.get(PREFIX + url, cfg),
    post:   (url, data, cfg) => apiClient.post(PREFIX + url, data, cfg),
    patch:  (url, data, cfg) => apiClient.patch(PREFIX + url, data, cfg),
    put:    (url, data, cfg) => apiClient.put(PREFIX + url, data, cfg),
    delete: (url, cfg)       => apiClient.delete(PREFIX + url, cfg),
};

/* Guilds */
export const fetchUserGuilds   = ()              => v2.get('/users/@me/guilds').then(r => r.data);
export const refreshUserCache  = ()              => v2.post('/users/@me/refresh-cache').then(r => r.data);
export const fetchGuild        = (guildId)       => v2.get(`/guilds/${guildId}`).then(r => r.data);
export const updateGuild       = (guildId, body) =>
    v2.patch(`/guilds/${guildId}`, body).then(r => r.data);
export const uploadGuildIcon   = (guildId, formData) =>
    v2.post(`/guilds/${guildId}/icon`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const uploadGuildBanner = (guildId, formData) =>
    v2.post(`/guilds/${guildId}/banner`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);

/* Guild Emojis */
export const fetchGuildEmojis  = (guildId) =>
    v2.get(`/guilds/${guildId}/emojis`).then(r => r.data);
export const createGuildEmoji  = (guildId, formData) =>
    v2.post(`/guilds/${guildId}/emojis`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const deleteGuildEmoji  = (guildId, emojiId) =>
    v2.delete(`/guilds/${guildId}/emojis/${emojiId}`).then(r => r.data);

/* Guild Bans */
export const fetchGuildBans    = (guildId) =>
    v2.get(`/guilds/${guildId}/bans`).then(r => r.data);
export const createGuildBan    = (guildId, userId, body = {}) =>
    v2.put(`/guilds/${guildId}/bans/${userId}`, body).then(r => r.data);
export const deleteGuildBan    = (guildId, userId) =>
    v2.delete(`/guilds/${guildId}/bans/${userId}`).then(r => r.data);
export const kickMember        = (guildId, userId) =>
    v2.delete(`/guilds/${guildId}/members/${userId}`).then(r => r.data);
export const timeoutMember     = (guildId, userId, until) =>
    v2.patch(`/guilds/${guildId}/members/${userId}/timeout`, { until }).then(r => r.data);
export const fetchAuditLogs    = (guildId, params = {}) =>
    v2.get(`/guilds/${guildId}/audit-logs`, { params }).then(r => r.data);

/* Guild Notif Settings */
export const getGuildNotifSettings = (guildId) =>
    v2.get(`/guilds/${guildId}/notif-settings/guild`).then(r => r.data);
export const setGuildNotifSettings = (guildId, body) =>
    v2.put(`/guilds/${guildId}/notif-settings/guild`, body).then(r => r.data);

/* Channels */
export const fetchChannels     = (guildId)       => v2.get(`/guilds/${guildId}/channels`).then(r => r.data);
export const createChannel     = (guildId, body) => v2.post(`/guilds/${guildId}/channels`, body).then(r => r.data);
export const updateChannel     = (guildId, channelId, body) =>
    v2.patch(`/guilds/${guildId}/channels/${channelId}`, body).then(r => r.data);
export const deleteChannel     = (guildId, channelId) =>
    v2.delete(`/guilds/${guildId}/channels/${channelId}`).then(r => r.data);
export const reorderChannels   = (guildId, items) =>
    v2.patch(`/guilds/${guildId}/channels`, items).then(r => r.data);

/* Channel overwrites */
export const upsertOverwrite   = (guildId, channelId, targetId, body) =>
    v2.put(`/guilds/${guildId}/channels/${channelId}/permissions/${targetId}`, body).then(r => r.data);
export const deleteOverwrite   = (guildId, channelId, targetId) =>
    v2.delete(`/guilds/${guildId}/channels/${channelId}/permissions/${targetId}`).then(r => r.data);

/* Messages */
export const fetchMessages     = (guildId, channelId, params = {}, config = {}) =>
    v2.get(`/guilds/${guildId}/channels/${channelId}/messages`, { params, ...config }).then(r => r.data);

export const sendMessage       = (guildId, channelId, body) =>
    v2.post(`/guilds/${guildId}/channels/${channelId}/messages`, body).then(r => r.data);

export const editMessage       = (guildId, channelId, messageId, body) =>
    v2.patch(`/guilds/${guildId}/channels/${channelId}/messages/${messageId}`, body).then(r => r.data);

export const deleteMessage     = (guildId, channelId, messageId) =>
    v2.delete(`/guilds/${guildId}/channels/${channelId}/messages/${messageId}`).then(r => r.data);

export const getMessageEditHistory = (guildId, channelId, messageId) =>
    v2.get(`/guilds/${guildId}/channels/${channelId}/messages/${messageId}/history`).then(r => r.data);

export const ackRead = (guildId, channelId, messageId) =>
    v2.post(`/guilds/${guildId}/channels/${channelId}/ack`, { messageId }).then(r => r.data);

export const fetchReadStates = (guildId, channelId) =>
    v2.get(`/guilds/${guildId}/channels/${channelId}/read-states`).then(r => r.data);

/* Members */
export const fetchMembers      = (guildId, params = {}) =>
    v2.get(`/guilds/${guildId}/members`, { params }).then(r => r.data);

/* Presences */
export const fetchPresences    = (guildId) =>
    v2.get(`/guilds/${guildId}/presences`).then(r => r.data);

/* Roles */
export const fetchRoles        = (guildId)             => v2.get(`/guilds/${guildId}/roles`).then(r => r.data);
export const createRole        = (guildId, body)       => v2.post(`/guilds/${guildId}/roles`, body).then(r => r.data);
export const updateRole        = (guildId, roleId, body) => v2.patch(`/guilds/${guildId}/roles/${roleId}`, body).then(r => r.data);
export const deleteRole        = (guildId, roleId)     => v2.delete(`/guilds/${guildId}/roles/${roleId}`).then(r => r.data);
export const reorderRoles      = (guildId, items)      => v2.patch(`/guilds/${guildId}/roles`, items).then(r => r.data);

/* Reactions */
export const addReaction       = (guildId, channelId, messageId, emoji) =>
    v2.put(`/guilds/${guildId}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`).then(r => r.data);

export const removeReaction    = (guildId, channelId, messageId, emoji) =>
    v2.delete(`/guilds/${guildId}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`).then(r => r.data);

export const listReactionUsers = (guildId, channelId, messageId, emoji, params = {}) =>
    v2.get(`/guilds/${guildId}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { params }).then(r => r.data);

/* Pins */
export const fetchPins         = (guildId, channelId) =>
    v2.get(`/guilds/${guildId}/channels/${channelId}/pins`).then(r => r.data);
export const pinMessage        = (guildId, channelId, messageId) =>
    v2.put(`/guilds/${guildId}/channels/${channelId}/pins/${messageId}`).then(r => r.data);
export const unpinMessage      = (guildId, channelId, messageId) =>
    v2.delete(`/guilds/${guildId}/channels/${channelId}/pins/${messageId}`).then(r => r.data);

/* Threads */
export const createThreadFromMessage = (guildId, channelId, messageId, body) =>
    v2.post(`/guilds/${guildId}/channels/${channelId}/messages/${messageId}/threads`, body).then(r => r.data);
export const createPrivateThread     = (guildId, channelId, body) =>
    v2.post(`/guilds/${guildId}/channels/${channelId}/threads`, body).then(r => r.data);
export const listActiveThreads       = (guildId, channelId) =>
    v2.get(`/guilds/${guildId}/channels/${channelId}/threads/active`).then(r => r.data?.threads ?? r.data);
export const listArchivedThreads     = (guildId, channelId, params = {}) =>
    v2.get(`/guilds/${guildId}/channels/${channelId}/threads/archived`, { params }).then(r => r.data?.threads ?? r.data);
export const deleteThread            = (guildId, channelId) =>
    v2.delete(`/guilds/${guildId}/channels/${channelId}/thread`).then(r => r.data);
export const updateThread            = (guildId, channelId, body) =>
    v2.patch(`/guilds/${guildId}/channels/${channelId}/thread`, body).then(r => r.data);
export const reorderForumPosts       = (guildId, channelId, items) =>
    v2.patch(`/guilds/${guildId}/channels/${channelId}/forum-threads/reorder`, items).then(r => r.data);

/* Forum posts */
export const createForumPost        = (guildId, channelId, body) =>
    v2.post(`/guilds/${guildId}/channels/${channelId}/forum-threads`, body).then(r => r.data);
export const listActiveForumPosts   = (guildId, channelId, params = {}) =>
    v2.get(`/guilds/${guildId}/channels/${channelId}/forum-threads/active`, { params }).then(r => r.data?.threads ?? r.data);
export const listArchivedForumPosts = (guildId, channelId, params = {}) =>
    v2.get(`/guilds/${guildId}/channels/${channelId}/forum-threads/archived`, { params }).then(r => r.data?.threads ?? r.data);

/* Forum Tags */
export const listForumTags   = (guildId, channelId) =>
    v2.get(`/guilds/${guildId}/channels/${channelId}/forum-tags`).then(r => r.data?.tags ?? r.data);
export const createForumTag  = (guildId, channelId, body) =>
    v2.post(`/guilds/${guildId}/channels/${channelId}/forum-tags`, body).then(r => r.data);
export const deleteForumTag  = (guildId, channelId, tagId) =>
    v2.delete(`/guilds/${guildId}/channels/${channelId}/forum-tags/${tagId}`).then(r => r.data);
export const setThreadTags   = (guildId, threadId, tagIds) =>
    v2.patch(`/guilds/${guildId}/threads/${threadId}/tags`, { tagIds }).then(r => r.data);

/* Forum Subscriptions */
export const getForumSubscription   = (guildId, channelId) =>
    v2.get(`/guilds/${guildId}/channels/${channelId}/forum-subscribe`).then(r => r.data);

export const subscribeToForum       = (guildId, channelId) =>
    v2.put(`/guilds/${guildId}/channels/${channelId}/forum-subscribe`);

export const unsubscribeFromForum   = (guildId, channelId) =>
    v2.delete(`/guilds/${guildId}/channels/${channelId}/forum-subscribe`);

/* Forum Post Subscriptions (thread-level) */
export const getPostSubscription      = (guildId, threadId) =>
    v2.get(`/guilds/${guildId}/channels/${threadId}/post-subscribe`).then(r => r.data);

export const subscribeToPost          = (guildId, threadId) =>
    v2.put(`/guilds/${guildId}/channels/${threadId}/post-subscribe`);

export const unsubscribeFromPost      = (guildId, threadId) =>
    v2.delete(`/guilds/${guildId}/channels/${threadId}/post-subscribe`);

export const listPostSubscribers      = (guildId, threadId) =>
    v2.get(`/guilds/${guildId}/channels/${threadId}/post-subscribers`).then(r => r.data);

export const listSubscribedForumPosts = (guildId) =>
    v2.get(`/guilds/${guildId}/subscribed-forum-posts`).then(r => r.data);

/* Notification Settings (per-channel, per-user) */
export const getNotifSettings = (guildId, channelId) =>
    v2.get(`/guilds/${guildId}/channels/${channelId}/notif-settings`).then(r => r.data);

export const setNotifSettings = (guildId, channelId, body) =>
    v2.put(`/guilds/${guildId}/channels/${channelId}/notif-settings`, body).then(r => r.data);

export const listGuildNotifSettings = (guildId) =>
    v2.get(`/guilds/${guildId}/notif-settings`).then(r => r.data);

export const ackChannel = (guildId, channelId, messageId) =>
    v2.post(`/guilds/${guildId}/channels/${channelId}/ack`, { messageId });

/* Polls */
export const createPoll = (guildId, channelId, messageId, body) =>
    v2.post(`/guilds/${guildId}/channels/${channelId}/messages/${messageId}/poll`, body).then(r => r.data);
export const getPoll    = (guildId, pollId) =>
    v2.get(`/guilds/${guildId}/polls/${pollId}`).then(r => r.data);
export const votePoll   = (guildId, pollId, optionIds) =>
    v2.post(`/guilds/${guildId}/polls/${pollId}/vote`, { optionIds }).then(r => r.data);
export const joinThread              = (guildId, channelId) =>
    v2.put(`/guilds/${guildId}/channels/${channelId}/thread-members/@me`).then(r => r.data);
export const leaveThread             = (guildId, channelId) =>
    v2.delete(`/guilds/${guildId}/channels/${channelId}/thread-members/@me`).then(r => r.data);

/* DMs */
export const fetchDms        = ()                        => v2.get('/dm').then(r => r.data);
export const openDm          = (targetUserId)            => v2.post(`/dm/${targetUserId}`, {}).then(r => r.data);
export const createGroupDm   = (body)                    => v2.post('/dm/group', body).then(r => r.data);
export const closeDm         = (channelId)               => v2.delete(`/dm/${channelId}`).then(r => r.data);
export const fetchDmMessages = (channelId, params = {})  => v2.get(`/dm/${channelId}/messages`, { params }).then(r => r.data);
export const sendDmMessage   = (channelId, body)         => v2.post(`/dm/${channelId}/messages`, body).then(r => r.data);
export const deleteDmMessage = (channelId, messageId)    => v2.delete(`/dm/${channelId}/messages/${messageId}`).then(r => r.data);

/* Guild-level invites (no channel required) */
export const fetchGuildInvites  = (guildId)        => v2.get(`/guilds/${guildId}/invites`).then(r => r.data);
export const createGuildInvite  = (guildId, body)  => v2.post(`/guilds/${guildId}/invites`, body).then(r => r.data);

/* Mutual members (for guild invite modal) */
export const fetchMutualMembers = ({ q, excludeGuildId, limit } = {}) => {
    const params = {};
    if (q && q.trim()) params.q = q.trim();
    if (excludeGuildId != null) params.excludeGuildId = String(excludeGuildId);
    if (limit != null) params.limit = limit;
    return v2.get('/users/mutual', { params }).then(r => r.data);
};

/* Member roles */
export const addMemberRole    = (guildId, userId, roleId) =>
    v2.put(`/guilds/${guildId}/members/${userId}/roles/${roleId}`).then(r => r.data);
export const removeMemberRole = (guildId, userId, roleId) =>
    v2.delete(`/guilds/${guildId}/members/${userId}/roles/${roleId}`).then(r => r.data);

/* Attachments */
export const uploadAttachments = (guildId, channelId, formData, onUploadProgress) =>
    v2.post(
        `/guilds/${guildId}/channels/${channelId}/attachments`,
        formData,
        { onUploadProgress },
    ).then(r => r.data);

/* Invites */
export const fetchChannelInvites  = (guildId, channelId) =>
    v2.get(`/guilds/${guildId}/channels/${channelId}/invites`).then(r => r.data);
export const createChannelInvite  = (guildId, channelId, body = {}) =>
    v2.post(`/guilds/${guildId}/channels/${channelId}/invites`, body).then(r => r.data);
export const deleteInvite         = (code) =>
    v2.delete(`/invites/${code}`).then(r => r.data);
export const fetchInviteByCode    = (code) =>
    v2.get(`/invites/${code}`).then(r => r.data);
export const joinInvite           = (code) =>
    v2.post(`/invites/${code}`).then(r => r.data);

/* Webhooks */
export const fetchChannelWebhooks = (guildId, channelId) =>
    v2.get(`/guilds/${guildId}/channels/${channelId}/webhooks`).then(r => r.data);
export const createChannelWebhook = (guildId, channelId, body) =>
    v2.post(`/guilds/${guildId}/channels/${channelId}/webhooks`, body).then(r => r.data);
export const deleteChannelWebhook = (guildId, webhookId) =>
    v2.delete(`/guilds/${guildId}/webhooks/${webhookId}`).then(r => r.data);
