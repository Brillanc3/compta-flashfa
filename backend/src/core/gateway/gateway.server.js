// src/core/gateway/gateway.server.js
'use strict';

const jwt = require('jsonwebtoken');
const { OPCODES, GATEWAY_EVENTS } = require('./gateway.protocol');
const createSessionStore = require('./gateway.sessions');
const createRoomStore = require('./gateway.rooms');
const createDispatcher = require('./gateway.dispatcher');
const createGatewayApi = require('./gateway.api');
const {
    redisSubscriber,
    GATEWAY_CHANNEL,
} = require('./gateway.emitter');

const JWT_SECRET = process.env.JWT_SECRET;

function verifyAccessToken(token) {
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded?.type !== 'access') return null;
        return decoded;
    } catch {
        return null;
    }
}

function isWsLike(x) {
    return !!x && typeof x.send === 'function' && typeof x.on === 'function';
}

function extractWs(x) {
    if (!x) return null;
    // Cas 1: x est directement le WebSocket
    if (isWsLike(x)) return x;

    // Cas 2: x est un "connection" qui contient .socket (ancienne signature)
    if (x.socket && isWsLike(x.socket)) return x.socket;

    return null;
}

function extractReq(x) {
    if (!x) return null;
    // FastifyRequest
    if (x.raw && x.raw.headers) return x;

    // Parfois on reçoit reply (qui contient request)
    if (x.request && x.request.raw && x.request.raw.headers) return x.request;

    return null;
}

