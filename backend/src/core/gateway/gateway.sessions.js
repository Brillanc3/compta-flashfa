// src/core/gateway/gateway.sessions.js
const { randomUUID } = require('crypto');

// Durée de grâce avant qu'une session sans connexion soit supprimée (ms)
const SESSION_GRACE_MS = 60_000;

function createSessionStore() {
    // sessionId -> { id, userId, connectionIds: Set<string>, seq: number, createdAt: number, disconnectedAt: number|null }
    const sessions = new Map();
    // connectionId -> { id, socket, sessionId: string|null, userId: number|null, lastHeartbeatAt: number }
    const connections = new Map();

    function registerConnection(socket) {
        const id = randomUUID();
        const conn = {
            id,
            socket,
            sessionId: null,
            userId: null,
            lastHeartbeatAt: Date.now(),
        };
        connections.set(id, conn);
        return conn;
    }

    function getConnection(connectionId) {
        return connections.get(connectionId) || null;
    }

    /**
     * Supprime une connexion. La session associée est conservée pendant SESSION_GRACE_MS
     * pour permettre un RESUME. Elle sera purgée par pruneStaleSessions().
     */
    function deleteConnection(connectionId) {
        const conn = connections.get(connectionId);
        if (!conn) return;
        const { sessionId } = conn;

        if (sessionId) {
            const session = sessions.get(sessionId);
            if (session) {
                session.connectionIds.delete(connectionId);
                // On ne supprime PAS la session immédiatement : elle reste disponible pour RESUME
                if (session.connectionIds.size === 0) {
                    session.disconnectedAt = Date.now();
                }
            }
        }

        connections.delete(connectionId);
    }

    function createSession(userId) {
        const id = randomUUID();
        const session = {
            id,
            userId,
            connectionIds: new Set(),
            seq: 0,
            createdAt: Date.now(),
            disconnectedAt: null,
        };
        sessions.set(id, session);
        return session;
    }

    function getSession(sessionId) {
        return sessions.get(sessionId) || null;
    }

    function attachConnectionToSession(connectionId, sessionId, userId) {
        const conn = connections.get(connectionId);
        const session = sessions.get(sessionId);
        if (!conn || !session) return false;

        // retirer de l'ancienne session si besoin
        if (conn.sessionId && conn.sessionId !== sessionId) {
            const old = sessions.get(conn.sessionId);
            if (old) {
                old.connectionIds.delete(connectionId);
                // Même ici : on laisse la vieille session vivre le temps de la grâce
                if (old.connectionIds.size === 0) {
                    old.disconnectedAt = Date.now();
                }
            }
        }

        conn.sessionId = sessionId;
        conn.userId = userId;

        // La connexion est de retour : on réinitialise disconnectedAt
        session.disconnectedAt = null;
        session.connectionIds.add(connectionId);
        return true;
    }

    function updateHeartbeat(connectionId) {
        const conn = connections.get(connectionId);
        if (!conn) return;
        conn.lastHeartbeatAt = Date.now();
    }

    function getAllConnections() {
        return Array.from(connections.values());
    }

    function nextSeq(sessionId) {
        const session = sessions.get(sessionId);
        if (!session) return null;
        session.seq += 1;
        return session.seq;
    }

    function getConnectionsByUser(userId) {
        return Array.from(connections.values()).filter(
            (c) => c.userId != null && c.userId === userId,
        );
    }

    /**
     * Purge les sessions sans connexion dont la grâce est expirée.
     * À appeler périodiquement (ex: toutes les 30s).
     */
    function pruneStaleSessions() {
        const now = Date.now();
        for (const [id, session] of sessions) {
            if (
                session.connectionIds.size === 0 &&
                session.disconnectedAt !== null &&
                now - session.disconnectedAt > SESSION_GRACE_MS
            ) {
                sessions.delete(id);
            }
        }
    }

    return {
        registerConnection,
        getConnection,
        deleteConnection,
        createSession,
        getSession,
        attachConnectionToSession,
        updateHeartbeat,
        getAllConnections,
        nextSeq,
        getConnectionsByUser,
        pruneStaleSessions,
    };
}

module.exports = createSessionStore;
