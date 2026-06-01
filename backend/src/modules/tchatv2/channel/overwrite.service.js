'use strict';

const { prisma } = require('../../../shards/database');
const { nextV2 } = require('../lib/snowflake');
const { OverwriteType, ChannelType } = require('../tchatv2.constants');
const { invalidateChannel } = require('../permissions/permission.cache');
const repo = require('./channel.repository');
const emitter = require('../sockets/socket.emitter');

async function _afterOverwriteChange(channelId, guildId) {
    await invalidateChannel(channelId);
    await repo.invalidateGuildChannelsCache(guildId);

    const channel = await repo.findById(channelId);

    // Si c'est une catégorie, invalider aussi les permissions de ses salons enfants
    if (channel?.type === ChannelType.GUILD_CATEGORY) {
        const children = await prisma.v2Channel.findMany({
            where: { parentId: BigInt(channelId) },
            select: { id: true },
        });
        await Promise.all(children.map(c => invalidateChannel(c.id)));
    }

    if (channel) emitter.channelUpdate(guildId, channel);
}

async function upsertOverwrite(channelId, targetId, { type, allow, deny }, guildId) {
    const cid = BigInt(channelId);
    const tid = BigInt(targetId);
    const allowBig = allow != null ? BigInt(allow) : 0n;
    const denyBig  = deny  != null ? BigInt(deny)  : 0n;

    if ((allowBig & denyBig) !== 0n) {
        throw Object.assign(new Error('allow and deny cannot share bits'), { status: 400 });
    }

    const typeInt = type === 'ROLE' ? OverwriteType.ROLE : OverwriteType.MEMBER;

    await prisma.v2PermissionOverwrite.upsert({
        where: { channelId_targetId_type: { channelId: cid, targetId: tid, type: typeInt } },
        create: { id: nextV2(), channelId: cid, targetId: tid, type: typeInt, allow: allowBig, deny: denyBig },
        update: { allow: allowBig, deny: denyBig },
    });

    await _afterOverwriteChange(channelId, guildId);
}

async function deleteOverwrite(channelId, targetId, guildId) {
    const cid = BigInt(channelId);
    const tid = BigInt(targetId);

    await prisma.v2PermissionOverwrite.deleteMany({
        where: { channelId: cid, targetId: tid },
    });

    await _afterOverwriteChange(channelId, guildId);
}

module.exports = { upsertOverwrite, deleteOverwrite };
