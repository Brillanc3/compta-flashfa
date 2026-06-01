// backend/src/lib/sseBus.js
'use strict';

// // backend/src/lib/sseBus.js
const EVENT = {
    NOTIFICATION: 'notification',
    MESSAGE_NEW: 'message:new',
    CONVERSATION_NEW: 'conversation:new',
    CONVERSATION_UPDATED: 'conversation:updated',
    PERMISSION_CHANGED: 'permission:changed',
    READ_STATE_UPDATED: 'read:updated',
};

function build(fastify) {
    const { publisher } = fastify.redis;
    const CH = fastify.sseChannels;

    function pack(event, data) {
        return JSON.stringify({
            event,
            ...data,
            ts: Date.now(),
        });
    }

    return {
        EVENT,

        async toUsers(userIds, event, data) {
            const unique = Array.from(new Set(userIds || []));
            if (unique.length === 0) return;
            const payload = pack(event, data);
            await Promise.all(unique.map((uid) => publisher.publish(CH.user(uid), payload)));
        },

        async toCompany(companyId, event, data) {
            if (!companyId) return;
            await publisher.publish(CH.company(companyId), pack(event, data));
        },

        async broadcast(event, data) {
            await publisher.publish(CH.broadcast, pack(event, data));
        },
    };
}

module.exports = { build, EVENT };
