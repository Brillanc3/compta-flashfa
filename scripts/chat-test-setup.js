/**
 * chat-test-setup.js
 * Crée user testbot42 + CompanyEmployee pour company 1 avec toutes les perms chat.
 * Usage: node scripts/chat-test-setup.js
 */

'use strict';

const path = require('path');
const BACKEND = path.join(__dirname, '../backend');
// Résolution modules depuis backend/node_modules
module.paths.unshift(path.join(BACKEND, 'node_modules'));
require('dotenv').config({ path: path.join(BACKEND, '.env') });

const bcrypt = require('bcrypt');
const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
const prisma = new PrismaClient();

// Toutes les perms chat (bits 0-9)
const CHAT_ADMIN_BITS = 1023n;

const TEST_USER = {
    username: 'testbot42',
    password: 'Test42!',
    name: 'TestBot 42',
};
const COMPANY_ID = 1;
const RANK_NAME = 'TestAdmin';
const RANK_POSITION = 9998;

async function main() {
    console.log('=== Setup testbot42 pour company', COMPANY_ID, '===\n');

    // 1. Upsert user
    const hashedPwd = await bcrypt.hash(TEST_USER.password, 10);
    const user = await prisma.user.upsert({
        where: { username: TEST_USER.username },
        create: {
            username: TEST_USER.username,
            password: hashedPwd,
            name: TEST_USER.name,
            status: 'ACTIVE',
        },
        update: {
            password: hashedPwd,
            name: TEST_USER.name,
            status: 'ACTIVE',
        },
    });
    console.log('✓ User:', user.id, user.username);

    // 2. Upsert rank (position doit être unique par company)
    let rank;
    try {
        rank = await prisma.rank.upsert({
            where: { companyId_name: { companyId: COMPANY_ID, name: RANK_NAME } },
            create: {
                name: RANK_NAME,
                companyId: COMPANY_ID,
                position: RANK_POSITION,
                chatPermissionsBits: CHAT_ADMIN_BITS,
            },
            update: {
                chatPermissionsBits: CHAT_ADMIN_BITS,
            },
        });
    } catch (e) {
        // Position conflict — récupère l'existant
        rank = await prisma.rank.findUnique({
            where: { companyId_name: { companyId: COMPANY_ID, name: RANK_NAME } },
        });
        if (!rank) throw e;
    }
    console.log('✓ Rank:', rank.id, rank.name, 'chatBits =', rank.chatPermissionsBits.toString());

    // 3. Upsert CompanyEmployee
    const employee = await prisma.companyEmployee.upsert({
        where: { companyId_userId: { companyId: COMPANY_ID, userId: user.id } },
        create: {
            companyId: COMPANY_ID,
            userId: user.id,
            rankId: rank.id,
            status: 'ACTIVE',
        },
        update: {
            rankId: rank.id,
            status: 'ACTIVE',
        },
    });
    console.log('✓ CompanyEmployee:', employee.id, 'status =', employee.status);

    console.log('\n=== OK — credentials pour le script de test ===');
    console.log('  username:', TEST_USER.username);
    console.log('  password:', TEST_USER.password);
    console.log('  userId  :', user.id);
    console.log('  company :', COMPANY_ID);
}

main()
    .catch((e) => { console.error('ERREUR:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
