'use strict';

const prisma = require('../../../db');
const { createMemory } = require('./memory');

const NS = 'automation_memory';
const _locks = new Map(); // companyId -> Promise (chaîne d'exécution)

async function load(companyId, workflowId) {
    const rec = await prisma.companySettings.findUnique({ where: { companyId: Number(companyId) } });
    const all = (rec && rec.settings && rec.settings[NS]) || {};
    return createMemory(all[workflowId] || {});
}

async function save(companyId, workflowId, memory) {
    const cid = Number(companyId);
    const rec = await prisma.companySettings.findUnique({ where: { companyId: cid } });
    const settings = (rec && rec.settings) || {};
    const all = settings[NS] || {};
    all[workflowId] = memory.toObject();

    await prisma.companySettings.upsert({
        where: { companyId: cid },
        update: { settings: { ...settings, [NS]: all } },
        create: { companyId: cid, settings: { [NS]: { [workflowId]: memory.toObject() } } },
    });
}

/**
 * Sérialise les exécutions d'une même company (read-modify-write mémoire sans course).
 */
function withCompanyLock(companyId, fn) {
    const key = String(companyId);
    const prev = _locks.get(key) || Promise.resolve();
    const run = prev.then(fn, fn); // exécute fn quoi qu'il arrive de la précédente
    // libère la clé quand la chaîne est drainée
    const tracked = run.finally(() => { if (_locks.get(key) === tracked) _locks.delete(key); });
    _locks.set(key, tracked);
    return run;
}

module.exports = { load, save, withCompanyLock };
