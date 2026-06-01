// backend/src/modules/automation/lib/blockBuilders.js
//
// Fabriques de blocs Blockly au format `Blockly.serialization` ({ type, fields, inputs, next }).
// Servent à composer les modèles ("templates") de workflows prêts à l'emploi.
// DRY : un seul jeu de fabriques partagé par tous les fichiers *.templates.js.
'use strict';

// ── Valeurs ──────────────────────────────────────────────────────────────────
const num     = (n) => ({ type: 'math_number', fields: { NUM: n } });
const text    = (t) => ({ type: 'text', fields: { TEXT: t } });
const memGet  = (v) => ({ type: 'memory_get', fields: { VAR: v } });
const cmp     = (op, a, b) => ({ type: 'logic_compare', fields: { OP: op }, inputs: { A: { block: a }, B: { block: b } } });
const valItem = () => ({ type: 'value_inventory_item' });
const valQty  = () => ({ type: 'value_inventory_quantity' });

// ── Checks ───────────────────────────────────────────────────────────────────
// Inventaire (blocs valeur Boolean, à brancher dans un IF)
const checkQty    = (op, val) => ({ type: 'check_inventory_quantity', fields: { OPERATOR: op, VALUE: val } });
const checkItemIs = (item)    => ({ type: 'check_inventory_item_is', fields: { ITEM: item } });
// Compta (gardes statement : false stoppe la chaîne)
const checkAmount = (op, val) => ({ type: 'check_compta_amount', fields: { OPERATOR: op, VALUE: val } });
const checkReason = (txt)     => ({ type: 'check_compta_reason_contains', fields: { TEXT: txt } });

// ── Mémoire ──────────────────────────────────────────────────────────────────
const memSet   = (v, valueBlock) => ({ type: 'memory_set', fields: { VAR: v }, inputs: { VALUE: { block: valueBlock } } });
const memAdd   = (v, valueBlock) => ({ type: 'memory_add', fields: { VAR: v }, inputs: { VALUE: { block: valueBlock } } });
const memReset = () => ({ type: 'memory_reset_all' });

// ── Actions ──────────────────────────────────────────────────────────────────
// CHANNEL reste à '0' : l'utilisateur choisit le salon dans le dropdown après chargement.
const tchat  = (message) => ({ type: 'action_tchat_send_message', fields: { CHANNEL: '0', MESSAGE: message } });
const notify = (title, body, target = 'ALL', targetId = '') =>
    ({ type: 'action_notify_detailed', fields: { TARGET_TYPE: target, TARGET_ID: targetId, TITLE: title, BODY: body } });
const setExpense = (status) => ({ type: 'action_compta_set_expense_status', fields: { STATUS: status } });

// ── Contrôle ─────────────────────────────────────────────────────────────────
const ifSimple = (cond, doBlock)       => ({ type: 'controls_if_simple', inputs: { IF0: { block: cond }, DO0: { block: doBlock } } });
const ifElse   = (cond, doBlock, elseBlock) =>
    ({ type: 'control_if_else', inputs: { IF0: { block: cond }, DO0: { block: doBlock }, ELSE: { block: elseBlock } } });

// ── Assemblage ───────────────────────────────────────────────────────────────
// Relie une liste de blocs via `next.block` (chaîne d'instructions).
const chain = (...blocks) => {
    const list = blocks.filter(Boolean);
    for (let i = 0; i < list.length - 1; i++) list[i].next = { block: list[i + 1] };
    return list[0];
};

/**
 * Construit l'état complet d'un workspace Blockly :
 * bloc trigger en tête, corps branché sur `next`.
 * Format consommable par `Blockly.serialization.workspaces.load`.
 */
const workflow = (triggerType, firstBody) => ({
    blocks: {
        languageVersion: 0,
        blocks: [
            { type: triggerType, x: 40, y: 40, next: firstBody ? { block: firstBody } : undefined },
        ],
    },
});

module.exports = {
    num, text, memGet, cmp, valItem, valQty,
    checkQty, checkItemIs, checkAmount, checkReason,
    memSet, memAdd, memReset,
    tchat, notify, setExpense,
    ifSimple, ifElse,
    chain, workflow,
};
