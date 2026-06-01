#!/usr/bin/env node
'use strict';

/**
 * Migration V1 → V2 pour une company donnée.
 * Usage : node scripts/migrate-v1-to-v2.js --companyId=<id> [--dry-run]
 *
 * Le script est idempotent via V2MigrationMap — relancer n'a aucun effet
 * sur les entités déjà migrées.
 */

require('../src/modules/tchatv2/lib/bigint'); // BigInt → JSON string

const { PrismaClient } = require('@prisma/client');
const { nextV2 }       = require('../src/modules/tchatv2/lib/snowflake');
const { Permission, combinePermissions, ChannelType, OverwriteType } = require('../src/modules/tchatv2/tchatv2.constants');

const prisma = new PrismaClient();

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function parseArgs() {
    const args  = process.argv.slice(2);
    const get   = (k) => { const a = args.find(a => a.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
    const companyId = Number(get('companyId'));
    const dryRun    = args.includes('--dry-run');
    if (!companyId || isNaN(companyId)) {
        console.error('Usage : node scripts/migrate-v1-to-v2.js --companyId=<id> [--dry-run]');
        process.exit(1);
    }
    return { companyId, dryRun };
}

async function getMapping(type, v1Id) {
    const row = await prisma.v2MigrationMap.findUnique({
        where: { entityType_v1Id: { entityType: type, v1Id: String(v1Id) } },
    });
    return row ? row.v2Id : null;
}

async function setMapping(type, v1Id, v2Id, dryRun) {
    if (dryRun) return;
    await prisma.v2MigrationMap.upsert({
        where:  { entityType_v1Id: { entityType: type, v1Id: String(v1Id) } },
        create: { entityType: type, v1Id: String(v1Id), v2Id },
        update: { v2Id },
    });
}

// ──────────────────────────────────────────────────────────────
// Permissions par défaut @everyone
// ──────────────────────────────────────────────────────────────
const DEFAULT_EVERYONE_PERMS = combinePermissions(
    Permission.VIEW_CHANNEL,
    Permission.SEND_MESSAGES,
    Permission.READ_MESSAGE_HISTORY,
    Permission.ADD_REACTIONS,
    Permission.USE_EXTERNAL_EMOJIS,
    Permission.EMBED_LINKS,
    Permission.ATTACH_FILES,
);

// ──────────────────────────────────────────────────────────────
// Étapes
// ──────────────────────────────────────────────────────────────

async function migrateGuild(company, dryRun, stats) {
    const existing = await getMapping('guild', company.id);
    if (existing) {
        console.log(`  [guild] déjà migré → v2Id=${existing}`);
        return existing;
    }

    const guildId = nextV2();
    console.log(`  [guild] créer V2Guild id=${guildId} name="${company.name}"`);
    if (!dryRun) {
        await prisma.v2Guild.upsert({
            where: { id: guildId },
            create: {
                id:      guildId,
                name:    company.name.slice(0, 100),
                ownerId: company.ownerId ?? (await getFirstAdmin(company.id)),
            },
            update: {},
        });
        await setMapping('guild', company.id, guildId, dryRun);
    }
    stats.guilds++;
    return guildId;
}

async function getFirstAdmin(companyId) {
    const emp = await prisma.companyEmployee.findFirst({
        where: { companyId },
        orderBy: { id: 'asc' },
        select: { userId: true },
    });
    return emp?.userId ?? 1;
}

async function migrateEveryoneRole(guildId, dryRun, stats) {
    const everyoneId = guildId; // convention V2 : @everyone id === guildId
    const existing = await getMapping('role', `_everyone_${guildId}`);
    if (existing) {
        console.log(`  [role] @everyone déjà migré`);
        return everyoneId;
    }
    console.log(`  [role] créer @everyone id=${everyoneId}`);
    if (!dryRun) {
        await prisma.v2Role.upsert({
            where: { id: everyoneId },
            create: {
                id:          everyoneId,
                guildId,
                name:        '@everyone',
                permissions: DEFAULT_EVERYONE_PERMS,
                position:    0,
                mentionable: false,
                hoist:       false,
            },
            update: {},
        });
        await setMapping('role', `_everyone_${guildId}`, everyoneId, dryRun);
    }
    stats.roles++;
    return everyoneId;
}

async function migrateMembers(company, guildId, everyoneRoleId, dryRun, stats) {
    const employees = await prisma.companyEmployee.findMany({
        where: { companyId: company.id },
        select: { userId: true, rankId: true },
    });

    for (const emp of employees) {
        const existing = await getMapping('member', `${guildId}_${emp.userId}`);
        if (existing) continue;

        console.log(`  [member] userId=${emp.userId}`);
        if (!dryRun) {
            const created = await prisma.v2Member.upsert({
                where: { guildId_userId: { guildId, userId: emp.userId } },
                create: {
                    guildId,
                    userId:                 emp.userId,
                    cachedGuildPermissions: DEFAULT_EVERYONE_PERMS,
                },
                update: {},
                select: { id: true },
            });
            await setMapping('member', `${guildId}_${emp.userId}`, created.id, dryRun);
        }
        stats.members++;
    }
}

async function migrateChannels(company, guildId, dryRun, stats) {
    const categories = await prisma.chatCategory.findMany({
        where: { companyId: company.id },
        orderBy: { position: 'asc' },
    });

    const channels = await prisma.chatChannel.findMany({
        where: { companyId: company.id },
        orderBy: { position: 'asc' },
        include: {
            rankOverrides: true,
            userOverrides: true,
        },
    });

    // Migrer les catégories comme channels de type GUILD_CATEGORY
    for (const cat of categories) {
        const existing = await getMapping('channel', `cat_${cat.id}`);
        if (existing) continue;

        const v2CatId = nextV2();
        console.log(`  [channel] catégorie "${cat.name}" id=${v2CatId}`);
        if (!dryRun) {
            await prisma.v2Channel.create({
                data: {
                    id:       v2CatId,
                    guildId,
                    name:     cat.name.slice(0, 100),
                    type:     ChannelType.GUILD_CATEGORY,
                    position: cat.position,
                },
            });
            await setMapping('channel', `cat_${cat.id}`, v2CatId, dryRun);
        }
        stats.channels++;
    }

    // Migrer les channels texte
    for (const ch of channels) {
        const existing = await getMapping('channel', String(ch.id));
        if (existing) {
            // Migrer les overwrites si pas encore fait
            await migrateOverwrites(ch, existing, guildId, dryRun, stats);
            continue;
        }

        let parentId = null;
        if (ch.categoryId) {
            parentId = await getMapping('channel', `cat_${ch.categoryId}`);
        }

        const v2ChId = nextV2();
        console.log(`  [channel] "${ch.name}" id=${v2ChId}`);
        if (!dryRun) {
            await prisma.v2Channel.create({
                data: {
                    id:       v2ChId,
                    guildId,
                    name:     ch.name.slice(0, 100),
                    topic:    ch.topic ?? null,
                    type:     ChannelType.GUILD_TEXT,
                    position: ch.position,
                    parentId: parentId ?? null,
                },
            });
            await setMapping('channel', String(ch.id), v2ChId, dryRun);
        }
        stats.channels++;

        await migrateOverwrites(ch, v2ChId, guildId, dryRun, stats);
    }
}

async function migrateOverwrites(v1Channel, v2ChannelId, guildId, dryRun, stats) {
    if (!v2ChannelId) return;

    for (const ov of v1Channel.rankOverrides ?? []) {
        const v2RoleId = await getMapping('role', String(ov.rankId));
        if (!v2RoleId) continue;
        const ovKey = `ov_role_${v2ChannelId}_${v2RoleId}`;
        const existing = await getMapping('_ov', ovKey);
        if (existing) continue;
        if (!dryRun) {
            const ovId = nextV2();
            await prisma.v2PermissionOverwrite.upsert({
                where:  { channelId_targetId_type: { channelId: v2ChannelId, targetId: v2RoleId, type: OverwriteType.ROLE } },
                create: { id: ovId, channelId: v2ChannelId, targetId: v2RoleId, type: OverwriteType.ROLE, allow: ov.allowBits, deny: ov.denyBits },
                update: { allow: ov.allowBits, deny: ov.denyBits },
            });
            await setMapping('_ov', ovKey, 1n, dryRun);
        }
        stats.overwrites++;
    }

    for (const ov of v1Channel.userOverrides ?? []) {
        const ovKey = `ov_user_${v2ChannelId}_${ov.userId}`;
        const existing = await getMapping('_ov', ovKey);
        if (existing) continue;
        if (!dryRun) {
            const ovId = nextV2();
            await prisma.v2PermissionOverwrite.upsert({
                where:  { channelId_targetId_type: { channelId: v2ChannelId, targetId: BigInt(ov.userId), type: OverwriteType.MEMBER } },
                create: { id: ovId, channelId: v2ChannelId, targetId: BigInt(ov.userId), type: OverwriteType.MEMBER, allow: ov.allowBits, deny: ov.denyBits },
                update: { allow: ov.allowBits, deny: ov.denyBits },
            });
            await setMapping('_ov', ovKey, 1n, dryRun);
        }
        stats.overwrites++;
    }
}

async function migrateMessages(company, guildId, dryRun, stats) {
    const channels = await prisma.chatChannel.findMany({
        where: { companyId: company.id },
        select: { id: true },
    });

    for (const ch of channels) {
        const v2ChId = await getMapping('channel', String(ch.id));
        if (!v2ChId) continue;

        const CHUNK = 10_000;
        let lastId  = null;
        let hasMore = true;

        while (hasMore) {
            const msgs = await prisma.chatMessage.findMany({
                where: {
                    channelId: ch.id,
                    deletedAt: null,
                    ...(lastId ? { id: { gt: lastId } } : {}),
                },
                orderBy: { id: 'asc' },
                take:    CHUNK,
                select: {
                    id:        true,
                    authorId:  true,
                    content:   true,
                    createdAt: true,
                    editedAt:  true,
                    replyToId: true,
                    mentions:  { select: { userId: true } },
                    attachments: { select: { id: true, publicId: true, mimeType: true, byteSize: true, diskPath: true } },
                },
            });

            if (msgs.length === 0) { hasMore = false; break; }

            for (const msg of msgs) {
                const existingV2 = await getMapping('message', String(msg.id));
                if (existingV2) { lastId = msg.id; stats.skippedMessages++; continue; }

                const v2MsgId = nextV2(msg.createdAt.getTime());

                // Snapshot auteur
                const user = await prisma.user.findUnique({
                    where: { id: msg.authorId },
                    select: { name: true, imageUrl: true, username: true },
                });

                const mentionsJson = msg.mentions.map(m => ({ userId: m.userId }));
                const replyV2Id    = msg.replyToId ? await getMapping('message', String(msg.replyToId)) : null;

                if (!dryRun) {
                    await prisma.v2Message.create({
                        data: {
                            id:                  v2MsgId,
                            channelId:           v2ChId,
                            guildId,
                            authorId:            msg.authorId,
                            content:             msg.content,
                            authorUsername:      user?.name ?? user?.username ?? 'unknown',
                            authorAvatarHash:    user?.imageUrl ?? null,
                            authorNickname:      null,
                            mentionsJson:        JSON.stringify(mentionsJson),
                            referencedMessageId: replyV2Id ?? null,
                            editedAt:            msg.editedAt ?? null,
                        },
                    });

                    if (msg.mentions.length > 0) {
                        await prisma.v2MessageMention.createMany({
                            data: msg.mentions.map(m => ({
                                messageId: v2MsgId,
                                channelId: v2ChId,
                                userId:    m.userId,
                            })),
                            skipDuplicates: true,
                        });
                    }

                    await setMapping('message', String(msg.id), v2MsgId, dryRun);
                }
                stats.messages++;
                lastId = msg.id;
            }

            hasMore = msgs.length === CHUNK;
        }

        // Update lastMessageId du channel V2
        if (!dryRun) {
            const last = await prisma.v2Message.findFirst({
                where: { channelId: v2ChId },
                orderBy: { id: 'desc' },
                select: { id: true },
            });
            if (last) {
                await prisma.v2Channel.update({
                    where: { id: v2ChId },
                    data:  { lastMessageId: last.id },
                });
            }
        }
    }
}

async function activateV2(companyId, dryRun) {
    if (dryRun) {
        console.log('  [dry-run] useTchatV2 ne sera pas activé');
        return;
    }
    await prisma.company.update({
        where: { id: companyId },
        data:  { useTchatV2: true },
    });
    console.log('  [done] useTchatV2 = true');
}

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────

async function main() {
    const { companyId, dryRun } = parseArgs();

    console.log(`\n=== Migration V1→V2  companyId=${companyId}${dryRun ? '  [DRY-RUN]' : ''} ===\n`);

    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true, useTchatV2: true },
    });

    if (!company) {
        console.error(`Company ${companyId} introuvable.`);
        process.exit(1);
    }

    if (company.useTchatV2 && !dryRun) {
        console.log('Déjà migré (useTchatV2=true). Rien à faire.');
        process.exit(0);
    }

    const stats = { guilds: 0, roles: 0, members: 0, channels: 0, overwrites: 0, messages: 0, skippedMessages: 0 };

    console.log('Étape 1 : Guild');
    const guildId = await migrateGuild(company, dryRun, stats);

    console.log('\nÉtape 2 : @everyone role');
    const everyoneRoleId = await migrateEveryoneRole(guildId, dryRun, stats);

    console.log('\nÉtape 3 : Members');
    await migrateMembers(company, guildId, everyoneRoleId, dryRun, stats);

    console.log('\nÉtape 4 : Channels + overwrites');
    await migrateChannels(company, guildId, dryRun, stats);

    console.log('\nÉtape 5 : Messages (par chunks de 10k)');
    await migrateMessages(company, guildId, dryRun, stats);

    console.log('\nÉtape 6 : Activation V2');
    await activateV2(companyId, dryRun);

    console.log('\n=== Rapport ===');
    console.log(`  guilds     : ${stats.guilds}`);
    console.log(`  roles      : ${stats.roles}`);
    console.log(`  members    : ${stats.members}`);
    console.log(`  channels   : ${stats.channels}`);
    console.log(`  overwrites : ${stats.overwrites}`);
    console.log(`  messages   : ${stats.messages} migrés, ${stats.skippedMessages} déjà migrés`);
    if (dryRun) console.log('\n[DRY-RUN] Aucune écriture effectuée.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
}).finally(() => prisma.$disconnect());
