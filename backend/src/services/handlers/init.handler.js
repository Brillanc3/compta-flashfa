// backend/src/services/handlers/cancelBill.handler.js

const prisma = require('../../db');
const { createNotification } = require('../notificationService'); // Assumes this service exists

const ADMIN_LOG_TYPES = [
    'init',
    'payMember',
    'changePanelUrl',
    'setPermission',
    'inviteMember',
    'createRank',
    'removeRank',
    'renameRank',
    'renameGroup',
    'setPayTime',
    'setUsername',
    'refuseInvite',
    'setPhoneNumber',
    'shop',
    'fuel_fill',
    'marketSell',
    'changeRank',
    'changeIconUrl',
    'cancelInvite',
    'station_fill'
];

/**
 * Indique si ce handler peut traiter ce type de log.
 * @param {string} logType
 * @returns {boolean}
 */
function supports(logType) {
    return ADMIN_LOG_TYPES.includes(logType);
}

/**
 * Processes a log to cancel a bill.
 * @param {object} log - The full log object from the database.
 */
async function handle(log) {
    // Logs admin ignorés volontairement — aucun traitement requis
}

module.exports = {
    supports,
    handle,
};