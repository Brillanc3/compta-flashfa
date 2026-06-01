'use strict';

const ctxLib = require('./context');

const MAX_LOOP_ITER  = 10000;
const MAX_BLOCK_BUDGET = 50000;

// ── helpers ──────────────────────────────────────────────────────────────────
function field(block, name, def) {
    const v = block && block.fields ? block.fields[name] : undefined;
    return v === undefined ? def : v;
}
function inputBlock(block, name) {
    const inp = block && block.inputs ? block.inputs[name] : undefined;
    if (!inp) return null;
    return inp.block || inp.shadow || null;
}
function nextBlock(block) {
    return block && block.next ? (block.next.block || null) : null;
}

/**
 * Construit l'environnement d'exécution.
 * @param {object} o - { context, memory, effects, log? }
 */
function makeEnv(o) {
    return {
        context: o.context || {},
        memory:  o.memory,
        effects: o.effects || {},
        log:     o.log || (() => {}),
        _budget: { count: 0 },
    };
}

function tick(env) {
    if (++env._budget.count > MAX_BLOCK_BUDGET) {
        throw new Error('[AutomationInterpreter] budget de blocs dépassé');
    }
}

function compare(op, a, b) {
    const na = Number(a), nb = Number(b);
    switch (op) {
        case 'EQ':  return a === b || na === nb;
        case 'NEQ': return !(a === b || na === nb);
        case 'GT':  return na > nb;
        case 'GTE': return na >= nb;
        case 'LT':  return na < nb;
        case 'LTE': return na <= nb;
        default:    return false;
    }
}

// ── table des blocs VALEUR (retournent une valeur JS) ────────────────────────
const VALUES = {
    text:        (b) => field(b, 'TEXT', ''),
    math_number: (b) => Number(field(b, 'NUM', 0)),

    logic_compare: async (b, env) =>
        compare(field(b, 'OP'), await evalValue(inputBlock(b, 'A'), env), await evalValue(inputBlock(b, 'B'), env)),

    logic_operation: async (b, env) => {
        const a = await evalValue(inputBlock(b, 'A'), env);
        if (field(b, 'OP') === 'OR')  return Boolean(a) || Boolean(await evalValue(inputBlock(b, 'B'), env));
        return Boolean(a) && Boolean(await evalValue(inputBlock(b, 'B'), env)); // AND
    },

    logic_negate: async (b, env) => !(await evalValue(inputBlock(b, 'BOOL'), env)),

    memory_get: (b, env) => env.memory.get(field(b, 'VAR')),

    // Inventaire — valeurs
    value_inventory_item:     (b, env) => ctxLib.getItem(env.context).label,
    value_inventory_quantity: (b, env) => ctxLib.getQuantity(env.context),

    // Inventaire — checks (Boolean)
    check_inventory_item_is: (b, env) => {
        const needle = String(field(b, 'ITEM', '')).toLowerCase().trim();
        if (!needle) return false;
        const { code, label } = ctxLib.getItem(env.context);
        return code.toLowerCase().includes(needle) || label.toLowerCase().includes(needle);
    },
    check_inventory_quantity: (b, env) =>
        compare(field(b, 'OPERATOR'), ctxLib.getQuantity(env.context), Number(field(b, 'VALUE', 0))),

    // Rétro-compat blocs inventaire historiques
    check_product_name: (b, env) => {
        const needle = String(field(b, 'PRODUCT', '')).toLowerCase().trim();
        const { code, label } = ctxLib.getItem(env.context);
        return code.toLowerCase() === needle || label.toLowerCase() === needle;
    },
    check_item_list: (b, env) => {
        const needle = String(field(b, 'PRODUCT', '')).toLowerCase().trim();
        const qty = Number(field(b, 'QTY', 1));
        const { code, label } = ctxLib.getItem(env.context);
        const match = code.toLowerCase().includes(needle) || label.toLowerCase().includes(needle);
        return match && ctxLib.getQuantity(env.context) >= qty;
    },
};

