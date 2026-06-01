'use strict';

/**
 * Supprime toutes les données v2 (guilds, channels, messages…) sans toucher au schéma.
 * Ordre respectant les FK (feuilles en premier, racines en dernier).
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Suppression des données v2…');

    await prisma.$transaction([
        prisma.v2MigrationMap.deleteMany(),
        prisma.v2AuditLog.deleteMany(),
        prisma.v2Ban.deleteMany(),
        prisma.v2Invite.deleteMany(),
        prisma.v2Webhook.deleteMany(),
        prisma.v2PinnedMessage.deleteMany(),
        prisma.v2Reaction.deleteMany(),
        prisma.v2MessageMention.deleteMany(),
        prisma.v2Embed.deleteMany(),
        prisma.v2Attachment.deleteMany(),
        prisma.v2Message.deleteMany(),
        prisma.v2ThreadMetadata.deleteMany(),
        prisma.v2PermissionOverwrite.deleteMany(),
        prisma.v2Channel.deleteMany(),
        prisma.v2MemberRole.deleteMany(),
        prisma.v2Member.deleteMany(),
        prisma.v2Role.deleteMany(),
        prisma.v2Guild.deleteMany(),
    ]);

    console.log('Toutes les données v2 supprimées.');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
