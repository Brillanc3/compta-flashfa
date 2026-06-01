// src/core/gateway/gateway.rooms.js

function createRoomStore() {
    // roomName -> Set<connectionId>
    const rooms = new Map();
    // connectionId -> Set<roomName>
    const connectionRooms = new Map();

    function joinRoom(connectionId, roomName) {
        if (!rooms.has(roomName)) {
            rooms.set(roomName, new Set());
        }
        rooms.get(roomName).add(connectionId);

        if (!connectionRooms.has(connectionId)) {
            connectionRooms.set(connectionId, new Set());
        }
        connectionRooms.get(connectionId).add(roomName);
    }

    function leaveRoom(connectionId, roomName) {
        const room = rooms.get(roomName);
        if (room) {
            room.delete(connectionId);
            if (room.size === 0) {
                rooms.delete(roomName);
            }
        }

        const connRooms = connectionRooms.get(connectionId);
        if (connRooms) {
            connRooms.delete(roomName);
            if (connRooms.size === 0) {
                connectionRooms.delete(connectionId);
            }
        }
    }

    function removeConnectionFromAllRooms(connectionId) {
        const connRooms = connectionRooms.get(connectionId);
        if (!connRooms) return;

        for (const roomName of connRooms) {
            const room = rooms.get(roomName);
            if (room) {
                room.delete(connectionId);
                if (room.size === 0) {
                    rooms.delete(roomName);
                }
            }
        }
        connectionRooms.delete(connectionId);
    }

    function getRoomConnections(roomName) {
        const room = rooms.get(roomName);
        if (!room) return [];
        return Array.from(room.values());
    }

    return {
        joinRoom,
        leaveRoom,
        removeConnectionFromAllRooms,
        getRoomConnections,
    };
}

module.exports = createRoomStore;
