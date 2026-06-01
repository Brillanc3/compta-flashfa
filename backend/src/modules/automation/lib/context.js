'use strict';

function parseData(context) {
    const raw = context?.data;
    if (!raw) return {};
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); } catch { return {}; }
}

function getAmount(context) {
    return parseFloat(parseData(context).amount || 0) || 0;
}

function getReason(context) {
    const d = parseData(context);
    return (d.reason || d.comment || '').toString();
}

function getItem(context) {
    const d = parseData(context);
    const code = (d.item || '').toString();
    const label = (d.metadata && d.metadata.formatname) ? String(d.metadata.formatname) : code;
    return { code, label };
}

function getQuantity(context) {
    const d = parseData(context);
    return typeof d.count === 'number' ? d.count : (parseFloat(d.count || 0) || 0);
}

function getOwner(context) {
    return (parseData(context).owner || '').toString();
}

module.exports = { parseData, getAmount, getReason, getItem, getQuantity, getOwner };
