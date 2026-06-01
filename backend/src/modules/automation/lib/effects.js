// backend/src/modules/automation/lib/effects.js
'use strict';

const prisma = require('../../../db');
const notificationService = require('../../../services/notificationService');
const ctxLib = require('./context');

/**
 * Remplace les jetons {item} {quantity} {owner} {amount} {reason} {memory.X}
 * dans un texte à partir du contexte et de la mémoire.
 */
function interpolate(text, env) {
    const { code, label } = ctxLib.getItem(env.context);
    const base = {
        item: label || code,
        quantity: ctxLib.getQuantity(env.context),
        owner: ctxLib.getOwner(env.context),
        amount: ctxLib.getAmount(env.context).toFixed(2),
        reason: ctxLib.getReason(env.context),
    };
    return String(text || '')
        .replace(/\{memory\.([\w-]+)\}/g, (_, v) => {
            const val = env.memory.get(v);
            return val === undefined ? '' : String(val);
        })
        .replace(/\{(\w+)\}/g, (m, k) => (k in base ? String(base[k]) : m));
}

async function sendChatMessage(block, env) {
    const channelId = block.fields ? block.fields.CHANNEL : null;
    if (!channelId || channelId === '0') {
        env.log('action_tchat_send_message: aucun salon sélectionné, ignoré');
        return true;
    }
    const content = interpolate(block.fields.MESSAGE, env);
    // require tardif : évite les dépendances circulaires au boot
    const { sendSystemMessage } = require('../../tchatv2/message/system.service');
    await sendSystemMessage({ channelId: String(channelId), content });
    return true;
}

async function notify(block, env) {
    const f = block.fields || {};
    const title = f.TITLE || 'Automation';
    const body = interpolate(f.BODY || '', env);
    const targetType = f.TARGET_TYPE || 'ALL';

    let recipientIds = [];
    if (targetType === 'ALL') {
        const users = await prisma.user.findMany({
            where: { companies: { some: { companyId: env.context.companyId } } },
            select: { id: true },
        });
        recipientIds = users.map((u) => u.id);
    } else if (targetType === 'USER' && f.TARGET_ID) {
        recipientIds = [parseInt(f.TARGET_ID, 10)];
    }

    if (recipientIds.length > 0) {
        await notificationService.createNotification({
            recipientUserIds: recipientIds,
            content: { title, body },
            type: 'SYSTEM',
            behavior: 'PERMANENT',
        });
    }
    return true;
}

async function setExpenseStatus(block, env) {
    const d = ctxLib.parseData(env.context);
    const reportId = d.id;
    const status = block.fields ? block.fields.STATUS : null;
    if (!reportId) { env.log('setExpenseStatus: id manquant'); return true; }
    const comptaService = require('../../comptabilite/comptabilite.service');
    await comptaService.updateExpenseReportStatus(reportId, null, status);
    return true;
}

module.exports = { interpolate, sendChatMessage, notify, setExpenseStatus };
