'use strict';

const service = require('./thread.service');
const forumSvc = require('./forum.service');
const pollSvc = require('./poll.service');
const repo = require('./thread.repository');

async function createFromMessage(req, reply) {
    const { channelId, guildId, messageId } = req.params;
    const { name, autoArchiveDuration } = req.body;
    const thread = await service.createFromMessage({
        channelId, guildId, messageId,
        authorId: req.user.id,
        name, autoArchiveDuration,
        perms: req.perms,
    });
    return reply.code(201).send(thread);
}

async function createPrivate(req, reply) {
    const { channelId, guildId } = req.params;
    const { name, autoArchiveDuration } = req.body;
    const thread = await service.createPrivate({
        channelId, guildId,
        authorId: req.user.id,
        name, autoArchiveDuration,
        perms: req.perms,
    });
    return reply.code(201).send(thread);
}

async function listActive(req, reply) {
    const { channelId } = req.params;
    const threads = await repo.findActiveByChannel(channelId);
    return reply.send({ threads });
}

async function listArchived(req, reply) {
    const { channelId } = req.params;
    const { before, limit } = req.query;
    const threads = await repo.findArchivedByChannel(channelId, { before, limit });
    return reply.send({ threads, hasMore: threads.length === Number(limit || 25) });
}

async function joinThread(req, reply) {
    const { guildId, channelId } = req.params;
    const result = await service.joinThread(channelId, req.user.id);
    return reply.send(result);
}

async function leaveThread(req, reply) {
    const { channelId } = req.params;
    await service.leaveThread(channelId, req.user.id);
    return reply.code(204).send();
}

async function destroyThread(req, reply) {
    const { guildId, channelId } = req.params;
    await service.deleteThread(channelId, guildId, req.perms);
    return reply.code(204).send();
}

async function updateThread(req, reply) {
    const { guildId, channelId } = req.params;
    const thread = await service.updateThread(channelId, guildId, req.body, req.perms);
    return reply.send(thread);
}

async function reorderForumPosts(req, reply) {
    const { guildId, channelId } = req.params;
    await service.reorderForumPosts(channelId, guildId, req.body, req.perms);
    return reply.code(204).send();
}

async function createForumPost(req, reply) {
    const { channelId, guildId } = req.params;
    const { name, message, autoArchiveDuration, appliedTags } = req.body;
    const result = await forumSvc.createForumPost({
        forumId: channelId, guildId,
        authorId: req.user.id,
        name, message, autoArchiveDuration,
        tagIds: appliedTags ?? [],
        perms: req.perms,
    });
    return reply.code(201).send(result);
}

async function listForumActive(req, reply) {
    const { channelId } = req.params;
    const { sort } = req.query;
    const threads = await forumSvc.listActiveForumPosts(channelId, { sort });
    return reply.send({ threads });
}

async function listForumArchived(req, reply) {
    const { channelId } = req.params;
    const { before, limit } = req.query;
    const threads = await forumSvc.listArchivedForumPosts(channelId, { before, limit });
    return reply.send({ threads });
}

// ── Tags ─────────────────────────────────────────────────────────────────────

async function listTags(req, reply) {
    const { channelId } = req.params;
    const tags = await forumSvc.listTags(channelId);
    return reply.send({ tags: tags.map(t => ({ ...t, id: String(t.id), channelId: String(t.channelId) })) });
}

async function createTag(req, reply) {
    const { channelId } = req.params;
    const { name, emoji, moderated } = req.body;
    const tag = await forumSvc.createTag(channelId, { name, emoji, moderated });
    return reply.code(201).send({ ...tag, id: String(tag.id), channelId: String(tag.channelId) });
}

async function deleteTag(req, reply) {
    const { channelId, tagId } = req.params;
    await forumSvc.deleteTag(tagId, channelId);
    return reply.code(204).send();
}

async function setThreadTags(req, reply) {
    const { threadId } = req.params;
    const { tagIds } = req.body;
    const tags = await forumSvc.setThreadTags(threadId, tagIds ?? []);
    return reply.send({ tags: tags.map(t => ({ threadId: String(t.threadId), tagId: String(t.tagId) })) });
}

// ── Forum Subscriptions ───────────────────────────────────────────────────────

async function subscribeToForum(req, reply) {
    const { channelId } = req.params;
    await forumSvc.subscribeToForum(channelId, req.user.id);
    return reply.code(204).send();
}

async function unsubscribeFromForum(req, reply) {
    const { channelId } = req.params;
    await forumSvc.unsubscribeFromForum(channelId, req.user.id);
    return reply.code(204).send();
}

async function getForumSubscription(req, reply) {
    const { channelId } = req.params;
    const sub = await forumSvc.getSubscription(channelId, req.user.id);
    return reply.send({ subscribed: !!sub });
}

// ── Forum Post Subscriptions (thread-level) ───────────────────────────────────

async function subscribeToPost(req, reply) {
    const { channelId } = req.params;
    await forumSvc.subscribeToPost(channelId, req.user.id);
    return reply.code(204).send();
}

async function unsubscribeFromPost(req, reply) {
    const { channelId } = req.params;
    await forumSvc.unsubscribeFromPost(channelId, req.user.id);
    return reply.code(204).send();
}

async function getPostSubscription(req, reply) {
    const { channelId } = req.params;
    const sub = await forumSvc.getPostSubscription(channelId, req.user.id);
    return reply.send({ subscribed: !!sub });
}

async function listPostSubscribers(req, reply) {
    const { channelId } = req.params;
    const subscribers = await forumSvc.getPostSubscribers(channelId);
    return reply.send({ subscribers });
}

async function listSubscribedPosts(req, reply) {
    const { guildId } = req.params;
    const posts = await forumSvc.getSubscribedPosts(guildId, req.user.id);
    return reply.send({ posts });
}

// ── Polls ─────────────────────────────────────────────────────────────────────

async function createPoll(req, reply) {
    const { messageId } = req.params;
    const { question, options, multiple, expiresAt } = req.body;
    const poll = await pollSvc.createPoll(messageId, { question, options, multiple, expiresAt });
    return reply.code(201).send(poll);
}

async function votePoll(req, reply) {
    const { pollId } = req.params;
    const { optionIds } = req.body;
    const result = await pollSvc.vote(pollId, req.user.id, optionIds ?? [], req.params.channelId);
    return reply.send(result);
}

async function getPoll(req, reply) {
    const { pollId } = req.params;
    const poll = await pollSvc.getPoll(pollId);
    return reply.send(poll);
}

module.exports = {
    createFromMessage,
    createPrivate,
    listActive,
    listArchived,
    joinThread,
    leaveThread,
    destroyThread,
    updateThread,
    reorderForumPosts,
    createForumPost,
    listForumActive,
    listForumArchived,
    listTags,
    createTag,
    deleteTag,
    setThreadTags,
    createPoll,
    votePoll,
    getPoll,
    subscribeToForum,
    unsubscribeFromForum,
    getForumSubscription,
    subscribeToPost,
    unsubscribeFromPost,
    getPostSubscription,
    listPostSubscribers,
    listSubscribedPosts,
};
