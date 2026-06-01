/**
 * Comprehensive handler test script
 * Tests all handlers in src/services/handlers/ via Prisma + processLog
 */

'use strict';

const crypto = require('crypto');

// Bootstrap path so requires inside handlers resolve correctly
process.chdir(__dirname + '/..');

const prisma = require('../src/db');
const { process: processLog } = require('../src/services/logProcessor.service');

// ─── Fictional test data ────────────────────────────────────────────────────

const EMP1 = { characterId: 99001, discordId: '999000111222333444', name: 'Agent Fictif' };
const EMP2 = { characterId: 99003, discordId: '999000333444555666', name: 'Agent Second' };
const CLIENT = { characterId: 99002, discordId: '999000222333444555', name: 'Client Fictif' };

const BILL_ID_1 = 9999901; // used by billCreate + cancelBill
const BILL_ID_2 = 9999902; // used by another billCreate + paidBill

// ─── Helpers ────────────────────────────────────────────────────────────────

const results = [];

function pass(name) {
    results.push({ name, ok: true });
    console.log(`✅ ${name}`);
}

function fail(name, err) {
    results.push({ name, ok: false, err });
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`❌ ${name}`);
    console.log(`   └─ ${msg}`);
}

async function createLog(companyId, logType, data, category = 'general') {
    return prisma.log.create({
        data: {
            company: { connect: { id: companyId } },
            logType,
            category: category || 'general',
            data: JSON.stringify(data),
            date: String(Date.now()),
            isProcessed: false,
        },
    });
}

async function runHandler(name, companyId, logType, data, category = null) {
    let log;
    try {
        log = await createLog(companyId, logType, data, category);
        await processLog(log);
        const updated = await prisma.log.findUnique({ where: { id: log.id } });
        if (!updated.isProcessed) {
            throw new Error(updated.processingError || 'isProcessed=false with no error message');
        }
        pass(name);
        return { log: updated, ok: true };
    } catch (err) {
        fail(name, err);
        return { log, ok: false };
    }
}

// ─── Setup ──────────────────────────────────────────────────────────────────

async function setup() {
    // 1. Create company
    const apiKey = crypto.randomBytes(16).toString('hex');
    const company = await prisma.company.create({
        data: { name: 'Agent Test', apiKey, isApiActive: true },
    });

    // 2. Create ranks
    const rankRecrue = await prisma.rank.create({
        data: {
            name: 'Recrue',
            position: 1,
            companyId: company.id,
            remunerationConfig: { commissionRate: 0, serviceSalaryPerMinute: 0 },
        },
    });

    const rankAgent = await prisma.rank.create({
        data: {
            name: 'Agent',
            position: 2,
            groupRankId: 100,
            companyId: company.id,
            remunerationConfig: { commissionRate: 0, serviceSalaryPerMinute: 0 },
        },
    });

    // 3. Ensure TransactionCategory rows (globally unique by name)
    await prisma.transactionCategory.upsert({
        where: { name: 'CHIFFRE_AFFAIRES' },
        update: {},
        create: { name: 'CHIFFRE_AFFAIRES', type: 'REVENUE', isDefault: true },
    });

    await prisma.transactionCategory.upsert({
        where: { name: 'MATIERES_PREMIERES' },
        update: {},
        create: { name: 'MATIERES_PREMIERES', type: 'EXPENSE', isDefault: true },
    });

    console.log(`\n[Setup] Company ID=${company.id}, ranks: ${rankRecrue.name}(${rankRecrue.id}), ${rankAgent.name}(${rankAgent.id})\n`);

    return { company, rankRecrue, rankAgent };
}

// ─── Activate employee helper ────────────────────────────────────────────────

