// src/core/gateway/gateway.dispatcher.js
const { OPCODES } = require('./gateway.protocol');

function createDispatcher({ sessions, rooms }) {
    function sendFrameToSocket(socket, frame) {
        if (!socket || socket.readyState !== 1) {
            return;
        }
        try {
            socket.send(JSON.stringify(frame));
        } catch (err) {
            // Optionnel: logger
        }
    }

    function sendDispatchToConnectionId(connectionId, type, payload) {
        const conn = sessions.getConnection(connectionId);
        if (!conn || !conn.sessionId) return;

        const seq = sessions.nextSeq(conn.sessionId);

        const frame = {
            op: OPCODES.DISPATCH,
            t: type,
            d: payload,
            s: seq,
        };

        sendFrameToSocket(conn.socket, frame);
    }

    function sendDispatchToRoom(roomName, type, payload) {
        const connectionIds = rooms.getRoomConnections(roomName);
        for (const connectionId of connectionIds) {
            sendDispatchToConnectionId(connectionId, type, payload);
        }
    }

    function sendDispatchToUser(userId) {
        return (type, payload) => {
            const connections = sessions.getConnectionsByUser(userId);
            for (const conn of connections) {
                if (!conn.sessionId) continue;
                const seq = sessions.nextSeq(conn.sessionId);
                const frame = {
                    op: OPCODES.DISPATCH,
                    t: type,
                    d: payload,
                    s: seq,
                };
                sendFrameToSocket(conn.socket, frame);
            }
        };
    }

    function sendDispatchToUserSimple(userId, type, payload) {
        const connections = sessions.getConnectionsByUser(userId);
        for (const conn of connections) {
            if (!conn.sessionId) continue;
            const seq = sessions.nextSeq(conn.sessionId);
            const frame = {
                op: OPCODES.DISPATCH,
                t: type,
                d: payload,
                s: seq,
            };
            sendFrameToSocket(conn.socket, frame);
        }
    }

    return {
        sendDispatchToConnectionId,
        sendDispatchToRoom,
        sendDispatchToUser,
        sendDispatchToUserSimple,
    };
}

module.exports = createDispatcher;