async function evalValue(block, env) {
    if (!block) return undefined;
    tick(env);
    const handler = VALUES[block.type];
    if (!handler) { env.log(`bloc valeur non supporté: ${block.type}`); return undefined; }
    return handler(block, env);
}

// ── table des blocs INSTRUCTION ──────────────────────────────────────────────
// Un handler renvoie `false` pour stopper la chaîne courante (garde), sinon `true`/undefined.
const STATEMENTS = {
    // Contrôle
    controls_if_simple: async (b, env) => {
        if (await evalValue(inputBlock(b, 'IF0'), env)) await runStatements(inputBlock(b, 'DO0'), env);
        return true;
    },
    control_if_else: async (b, env) => {
        if (await evalValue(inputBlock(b, 'IF0'), env)) await runStatements(inputBlock(b, 'DO0'), env);
        else await runStatements(inputBlock(b, 'ELSE'), env);
        return true;
    },
    control_repeat: async (b, env) => {
        let times = Number(field(b, 'TIMES', 0));
        if (!Number.isFinite(times) || times < 0) times = 0;
        times = Math.min(times, MAX_LOOP_ITER);
        const body = inputBlock(b, 'DO');
        for (let i = 0; i < times; i++) await runStatements(body, env);
        return true;
    },
    control_while: async (b, env) => {
        const cond = inputBlock(b, 'COND');
        const body = inputBlock(b, 'DO');
        let i = 0;
        while (await evalValue(cond, env)) {
            if (++i > MAX_LOOP_ITER) { env.log('control_while: plafond d\'itérations atteint'); break; }
            await runStatements(body, env);
        }
        return true;
    },
    control_wait: (b, env) => {
        env.log(`control_wait ${field(b, 'MINUTES', 0)} min (no-op)`);
        return true;
    },

    // Mémoire
    memory_set: async (b, env) => { env.memory.set(field(b, 'VAR'), await evalValue(inputBlock(b, 'VALUE'), env)); return true; },
    memory_add: async (b, env) => { env.memory.add(field(b, 'VAR'), await evalValue(inputBlock(b, 'VALUE'), env)); return true; },
    memory_reset_all: (b, env) => { env.memory.clear(); return true; },

    // Actions (effets injectés)
    action_notify_detailed:          (b, env) => env.effects.notify ? env.effects.notify(b, env) : true,
    action_compta_set_expense_status:(b, env) => env.effects.setExpenseStatus ? env.effects.setExpenseStatus(b, env) : true,
    action_tchat_send_message:       (b, env) => env.effects.sendChatMessage ? env.effects.sendChatMessage(b, env) : true,

    // Gardes compta (statement, rétro-compat) — renvoient false pour stopper
    check_compta_amount: (b, env) =>
        compare(field(b, 'OPERATOR'), ctxLib.getAmount(env.context), Number(field(b, 'VALUE', 0))),
    check_compta_expense_report_amount: (b, env) =>
        compare(field(b, 'OPERATOR'), ctxLib.getAmount(env.context), Number(field(b, 'VALUE', 0))),
    check_compta_reason_contains: (b, env) =>
        ctxLib.getReason(env.context).toLowerCase().includes(String(field(b, 'TEXT', '')).toLowerCase()),
};

async function runStatement(block, env) {
    tick(env);
    const handler = STATEMENTS[block.type];
    if (!handler) { env.log(`bloc statement non supporté: ${block.type}`); return true; }
    const res = await handler(block, env);
    return res !== false;
}

async function runStatements(block, env) {
    let current = block;
    while (current) {
        const cont = await runStatement(current, env);
        if (!cont) break;
        current = nextBlock(current);
    }
}

async function runWorkflow(firstBlock, env) {
    if (!firstBlock) return;
    try {
        await runStatements(firstBlock, env);
    } catch (e) {
        env.log(`exécution interrompue: ${e.message}`);
    }
}

module.exports = {
    makeEnv, evalValue, runWorkflow, runStatements, runStatement,
    field, inputBlock, nextBlock, tick, compare,
    MAX_LOOP_ITER, MAX_BLOCK_BUDGET, VALUES, STATEMENTS,
};
