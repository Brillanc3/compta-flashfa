/**
 * chat-test.js
 * 1. Lit la session depuis chat-session.json (node scripts/chat-auth.js pour générer)
 * 2. Connecte WS gateway (dev:2505) en tant que chattest_bot
 * 3. Crée un salon via REST (dev master:2500)
 * 4. Rejoint la room du salon + poste un message → vérifie CHAT_MESSAGE_CREATED via WS
 *
 * Usage: node scripts/chat-test.js
 */

'use strict';

const path = require('path');
const BACKEND = path.join(__dirname, '../backend');
module.paths.unshift(path.join(BACKEND, 'node_modules'));
require('dotenv').config({ path: path.join(BACKEND, '.env') });

const http = require('http');
const fs   = require('fs');
const WebSocket = require(path.join(BACKEND, 'node_modules/ws'));

// ─── Config ──────────────────────────────────────────────────────────────────

const DEV_API_PORT = 2500;   // master dev (company 1 → shard-global-dev:13347)
const DEV_WS_PORT  = 2505;   // gateway dev
const COMPANY_ID   = 1;
const SESSION_FILE = path.join(__dirname, 'chat-session.json');

const OPCODES = { DISPATCH: 0, HEARTBEAT: 1, IDENTIFY: 2, HELLO: 10, HEARTBEAT_ACK: 11 };

// ─── Load session ─────────────────────────────────────────────────────────────

function loadSession() {
    if (!fs.existsSync(SESSION_FILE)) {
        console.error(`Session introuvable: ${SESSION_FILE}`);
        console.error('Lance: node scripts/chat-auth.js');
        process.exit(1);
    }
    const s = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    if (!s.accessToken) {
        console.error('accessToken manquant dans chat-session.json');
        process.exit(1);
    }
    return s;
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function apiRequest({ method, path: urlPath, body, token }) {
    return new Promise((resolve, reject) => {
        const bodyStr = body ? JSON.stringify(body) : null;
        const req = http.request({
            hostname: '127.0.0.1',
            port: DEV_API_PORT,
            path: urlPath,
            method,
            headers: {
                'Content-Type':    'application/json',
                'x-company-id':    String(COMPANY_ID),
                ...(token   ? { Authorization: `Bearer ${token}` } : {}),
                ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
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
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

// ─── WS helper ────────────────────────────────────────────────────────────────

function connectWS(token) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${DEV_WS_PORT}/ws/gateway`);
        const received = [];
        let hbInterval = null;

        ws.on('error', reject);

        ws.on('message', (raw) => {
            const frame = JSON.parse(raw.toString());

            if (frame.op === OPCODES.HELLO) {
                ws.send(JSON.stringify({ op: OPCODES.IDENTIFY, d: { token } }));
                hbInterval = setInterval(() => {
                    ws.send(JSON.stringify({ op: OPCODES.HEARTBEAT }));
                }, Math.max(5000, frame.d.heartbeat_interval / 2));
                return;
            }
            if (frame.op === OPCODES.HEARTBEAT_ACK) return;

            if (frame.op === OPCODES.DISPATCH) {
                if (frame.t === 'READY') {
                    console.log('  [WS] READY — session', frame.d.session_id);
                    resolve({ ws, received, stopHb: () => clearInterval(hbInterval) });
                    return;
                }
                received.push({ t: frame.t, d: frame.d });
                console.log('  [WS] EVENT:', frame.t,
                    JSON.stringify(frame.d).slice(0, 120));
            }
        });

        ws.on('close', () => clearInterval(hbInterval));

        setTimeout(() => reject(new Error('WS HELLO timeout (5s)')), 5000);
    });
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n=== Chat Test (API:${DEV_API_PORT} WS:${DEV_WS_PORT} company:${COMPANY_ID}) ===\n`);

    const session = loadSession();
    console.log(`Session: ${session.username} (userId=${session.userId})`);

    // ── Re-login si token expiré ──
    let token = session.accessToken;
    const testRes = await apiRequest({ method: 'GET', path: '/chat/channels', token });
    if (testRes.status === 401) {
        console.log('  Token expiré — re-login...');
        const loginRes = await apiRequest({
            method: 'POST',
            path: '/auth/login',
            body: { username: session.username, password: session.password },
        });
        if (loginRes.status !== 200) {
            console.error('  ECHEC re-login:', loginRes.status, loginRes.body);
            process.exit(1);
        }
        token = loginRes.body.accessToken;
        session.accessToken = token;
        fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
        console.log('  ✓ Token rafraîchi');
    } else {
        console.log('  ✓ Token valide');
    }

    // ── 1. WS connect ──
    console.log('\n[1] Connexion WS gateway...');
    const { ws, received, stopHb } = await connectWS(token);

    ws.send(JSON.stringify({
        op: OPCODES.DISPATCH,
        t: 'ROOM_SUBSCRIBE',
        d: { room: `company:${COMPANY_ID}`, action: 'join' },
    }));
    console.log(`  JOIN company:${COMPANY_ID}`);

    // ── 2. Créer salon ──
    const channelName = `test-${Date.now()}`;
    console.log(`\n[2] Création salon "${channelName}"...`);
    const createRes = await apiRequest({
        method: 'POST',
        path: '/chat/channels',
        body: { name: channelName, topic: 'Salon créé par le script de test automatique' },
        token,
    });

    if (createRes.status !== 200 && createRes.status !== 201) {
        console.error('  ECHEC:', createRes.status, JSON.stringify(createRes.body));
        stopHb(); ws.close(); process.exit(1);
    }

    const channel = createRes.body;
    const channelId = channel.id;
    console.log(`  ✓ Salon créé — id=${channelId} | name=${channel.name}`);

    // ── 3. JOIN room salon + post message ──
    ws.send(JSON.stringify({
        op: OPCODES.DISPATCH,
        t: 'ROOM_SUBSCRIBE',
        d: { room: `channel:${channelId}`, action: 'join' },
    }));
    console.log(`  JOIN channel:${channelId}`);

    await new Promise((r) => setTimeout(r, 400));

    console.log('\n[3] Post message...');
    const msgRes = await apiRequest({
        method: 'POST',
        path: `/chat/channels/${channelId}/messages`,
        body: { content: '👋 Hello depuis le script de test !' },
        token,
    });

    if (msgRes.status === 200 || msgRes.status === 201) {
        console.log('  ✓ Message posté — id=' + msgRes.body.id);
    } else {
        console.warn('  ⚠ Message échec:', msgRes.status, JSON.stringify(msgRes.body));
    }

    // ── 4. Attente events ──
    console.log('\n[4] Attente events WS (3s)...');
    await new Promise((r) => setTimeout(r, 3000));

    // ── Rapport ──
    console.log('\n══════════════════════ RAPPORT ══════════════════════');
    const hasMsgEvt = received.some((e) => e.t === 'CHAT_MESSAGE_CREATED');

    console.log(`  Salon créé      : ✅ id=${channelId}`);
    console.log(`  WS events reçus : ${received.length}`);
    console.log(`  CHAT_MSG_CREATED: ${hasMsgEvt ? '✅' : '⚠ non reçu (JOIN trop tard?)'}`);
    console.log('');
    console.log('  → Ouvre https://ccadev.jipeg-corporation.eu/dashboard/chat');
    console.log(`  → Cherche le salon "${channelName}" dans la company ${COMPANY_ID}`);
    console.log('  (channelCreated = SSE, pas WS — rafraîchir la liste si absent)');
    console.log('══════════════════════════════════════════════════════\n');

    stopHb();
    ws.close();
}

main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1); });
