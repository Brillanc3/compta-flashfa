/**
 * chat-auth.js
 * Register (si inexistant) + login → sauvegarde credentials dans chat-session.json
 *
 * Usage: node scripts/chat-auth.js
 * Résultat: scripts/chat-session.json
 */

'use strict';

const path = require('path');
const BACKEND = path.join(__dirname, '../backend');
module.paths.unshift(path.join(BACKEND, 'node_modules'));
require('dotenv').config({ path: path.join(BACKEND, '.env') });

const http = require('http');
const fs   = require('fs');
const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));

const DEV_API_PORT = 2500;
const SESSION_FILE = path.join(__dirname, 'chat-session.json');
const COMPANY_ID   = 1;
const CHAT_ADMIN_BITS = 1023n;

const USER = {
    username: 'chattest_bot',
    password: 'ChatBot99!',
    name:     'ChatTest Bot',
};

function apiPost(urlPath, body) {
    return new Promise((resolve, reject) => {
        const bodyStr = JSON.stringify(body);
        const req = http.request({
            hostname: '127.0.0.1',
            port:     DEV_API_PORT,
            path:     urlPath,
            method:   'POST',
            headers: {
                'Content-Type':   'application/json',
                'Content-Length': Buffer.byteLength(bodyStr),
            },
        }, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        req.write(bodyStr);
        req.end();
    });
}

async function ensureEmployee(userId) {
    const prisma = new PrismaClient();
    try {
        // Trouve ou crée un rang TestAdmin pour company 1
        let rank = await prisma.rank.findUnique({
            where: { companyId_name: { companyId: COMPANY_ID, name: 'TestAdmin' } },
        });
        if (!rank) {
            rank = await prisma.rank.create({
                data: {
                    name: 'TestAdmin',
                    companyId: COMPANY_ID,
                    position: 9998,
                    chatPermissionsBits: CHAT_ADMIN_BITS,
                },
            });
        } else if (rank.chatPermissionsBits !== CHAT_ADMIN_BITS) {
            rank = await prisma.rank.update({
                where: { id: rank.id },
                data: { chatPermissionsBits: CHAT_ADMIN_BITS },
            });
        }

        const employee = await prisma.companyEmployee.upsert({
            where: { companyId_userId: { companyId: COMPANY_ID, userId } },
            create: { companyId: COMPANY_ID, userId, rankId: rank.id, status: 'ACTIVE' },
            update: { rankId: rank.id, status: 'ACTIVE' },
        });

        console.log(`  ✓ CompanyEmployee upsert — id=${employee.id} rank=${rank.name} chatBits=${rank.chatPermissionsBits}`);
    } finally {
        await prisma.$disconnect();
    }
}

async function main() {
    console.log(`=== Chat Auth (dev API:${DEV_API_PORT}) ===\n`);

    // ── 1. Register ──
    console.log(`[1] Register "${USER.username}"...`);
    const regRes = await apiPost('/auth/register', USER);

    if (regRes.status === 409) {
        console.log('  Déjà existant — skip register');
    } else if (regRes.status === 200 || regRes.status === 201) {
        console.log('  ✓ Inscrit');
    } else {
        console.error('  ECHEC register:', regRes.status, regRes.body);
        process.exit(1);
    }

    // ── 2. Login ──
    console.log(`[2] Login "${USER.username}"...`);
    const loginRes = await apiPost('/auth/login', {
        username: USER.username,
        password: USER.password,
    });

    if (loginRes.status !== 200) {
        console.error('  ECHEC login:', loginRes.status, loginRes.body);
        process.exit(1);
    }

    const { accessToken, refreshToken, user } = loginRes.body;
    const userId = user?.id ?? loginRes.body.userId;
    console.log(`  ✓ Token obtenu — userId=${userId}`);

    // ── 3. CompanyEmployee ──
    console.log(`[3] CompanyEmployee company ${COMPANY_ID}...`);
    await ensureEmployee(userId);

    // ── 4. Sauvegarde ──
    const session = {
        username:     USER.username,
        password:     USER.password,
        userId,
        accessToken,
        refreshToken:  refreshToken ?? null,
        savedAt:      new Date().toISOString(),
    };

    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    console.log(`\n✅ Prêt → ${SESSION_FILE}`);
    console.log(`   userId      : ${userId}`);
    console.log(`   accessToken : ${accessToken.slice(0, 40)}...`);
}

main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1); });
