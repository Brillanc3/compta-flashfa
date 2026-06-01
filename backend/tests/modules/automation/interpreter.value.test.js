// backend/tests/modules/automation/interpreter.value.test.js
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../src');
const { evalValue, makeEnv } = _req(path.join(ROOT, 'modules/automation/lib/interpreter'));
const { createMemory } = _req(path.join(ROOT, 'modules/automation/lib/memory'));

function env(context = {}, memInit = {}) {
  return makeEnv({ context, memory: createMemory(memInit), effects: {} });
}

describe('evalValue — blocs standard', () => {
  it('text et math_number', async () => {
    expect(await evalValue({ type: 'text', fields: { TEXT: 'hi' } }, env())).toBe('hi');
    expect(await evalValue({ type: 'math_number', fields: { NUM: 12 } }, env())).toBe(12);
  });

  it('logic_compare GT/EQ', async () => {
    const gt = {
      type: 'logic_compare',
      fields: { OP: 'GT' },
      inputs: { A: { block: { type: 'math_number', fields: { NUM: 5 } } },
                B: { block: { type: 'math_number', fields: { NUM: 3 } } } },
    };
    expect(await evalValue(gt, env())).toBe(true);
  });

  it('logic_operation AND, logic_negate', async () => {
    const T = { type: 'text', fields: { TEXT: 'x' } }; // truthy
    const and = { type: 'logic_operation', fields: { OP: 'AND' },
      inputs: { A: { block: T }, B: { block: T } } };
    expect(await evalValue(and, env())).toBe(true);
    const neg = { type: 'logic_negate', inputs: { BOOL: { block: and } } };
    expect(await evalValue(neg, env())).toBe(false);
  });

  it('memory_get lit la mémoire', async () => {
    const e = env({}, { stock: 9 });
    expect(await evalValue({ type: 'memory_get', fields: { VAR: 'stock' } }, e)).toBe(9);
  });

  it('bloc inconnu => undefined (non bloquant)', async () => {
    expect(await evalValue({ type: 'inexistant' }, env())).toBeUndefined();
  });
});

describe('evalValue — blocs inventaire', () => {
  const invCtx = { data: { item: 'water', count: 4, metadata: { formatname: 'Eau' } } };

  it('value_inventory_item / value_inventory_quantity', async () => {
    const e = env(invCtx);
    expect(await evalValue({ type: 'value_inventory_item' }, e)).toBe('Eau');
    expect(await evalValue({ type: 'value_inventory_quantity' }, e)).toBe(4);
  });

  it('check_inventory_item_is (partiel, insensible casse, code ou libellé)', async () => {
    const e = env(invCtx);
    expect(await evalValue({ type: 'check_inventory_item_is', fields: { ITEM: 'eau' } }, e)).toBe(true);
    expect(await evalValue({ type: 'check_inventory_item_is', fields: { ITEM: 'wat' } }, e)).toBe(true);
    expect(await evalValue({ type: 'check_inventory_item_is', fields: { ITEM: 'pain' } }, e)).toBe(false);
  });

  it('check_inventory_quantity avec opérateur', async () => {
    const e = env(invCtx);
    const blk = (op, v) => ({ type: 'check_inventory_quantity', fields: { OPERATOR: op, VALUE: v } });
    expect(await evalValue(blk('GTE', 4), e)).toBe(true);
    expect(await evalValue(blk('LT', 4), e)).toBe(false);
  });

  it('check_product_name compare code/libellé', async () => {
    const e = env(invCtx);
    expect(await evalValue({ type: 'check_product_name', fields: { PRODUCT: 'water' } }, e)).toBe(true);
  });
});
