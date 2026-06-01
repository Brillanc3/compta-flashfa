// src/core/gateway/gateway.protocol.js

// OpCodes inspirés de Discord
const OPCODES = {
    DISPATCH: 0,
    HEARTBEAT: 1,
    IDENTIFY: 2,
    // 3,4,5 non utilisés pour le moment
    RESUME: 6,
    RECONNECT: 7,
    INVALID_SESSION: 9,
    HELLO: 10,
    HEARTBEAT_ACK: 11,
};

// Events système de haut niveau
const GATEWAY_EVENTS = {
    READY: 'READY',
    RESUMED: 'RESUMED',
};

module.exports = {
    OPCODES,
    GATEWAY_EVENTS,
};
