// src/core/gateway/gateway.api.js

function createGatewayApi({ sessions, rooms, dispatcher, eventBus }) {
    const clientEventHandlers = new Map(); // eventName -> handler(ctx, data)

    function onClientEvent(eventName, handler) {
        clientEventHandlers.set(eventName, handler);
    }

    async function handleClientDispatch(connectionContext, eventName, payload) {
        const handler = clientEventHandlers.get(eventName);
        if (!handler) return;

        const { connectionId } = connectionContext;
        const conn = sessions.getConnection(connectionId);

        if (!conn) return;

        const session = conn.sessionId ? sessions.getSession(conn.sessionId) : null;
        const userId = conn.userId || (session && session.userId) || null;

        const ctx = {
            connectionId,
            userId,
            session,
            eventBus,
            joinRoom: (roomName) => rooms.joinRoom(connectionId, roomName),
            leaveRoom: (roomName) => rooms.leaveRoom(connectionId, roomName),
            sendDispatchToRoom: (roomName, type, d) =>
                dispatcher.sendDispatchToRoom(roomName, type, d),
            sendDispatchToUser: (targetUserId, type, d) =>
                dispatcher.sendDispatchToUserSimple(targetUserId, type, d),
        };

        await handler(ctx, payload);
    }

    function sendDispatchToRoom(roomName, type, payload) {
        dispatcher.sendDispatchToRoom(roomName, type, payload);
    }

    function sendDispatchToUser(userId, type, payload) {
        dispatcher.sendDispatchToUserSimple(userId, type, payload);
    }

    return {
        // pour les modules
        onClientEvent,
        sendDispatchToRoom,
        sendDispatchToUser,

        // interne (gateway.server.js)
        _handleClientDispatch: handleClientDispatch,
    };
}

module.exports = createGatewayApi;
