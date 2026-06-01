'use strict';

const prisma = require('../../db');
const { generateSnowflake } = require('../../utils/snowflake');
const { emitGatewayEvent } = require('../../core/gateway/gateway.emitter');

function toDmMessageDto(msg) {
    const conversationId = msg.conversationId?.toString?.() ?? String(msg.conversationId);
    return {
        id: msg.id?.toString?.() ?? String(msg.id),
        conversationId,
        authorId: msg.authorId,
        content: msg.content ?? '',
        createdAt: msg.createdAt,
        authorName: msg.author?.name ?? msg.author?.username ?? 'Utilisateur',
        authorAvatar: msg.author?.imageUrl ?? null,
    };
}

async function listConversations(userId) {
    const numUserId = Number(userId);
    const convs = await prisma.chatDmConversation.findMany({
        where: {
            OR: [
                { userAId: numUserId },
                { userBId: numUserId }
            ]
        },
        include: {
            userA: { select: { id: true, name: true, username: true, imageUrl: true } },
            userB: { select: { id: true, name: true, username: true, imageUrl: true } },
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
            }
        }
    });

    return convs.map(c => {
        const otherUser = c.userAId === numUserId ? c.userB : c.userA;
        return {
            id: c.id.toString(),
            otherUserId: otherUser.id,
            otherUserName: otherUser.name || otherUser.username,
            otherUserAvatar: otherUser.imageUrl,
            lastMessage: c.messages[0] ? toDmMessageDto(c.messages[0]) : null
        };
    }).sort((a, b) => {
        const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return timeB - timeA;
    });
}

async function getOrCreateConversation(userAId, userBId) {
    const uA = Math.min(Number(userAId), Number(userBId));
    const uB = Math.max(Number(userAId), Number(userBId));

    let conv = await prisma.chatDmConversation.findFirst({
        where: { userAId: uA, userBId: uB },
        include: {
            userA: { select: { id: true, name: true, username: true, imageUrl: true } },
            userB: { select: { id: true, name: true, username: true, imageUrl: true } }
        }
    });

    if (!conv) {
        conv = await prisma.chatDmConversation.create({
            data: {
                id: BigInt(generateSnowflake()),
                userAId: uA,
                userBId: uB
            },
            include: {
                userA: { select: { id: true, name: true, username: true, imageUrl: true } },
                userB: { select: { id: true, name: true, username: true, imageUrl: true } }
            }
        });
    }

    return {
        id: conv.id.toString(),
        userAId: conv.userAId,
        userBId: conv.userBId,
        userA: conv.userA,
        userB: conv.userB
    };
}

async function getConversationMessages(userId, conversationId) {
    const numUserId = Number(userId);
    const convIdStr = String(conversationId);
    
    const conv = await prisma.chatDmConversation.findUnique({
        where: { id: BigInt(convIdStr) }
    });

    if (!conv || (conv.userAId !== numUserId && conv.userBId !== numUserId)) {
        throw new Error('Forbidden or not found');
    }

    const msgs = await prisma.chatDmMessage.findMany({
        where: { conversationId: BigInt(convIdStr) },
        include: {
            author: { select: { id: true, name: true, username: true, imageUrl: true } }
        },
        orderBy: { createdAt: 'asc' }
    });

    return msgs.map(toDmMessageDto);
}

async function postMessage(userId, conversationId, content) {
    const numUserId = Number(userId);
    const convIdStr = String(conversationId);
    
    const conv = await prisma.chatDmConversation.findUnique({
        where: { id: BigInt(convIdStr) }
    });

    if (!conv || (conv.userAId !== numUserId && conv.userBId !== numUserId)) {
        throw new Error('Forbidden or not found');
    }

    const { scanText } = require('../../lib/profanityFilter');
    const profanity = scanText(content);
    if (profanity.flagged) {
        // En DM on peut bloquer ou alerter, pour l'instant alertons
        fetch(`http://127.0.0.1:${process.env.MASTER_PORT || 9090}/status/discord/report-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-report-secret': process.env.DISCORD_REPORT_SECRET || '' },
            body: JSON.stringify({
                userId: numUserId,
                channelId: 'DM',
                messageId: 'DM',
                description: `L'utilisateur ID **${numUserId}** a utilisé un langage inapproprié en DM.\n\n**Mots détectés :** ${profanity.words.join(', ')}\n**Message original :**\n${profanity.highlighted}`
            })
        }).catch(err => console.error("Error sending discord DM report:", err));
    }

    const msgId = BigInt(generateSnowflake());
    const msg = await prisma.chatDmMessage.create({
        data: {
            id: msgId,
            conversationId: BigInt(convIdStr),
            authorId: numUserId,
            content: String(content || '')
        },
        include: {
            author: { select: { id: true, name: true, username: true, imageUrl: true } }
        }
    });

    const dto = toDmMessageDto(msg);

    // Emettre l'événement WS personnalisé pour le DM (sur les user:* rooms au lieu des channel:* rooms)
    const otherUserId = conv.userAId === numUserId ? conv.userBId : conv.userAId;
    await emitGatewayEvent({
        scope: 'USER',
        targets: [`user:${numUserId}`, `user:${otherUserId}`],
        event: 'CHAT_DM_MESSAGE_CREATED', // Ou DM_MESSAGE_CREATED pour matcher
        payload: { message: dto, authorId: numUserId }
    });

    return dto;
}

module.exports = {
    listConversations,
    getOrCreateConversation,
    getConversationMessages,
    postMessage
};
