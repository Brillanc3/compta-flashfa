// backend/src/lib/eventBus.js
'use strict';

const { CH, xadd } = require('./sse/streams');

const EVENT = {
    READY: 'ready', // interne
    NOTIFICATION: 'notification',
    MESSAGE_NEW: 'message:new',
    CONVERSATION_NEW: 'conversation:new',
    CONVERSATION_UPDATED: 'conversation:updated',
    PERMISSION_CHANGED: 'permission:changed',
    READ_STATE_UPDATED: 'read:updated',
    COMPANY_MODULES_UPDATED: 'company.modules.updated',
};

function buildEventBus(redis) {
    async function toUsers(userIds, event, data) {
        const uniq = Array.from(new Set(userIds || []));
        if (!uniq.length) return [];
        return Promise.all(uniq.map((uid) => xadd(redis, CH.user(uid), event, { event, ...data, ts: Date.now() })));
    }

    async function toCompany(companyId, event, data) {
        if (!companyId) return null;
        return xadd(redis, CH.company(companyId), event, { event, ...data, ts: Date.now() });
    }

    async function broadcast(event, data) {
        return xadd(redis, CH.broadcast, event, { event, ...data, ts: Date.now() });
    }

    // Helpers métier (exemples)
    async function messageNew({ recipientsUserIds, conversationId, message }) {
        return toUsers(recipientsUserIds, EVENT.MESSAGE_NEW, { conversationId: String(conversationId), message });
    }
    async function conversationNew({ recipientsUserIds, conversation }) {
        return toUsers(recipientsUserIds, EVENT.CONVERSATION_NEW, { conversation });
    }

    async function companyModulesUpdated({ companyId, byUserId = null, modules = null, diff = null }) {
        // 'modules' et 'diff' sont optionnels (utile en debug/UI). Minimum: companyId.
        return toCompany(companyId, EVENT.COMPANY_MODULES_UPDATED, {
            companyId: String(companyId),
            byUserId: byUserId ? String(byUserId) : null,
            modules,   // ex: ['comptabilite','employees']
            diff,      // ex: { added:['employees'], removed:[] }
        });
    }

    return {
        EVENT,
        toUsers,
        toCompany,
        broadcast,
        messageNew,
        conversationNew,
        companyModulesUpdated
    };
}

module.exports = { buildEventBus };