function setupGateway(
    fastify,
    {
        eventBus,
        path = '/ws/gateway',
        heartbeatIntervalMs = 30_000,
        heartbeatTimeoutMs,
        logPrefix = '[GATEWAY]',
    } = {},
) {
    const heartbeatTimeout = heartbeatTimeoutMs || heartbeatIntervalMs * 2;

    // console.log(`${logPrefix} setupGateway mounted`);
    // console.log(`${logPrefix} listening WS path =`, path);
    // console.log(`${logPrefix} fastify.version =`, fastify.version);
    // console.log(`${logPrefix} node =`, process.version);

    const sessions = createSessionStore();
    const rooms = createRoomStore();
    const dispatcher = createDispatcher({ sessions, rooms });
    const gatewayApi = createGatewayApi({ sessions, rooms, dispatcher, eventBus });
    require('../../modules/chat/chat.gateway')(gatewayApi);
    redisSubscriber.subscribe(GATEWAY_CHANNEL, (err) => {
        if (err) {
            return;
        }
    });

    redisSubscriber.on('message', (channel, message) => {
        if (channel !== GATEWAY_CHANNEL) return;

        let evt;
        try {
            evt = JSON.parse(message);
        } catch (err) {
            console.error('[Gateway][Redis] invalid message', err);
            return;
        }

        const { scope, targets, event, payload } = evt;

        switch (scope) {
            case 'USER':
                if (Array.isArray(targets)) {
                    for (const target of targets) {
                        // Extract numeric ID from "user:123" or "123"
                        const userIdRaw = typeof target === 'string' && target.startsWith('user:')
                            ? target.slice(5)
                            : target;
                        const userId = Number(userIdRaw);

                        if (!Number.isNaN(userId)) {
                            gatewayApi.sendDispatchToUser(userId, event, payload);
                        }
                    }
                }
                break;

            case 'ROOM':
                if (Array.isArray(targets)) {
                    for (const roomId of targets) {
                        gatewayApi.sendDispatchToRoom(roomId, event, payload);
                    }
                }
                break;

            //case 'GLOBAL':
            //    gatewayApi.sendDispatchToAll(event, payload);
            //    break;

            default:
                console.warn('[Gateway][Redis] Unknown scope:', scope);
        }
    });


    // Heartbeat monitor + purge sessions orphelines
    const hbTimer = setInterval(() => {
        const now = Date.now();

        // 1. Fermer les connexions zombies (sans heartbeat)
        for (const conn of sessions.getAllConnections()) {
            if (now - conn.lastHeartbeatAt > heartbeatTimeout) {
                console.log(`${logPrefix} heartbeat timeout -> closing`, {
                    connectionId: conn.id,
                    sessionId: conn.sessionId,
                    userId: conn.userId,
                    ageMs: now - conn.lastHeartbeatAt,
                });
                // Fermer le socket : le handler 'close' appellera deleteConnection
                try { conn.socket.close(4000, 'Heartbeat timeout'); } catch { }
            }
        }

        // 2. Purger les sessions dont la période de grâce est expirée
        sessions.pruneStaleSessions();
    }, heartbeatIntervalMs);
    hbTimer.unref?.();

    // Route WS (signature variable selon runtime -> on déduit ws + req)
    fastify.get(path, { websocket: true }, (a, b) => {
        const cid = `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;

        const ws = extractWs(a) || extractWs(b);
        const req = extractReq(a) || extractReq(b);

        const raw = req?.raw;
        const headers = raw?.headers || {};

        if (!ws) {
            console.error(`${logPrefix} [${cid}] NO WS OBJECT FOUND -> cannot continue`);
            return;
        }

        // Enregistrement connexion
        const conn = sessions.registerConnection(ws);
        const connectionId = conn.id;

        // console.log(`${logPrefix} [${cid}] connection registered`, { connectionId });

        // HELLO initial
        const helloFrame = {
            op: OPCODES.HELLO,
            d: { heartbeat_interval: heartbeatIntervalMs },
        };

        //console.log(`${logPrefix} [${cid}] -> HELLO`);
        ws.send(JSON.stringify(helloFrame));

        ws.on('message', async (message) => {
            const rawMsg = message?.toString?.() ?? '';
            //console.log(`${logPrefix} [${cid}] <-`, rawMsg);

            let frame;
            try { frame = JSON.parse(rawMsg); } catch {
                console.warn(`${logPrefix} [${cid}] invalid JSON`);
                return;
            }

            const { op, d, t } = frame;

            try {
                switch (op) {
                    case OPCODES.HEARTBEAT:
                        sessions.updateHeartbeat(connectionId);
                        ws.send(JSON.stringify({ op: OPCODES.HEARTBEAT_ACK, d: null }));
                        //console.log(`${logPrefix} [${cid}] -> HEARTBEAT_ACK`);
                        break;

                    case OPCODES.IDENTIFY:
                        //console.log(`${logPrefix} [${cid}] IDENTIFY`);
                        await handleIdentify({ cid, connectionId, socket: ws, d });
                        break;

                    case OPCODES.RESUME:
                        //console.log(`${logPrefix} [${cid}] RESUME`);
                        await handleResume({ cid, connectionId, socket: ws, d });
                        break;

                    case OPCODES.DISPATCH:
                        //console.log(`${logPrefix} [${cid}] DISPATCH client->server`, { t });
                        await gatewayApi._handleClientDispatch({ connectionId }, t, d);
                        break;

                    default:
                        //console.warn(`${logPrefix} [${cid}] unsupported op`, op);
                        break;
                }
            } catch (err) {
                console.error(`${logPrefix} [${cid}] handler error`, err);
                try { ws.close(1011, 'Internal error'); } catch { }
            }
        });

        ws.on('close', (code, reason) => {
            // console.log(`${logPrefix} [${cid}] close`, { code, reason: reason?.toString?.() });
            rooms.removeConnectionFromAllRooms(connectionId);
            sessions.deleteConnection(connectionId);
        });

        ws.on('error', (err) => {
            console.error(`${logPrefix} [${cid}] error`, err);
            rooms.removeConnectionFromAllRooms(connectionId);
            sessions.deleteConnection(connectionId);
        });
    });

    async function handleIdentify({ cid, connectionId, socket, d }) {
        const token = d?.token;
        const decoded = verifyAccessToken(token);



        if (!decoded?.userId) {
            try {
                socket.send(JSON.stringify({
                    op: OPCODES.INVALID_SESSION,
                    d: { message: 'Invalid access token' },
                }));
            } catch { }
            try { socket.close(4001, 'Invalid session'); } catch { }
            return;
        }

        const userId = decoded.userId;

        const session = sessions.createSession(userId);
        sessions.attachConnectionToSession(connectionId, session.id, userId);
        rooms.joinRoom(connectionId, `user:${userId}`);

        const payload = {
            session_id: session.id,
            user: { id: userId, username: decoded.username },
        };

        //console.log(`${logPrefix} [${cid}] -> READY`, payload);
        dispatcher.sendDispatchToConnectionId(connectionId, GATEWAY_EVENTS.READY, payload);
    }

    async function handleResume({ cid, connectionId, socket, d }) {
        const sessionId = d?.session_id;

        if (!sessionId) {
            // Pas de session_id : on rejette proprement, le client doit re-IDENTIFY
            try {
                socket.send(JSON.stringify({
                    op: OPCODES.INVALID_SESSION,
                    d: { message: 'Missing session_id', resumable: false },
                }));
            } catch { }
            return;
        }

        const session = sessions.getSession(sessionId);
        if (!session) {
            // Session expirée ou inconnue : le client doit re-IDENTIFY (ne pas fermer brutalement)
            try {
                socket.send(JSON.stringify({
                    op: OPCODES.INVALID_SESSION,
                    d: { message: 'Unknown or expired session', resumable: false },
                }));
            } catch { }
            return;
        }

        sessions.attachConnectionToSession(connectionId, session.id, session.userId);
        rooms.joinRoom(connectionId, `user:${session.userId}`);

        const payload = {
            session_id: session.id,
            user: { id: session.userId },
        };

        dispatcher.sendDispatchToConnectionId(connectionId, GATEWAY_EVENTS.RESUMED, payload);
    }

    return gatewayApi;
}

module.exports = setupGateway;