async function activateEmployee(companyId, characterId) {
    const user = await prisma.user.findFirst({ where: { characterId } });
    if (!user) throw new Error(`activateEmployee: user with characterId=${characterId} not found`);

    await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });

    const emp = await prisma.companyEmployee.findFirst({ where: { companyId, userId: user.id } });
    if (!emp) throw new Error(`activateEmployee: employment for characterId=${characterId} not found`);

    await prisma.companyEmployee.update({ where: { id: emp.id }, data: { status: 'ACTIVE' } });

    return { user, emp };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function runTests(company) {
    const cid = company.id;

    // ── 1. acceptInvit (emp1) ────────────────────────────────────────────────
    await runHandler('acceptInvit (emp1)', cid, 'acceptInvit', {
        properName: EMP1.name,
        discordId: EMP1.discordId,
        characterId: EMP1.characterId,
    });

    // Set emp1 ACTIVE before tests requiring ACTIVE status
    try {
        await activateEmployee(cid, EMP1.characterId);
        console.log('[Setup] emp1 set to ACTIVE\n');
    } catch (e) {
        console.warn('[Setup] could not activate emp1:', e.message);
    }

    // ── 2. duty ─────────────────────────────────────────────────────────────
    await runHandler('duty', cid, 'setStatus', {
        characterId: EMP1.characterId,
        discord: EMP1.discordId,
        properName: EMP1.name,
        status: true,
    });

    // ── 3. garage ───────────────────────────────────────────────────────────
    await runHandler('garage', cid, 'garage', {
        characterId: EMP1.characterId,
        discord: EMP1.discordId,
        properName: EMP1.name,
        vehicleId: 1001,
    });

    // ── 4. inventory ─────────────────────────────────────────────────────────
    await runHandler('inventory', cid, 'add', {
        characterId: EMP1.characterId,
        discord: EMP1.discordId,
        properName: EMP1.name,
        item: 'test_item',
        count: 5,
        owner: `char_${EMP1.characterId}`,
    }, 'inventory');

    // ── 5. addMoney ──────────────────────────────────────────────────────────
    await runHandler('addMoney', cid, 'addmoney', {
        characterId: EMP1.characterId,
        discord: EMP1.discordId,
        properName: EMP1.name,
        amount: 5000,
        reason: 'Salaire mensuel',
        balanceAfterFromGame: 5000,
        before: 0,
        after: 5000,
    });

    // ── 6. billCreate (bill 1) ───────────────────────────────────────────────
    await runHandler('billCreate (bill 1)', cid, 'create', {
        fromPropername: EMP1.name,
        toPropername: CLIENT.name,
        billId: BILL_ID_1,
        amount: 1500,
        reason: 'Service rendu',
        fromDiscord: EMP1.discordId,
        characterIdFrom: EMP1.characterId,
    });

    // ── 7. cancelBill (bill 1) ───────────────────────────────────────────────
    await runHandler('cancelBill (bill 1)', cid, 'cancel', {
        cancellerPropername: EMP1.name,
        cancellerDiscord: EMP1.discordId,
        characterIdCanceller: EMP1.characterId,
        billId: BILL_ID_1,
    });

    // ── 8. billCreate (bill 2) ───────────────────────────────────────────────
    await runHandler('billCreate (bill 2)', cid, 'create', {
        fromPropername: EMP1.name,
        toPropername: CLIENT.name,
        billId: BILL_ID_2,
        amount: 2000,
        reason: 'Consultation',
        fromDiscord: EMP1.discordId,
        characterIdFrom: EMP1.characterId,
    });

    // ── 9. paidBill (bill 2) ─────────────────────────────────────────────────
    await runHandler('paidBill (bill 2)', cid, 'paid', {
        billId: BILL_ID_2,
    });

    // ── 10. rankChange (emp1 → groupRankId 100) ──────────────────────────────
    await runHandler('rankChange', cid, 'upRank', {
        targetCharacterId: EMP1.characterId,
        newGroupRankId: 100,
        properName: EMP1.name,
    });

    // ── 11. kickMember (emp1) ─────────────────────────────────────────────────
    // emp1 must be ACTIVE — rankChange doesn't change status, still ACTIVE
    await runHandler('kickMember (emp1)', cid, 'kickMember', {
        targetCharacterId: EMP1.characterId,
        targetProperName: EMP1.name,
        properName: 'Admin Fictif',
    });

    // ── 12. acceptInvit (emp2) ────────────────────────────────────────────────
    await runHandler('acceptInvit (emp2)', cid, 'acceptInvit', {
        properName: EMP2.name,
        discordId: EMP2.discordId,
        characterId: EMP2.characterId,
    });

    // Set emp2 ACTIVE before leaveGroup
    try {
        await activateEmployee(cid, EMP2.characterId);
        console.log('[Setup] emp2 set to ACTIVE\n');
    } catch (e) {
        console.warn('[Setup] could not activate emp2:', e.message);
    }

    // ── 13. leaveGroup (emp2) ─────────────────────────────────────────────────
    await runHandler('leaveGroup (emp2)', cid, 'leaveGroup', {
        properName: EMP2.name,
        discord: EMP2.discordId,
        characterId: EMP2.characterId,
    });

    // ── 14. withdraw ──────────────────────────────────────────────────────────
    await runHandler('withdraw', cid, 'withdraw', {
        characterId: EMP1.characterId,
        discord: EMP1.discordId,
        properName: EMP1.name,
        amount: 300,
        reason: 'Achat matériel',
        before: 5000,
        after: 4700,
    });

    // ── 15. properName update test ────────────────────────────────────────────
    // duty handler explicitly patches user.name when properName differs
    const updatedName = 'Agent Fictif Mis à Jour';
    try {
        const log = await createLog(cid, 'setStatus', {
            characterId: EMP1.characterId,
            discord: EMP1.discordId,
            properName: updatedName,
            status: true,
        });
        await processLog(log);

        const user = await prisma.user.findFirst({ where: { characterId: EMP1.characterId } });
        if (user && user.name === updatedName) {
            pass('properName update (duty re-run)');
        } else {
            fail('properName update (duty re-run)', `Expected name="${updatedName}", got "${user?.name}"`);
        }
    } catch (err) {
        fail('properName update (duty re-run)', err);
    }
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanup(company) {
    const cid = company.id;

    try {
        // Delete logs for this company
        await prisma.log.deleteMany({ where: { companyId: cid } });

        // Delete company (cascade handles: ranks, bills, employees, transactions, etc.)
        await prisma.company.delete({ where: { id: cid } });

        // Delete orphaned users (companyEmployee cascades but user remains)
        const charIds = [EMP1.characterId, EMP2.characterId, CLIENT.characterId];
        for (const characterId of charIds) {
            const users = await prisma.user.findMany({ where: { characterId } });
            for (const u of users) {
                // Remove any remaining companyEmployee records first
                await prisma.companyEmployee.deleteMany({ where: { userId: u.id } });
                await prisma.user.delete({ where: { id: u.id } });
            }
        }

        console.log('\n[Cleanup] Done.');
    } catch (e) {
        console.warn('[Cleanup] Error (partial cleanup):', e.message);
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    let company;
    try {
        ({ company } = await setup());
        await runTests(company);
    } catch (err) {
        console.error('\n[Fatal] Setup/test error:', err.message);
    } finally {
        if (company) await cleanup(company);
        await prisma.$disconnect();
    }

    // Summary
    const total = results.length;
    const passed = results.filter(r => r.ok).length;
    const failed = total - passed;
    console.log(`\n── Summary: ${passed}/${total} passed, ${failed} failed ──`);

    if (failed > 0) process.exitCode = 1;
}

main();
