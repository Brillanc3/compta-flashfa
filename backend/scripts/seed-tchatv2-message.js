'use strict';

/**
 * Seed tchatv2 :
 * 1. Crée un user test + companyEmployee company 1
 * 2. Ajoute comme v2Member dans la guild 184114209219497984
 * 3. Envoie un message + mention <@4> dans le channel 184114209219497985
 */

const { PrismaClient } = require('@prisma/client');

const GUILD_ID   = BigInt('184114209219497984');
const CHANNEL_ID = BigInt('184114209219497985');
const COMPANY_ID = 1;
const RANK_ID    = 7;         // Premier rank dispo company 1
const PING_USER  = 4;         // Caillou

const V2_EPOCH_MS = BigInt(Date.UTC(2025, 0, 1, 0, 0, 0, 0));
const TIME_SHIFT  = 22n;
const NODE_SHIFT  = 12n;

function nextV2() {
    const ts = BigInt(Date.now()) - V2_EPOCH_MS;
    return (ts << TIME_SHIFT) | (1n << NODE_SHIFT) | 0n;
}

async function main() {
    const p = new PrismaClient();
    const s = (v) => (typeof v === 'bigint' ? v.toString() : v);

    try {
        // ── 1. User test ──────────────────────────────────────────────────────
        const username = 'testuser_tchatv2';
        let user = await p.user.findFirst({ where: { username }, select: { id: true, username: true } });

        if (!user) {
            const bcrypt = require('bcrypt');
            const hash   = await bcrypt.hash('Password123!', 10);
            user = await p.user.create({
                data: {
                    name:     'Test TchatV2',
                    username,
                    password: hash,
                },
                select: { id: true, username: true },
            });
            console.log(`[OK] User créé : id=${user.id} username=${user.username}`);
        } else {
            console.log(`[SKIP] User déjà existant : id=${user.id}`);
        }

        // ── 2. CompanyEmployee ────────────────────────────────────────────────
        const existing = await p.companyEmployee.findFirst({
            where: { userId: user.id, companyId: COMPANY_ID },
            select: { id: true },
        });

        if (!existing) {
            const emp = await p.companyEmployee.create({
                data: {
                    companyId: COMPANY_ID,
                    userId:    user.id,
                    rankId:    RANK_ID,
                    status:    'ACTIVE',
                },
                select: { id: true },
            });
            console.log(`[OK] CompanyEmployee créé : id=${emp.id} userId=${user.id} companyId=${COMPANY_ID}`);
        } else {
            console.log(`[SKIP] CompanyEmployee déjà existant`);
        }

        // ── 3. v2Member dans la guild ─────────────────────────────────────────
        const member = await p.v2Member.findUnique({
            where: { guildId_userId: { guildId: GUILD_ID, userId: user.id } },
            select: { userId: true },
        });

        if (!member) {
            await p.v2Member.create({
                data: { guildId: GUILD_ID, userId: user.id },
            });
            console.log(`[OK] v2Member créé : userId=${user.id} guildId=${s(GUILD_ID)}`);
        } else {
            console.log(`[SKIP] v2Member déjà dans la guild`);
        }

        // ── 4. Message + mention <@4> ─────────────────────────────────────────
        const messageId = nextV2();
        const content   = `Bonjour <@${PING_USER}> ! Test seed depuis le script.`;
        const mentions  = { users: [PING_USER], roles: [], channels: [], everyone: false, here: false };

        const msg = await p.v2Message.create({
            data: {
                id:             messageId,
                channelId:      CHANNEL_ID,
                authorId:       user.id,
                authorUsername: user.username,
                content,
                mentionsJson:   JSON.stringify(mentions),
                type:           0,
            },
            select: { id: true, content: true, authorId: true },
        });

        // Mention row pour user 4
        await p.v2MessageMention.create({
            data: {
                id:        nextV2() + 1n,
                messageId: msg.id,
                targetId:  BigInt(PING_USER),
                type:      'USER',
            },
        });

        // Mise à jour lastMessageId du channel
        await p.v2Channel.update({
            where: { id: CHANNEL_ID },
            data:  { lastMessageId: msg.id },
        });

        console.log(`[OK] Message créé : id=${s(msg.id)}`);
        console.log(`     content : "${msg.content}"`);
        console.log(`     channel : ${s(CHANNEL_ID)}`);
        console.log(`     guild   : ${s(GUILD_ID)}`);
        console.log(`     mention : <@${PING_USER}>`);
        console.log('\nSeed terminé avec succès.');
    } finally {
        await p.$disconnect();
    }
}

main().catch((e) => {
    console.error('[ERR]', e.message);
    process.exit(1);
});
