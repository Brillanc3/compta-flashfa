'use strict';

const { prisma } = require('../../../shards/database');

const WEBHOOK_SELECT = {
    id: true, guildId: true, channelId: true,
    name: true, avatarHash: true, createdBy: true, createdAt: true,
    token: true,
};

async function create(data) {
    return prisma.v2Webhook.create({
        data,
        select: { ...WEBHOOK_SELECT, signingSecret: true },
    });
}

async function findById(webhookId) {
    return prisma.v2Webhook.findUnique({
        where: { id: BigInt(webhookId) },
        select: { ...WEBHOOK_SELECT, signingSecret: true },
    });
}

async function findByChannel(channelId) {
    return prisma.v2Webhook.findMany({
        where: { channelId: BigInt(channelId) },
        select: WEBHOOK_SELECT,
    });
}

async function findByGuild(guildId) {
    return prisma.v2Webhook.findMany({
        where: { guildId: BigInt(guildId) },
        select: WEBHOOK_SELECT,
    });
}

async function remove(webhookId) {
    return prisma.v2Webhook.delete({ where: { id: BigInt(webhookId) } });
}

module.exports = { create, findById, findByChannel, findByGuild, remove, WEBHOOK_SELECT };
