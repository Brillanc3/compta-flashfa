'use strict';

const { prisma } = require('../../../shards/database');
const { nextV2 } = require('../lib/snowflake');
const emitter = require('../sockets/socket.emitter');

function err(msg, status, code) {
    const e = new Error(msg);
    e.statusCode = status;
    e.code = code;
    return e;
}

function serializePoll(poll) {
    return {
        id:        String(poll.id),
        messageId: String(poll.messageId),
        question:  poll.question,
        multiple:  poll.multiple,
        expiresAt: poll.expiresAt ?? null,
        createdAt: poll.createdAt,
        options:   (poll.options ?? []).map(o => ({
            id:     String(o.id),
            pollId: String(o.pollId),
            text:   o.text,
        })),
        votes: (poll.votes ?? []).map(v => ({
            id:       String(v.id),
            pollId:   String(v.pollId),
            optionId: String(v.optionId),
            userId:   v.userId,
        })),
    };
}

async function createPoll(messageId, { question, options, multiple = false, expiresAt }) {
    if (!options || options.length < 2 || options.length > 10) {
        throw err('Poll must have 2-10 options', 400, 50035);
    }

    const pollId = nextV2();
    const poll = await prisma.v2Poll.create({
        data: {
            id:        pollId,
            messageId: BigInt(messageId),
            question,
            multiple:  !!multiple,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            options: {
                create: options.map(text => ({
                    id:   nextV2(),
                    text: String(text).slice(0, 100),
                })),
            },
        },
        include: { options: true, votes: true },
    });

    return serializePoll(poll);
}

async function getPoll(pollId) {
    const poll = await prisma.v2Poll.findUnique({
        where: { id: BigInt(pollId) },
        include: { options: true, votes: true },
    });
    if (!poll) throw err('Poll not found', 404, 10012);
    return serializePoll(poll);
}

async function revealResults(pollId) {
    const poll = await prisma.v2Poll.findUnique({
        where: { id: BigInt(pollId) },
        include: { options: { include: { votes: true } }, votes: true },
    });
    if (!poll) throw err('Poll not found', 404, 10012);

    const counts = {};
    for (const opt of poll.options) {
        counts[String(opt.id)] = opt.votes.length;
    }
    return { pollId: String(poll.id), counts };
}

async function vote(pollId, userId, optionIds, channelId) {
    const pid = BigInt(pollId);
    const uid = Number(userId);

    const poll = await prisma.v2Poll.findUnique({
        where: { id: pid },
        include: { options: true },
    });
    if (!poll) throw err('Poll not found', 404, 10012);

    if (poll.expiresAt && poll.expiresAt < new Date()) {
        throw err('Poll has expired', 400, 50083);
    }

    if (!poll.multiple && optionIds.length > 1) {
        throw err('This poll does not allow multiple choices', 400, 50082);
    }

    const validOptionIds = new Set(poll.options.map(o => String(o.id)));
    for (const oid of optionIds) {
        if (!validOptionIds.has(String(oid))) throw err('Invalid option', 400, 50081);
    }

    const created = [];
    for (const oid of optionIds) {
        try {
            const v = await prisma.v2PollVote.create({
                data: {
                    id:       nextV2(),
                    pollId:   pid,
                    optionId: BigInt(oid),
                    userId:   uid,
                },
            });
            created.push(v);
        } catch (e) {
            if (e.code === 'P2002') throw err('Already voted for this option', 409, 50084);
            throw e;
        }
    }

    // Compute fresh counts
    const counts = {};
    for (const opt of poll.options) {
        const c = await prisma.v2PollVote.count({
            where: { pollId: pid, optionId: opt.id },
        });
        counts[String(opt.id)] = c;
    }

    if (channelId) {
        emitter.pollVoteAdd(String(channelId), {
            pollId:    String(pollId),
            optionIds: optionIds.map(String),
            userId:    uid,
            counts,
        });
    }

    return { pollId: String(pollId), optionIds: optionIds.map(String), userId: uid, counts };
}

module.exports = { createPoll, getPoll, revealResults, vote };
