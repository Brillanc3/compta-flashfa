// backend/tests/modules/automation/interpreter.statement.test.js
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../src');
const { runWorkflow, makeEnv } = _req(path.join(ROOT, 'modules/automation/lib/interpreter'));
const { createMemory } = _req(path.join(ROOT, 'modules/automation/lib/memory'));

function chain(blocks) {
  for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = { block: blocks[i + 1] };
  return blocks[0];
}
function num(n) { return { type: 'math_number', fields: { NUM: n } }; }
function setMem(varName, valueBlock) {
  return { type: 'memory_set', fields: { VAR: varName }, inputs: { VALUE: { block: valueBlock } } };
}

describe('runStatements — flux de contrôle', () => {
  it('exécute une chaîne séquentielle d\'actions', async () => {
    const calls = [];
    const env = makeEnv({ memory: createMemory(), effects: {
      notify: (b) => { calls.push(b.fields.TITLE); },
    }});
    const a = { type: 'action_notify_detailed', fields: { TITLE: 'A', BODY: '', TARGET_TYPE: 'USER', TARGET_ID: '1' } };
    const b = { type: 'action_notify_detailed', fields: { TITLE: 'B', BODY: '', TARGET_TYPE: 'USER', TARGET_ID: '1' } };
    await runWorkflow(chain([a, b]), env);
    expect(calls).toEqual(['A', 'B']);
  });

  it('controls_if_simple n\'exécute DO0 que si IF0 vrai', async () => {
    const env = makeEnv({ memory: createMemory(), effects: {} });
    const ifTrue = {
      type: 'controls_if_simple',
      inputs: {
        IF0: { block: { type: 'text', fields: { TEXT: 'x' } } },
        DO0: { block: setMem('hit', num(1)) },
      },
    };
    await runWorkflow(ifTrue, env);
    expect(env.memory.get('hit')).toBe(1);

    const env2 = makeEnv({ memory: createMemory(), effects: {} });
    const ifFalse = {
      type: 'controls_if_simple',
      inputs: { IF0: { block: { type: 'math_number', fields: { NUM: 0 } } }, DO0: { block: setMem('hit', num(1)) } },
    };
    await runWorkflow(ifFalse, env2);
    expect(env2.memory.get('hit')).toBeUndefined();
  });

  it('control_if_else choisit la bonne branche', async () => {
    const env = makeEnv({ memory: createMemory(), effects: {} });
    const blk = {
      type: 'control_if_else',
      inputs: {
        IF0:  { block: { type: 'math_number', fields: { NUM: 0 } } },
        DO0:  { block: setMem('branch', { type: 'text', fields: { TEXT: 'then' } }) },
        ELSE: { block: setMem('branch', { type: 'text', fields: { TEXT: 'else' } }) },
      },
    };
    await runWorkflow(blk, env);
    expect(env.memory.get('branch')).toBe('else');
  });

  it('control_repeat répète N fois (accumulation mémoire)', async () => {
    const env = makeEnv({ memory: createMemory(), effects: {} });
    const blk = {
      type: 'control_repeat',
      fields: { TIMES: 3 },
      inputs: { DO: { block: { type: 'memory_add', fields: { VAR: 'c' }, inputs: { VALUE: { block: num(2) } } } } },
    };
    await runWorkflow(blk, env);
    expect(env.memory.get('c')).toBe(6);
  });

  it('control_while boucle tant que la condition tient (avec garde mémoire)', async () => {
    const env = makeEnv({ memory: createMemory({ c: 0 }), effects: {} });
    const blk = {
      type: 'control_while',
      inputs: {
        COND: { block: { type: 'logic_compare', fields: { OP: 'LT' },
          inputs: { A: { block: { type: 'memory_get', fields: { VAR: 'c' } } }, B: { block: num(3) } } } },
        DO:   { block: { type: 'memory_add', fields: { VAR: 'c' }, inputs: { VALUE: { block: num(1) } } } },
      },
    };
    await runWorkflow(blk, env);
    expect(env.memory.get('c')).toBe(3);
  });

  it('garde compta : check_compta_amount false stoppe la chaîne', async () => {
    const calls = [];
    const env = makeEnv({ context: { data: { amount: 10 } }, memory: createMemory(), effects: {
      notify: (b) => calls.push(b.fields.TITLE),
    }});
    const check = { type: 'check_compta_amount', fields: { OPERATOR: 'GT', VALUE: 100 } };
    const act = { type: 'action_notify_detailed', fields: { TITLE: 'X', BODY: '', TARGET_TYPE: 'USER', TARGET_ID: '1' } };
    await runWorkflow(chain([check, act]), env);
    expect(calls).toEqual([]);
  });

  it('control_while respecte le plafond d\'itérations (pas de boucle infinie)', async () => {
    const env = makeEnv({ memory: createMemory(), effects: {} });
    const blk = {
      type: 'control_while',
      inputs: {
        COND: { block: { type: 'text', fields: { TEXT: 'toujours' } } },
        DO:   { block: { type: 'control_wait', fields: { MINUTES: 0 } } },
      },
    };
    await expect(runWorkflow(blk, env)).resolves.toBeUndefined();
  });
});
