'use strict';

const { nextV2 } = require('../lib/snowflake');
const { ChannelType } = require('../tchatv2.constants');
const { invalidateChannel } = require('../permissions/permission.cache');
const repo = require('./channel.repository');

const VALID_GUILD_TYPES = new Set([
    ChannelType.GUILD_TEXT,
    ChannelType.GUILD_VOICE,
    ChannelType.GUILD_CATEGORY,
    ChannelType.GUILD_ANNOUNCEMENT,
    ChannelType.GUILD_FORUM,
]);

async function createChannel(guildId, { name, type, topic, position, parentId, nsfw, rateLimitPerUser }) {
    if (!VALID_GUILD_TYPES.has(type)) {
        throw Object.assign(new Error('Invalid channel type'), { status: 400 });
    }
    if (parentId != null && type === ChannelType.GUILD_CATEGORY) {
        throw Object.assign(new Error('Category cannot have a parent'), { status: 400 });
    }
    return repo.create({
        id: nextV2(),
        guildId: BigInt(guildId),
        parentId: parentId ? BigInt(parentId) : null,
        type,
        name,
        topic: topic ?? null,
        position: position ?? 0,
        nsfw: nsfw ?? false,
        rateLimitPerUser: rateLimitPerUser ?? 0,
    });
}

async function updateChannel(channelId, data) {
    const updated = await repo.update(channelId, {
        ...(data.name             != null && { name: data.name }),
        ...(data.topic            != null && { topic: data.topic }),
        ...(data.position         != null && { position: data.position }),
        ...(data.nsfw             != null && { nsfw: data.nsfw }),
        ...(data.rateLimitPerUser != null && { rateLimitPerUser: data.rateLimitPerUser }),
        ...(data.parentId !== undefined    && { parentId: data.parentId ? BigInt(data.parentId) : null }),
    });
    await invalidateChannel(channelId);
    return updated;
}

async function deleteChannel(channelId) {
    await repo.remove(channelId);
    await invalidateChannel(channelId);
}

async function reorderChannels(guildId, updates) {
    await repo.batchUpdatePositions(updates);
}

module.exports = { createChannel, updateChannel, deleteChannel, reorderChannels };
