// backend/tests/modules/automation/templates.test.js
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../src');

const registry = _req(path.join(ROOT, 'modules/automation/automationRegistry'));
const interpreter = _req(path.join(ROOT, 'modules/automation/lib/interpreter'));
const { createMemory } = _req(path.join(ROOT, 'modules/automation/lib/memory'));

let templates;
beforeAll(async () => {
  await registry.scan();
  templates = registry.getTemplates();
});

// Contexte permissif : satisfait la plupart des conditions (grosse quantité/montant).
function permissiveEnv(effects) {
  return interpreter.makeEnv({
    context: {
      companyId: 1,
      data: { item: 'boeuf', count: 999, owner: 'stash_1', amount: 999999, reason: 'test', id: 1 },
    },
    memory: createMemory(),
    effects,
  });
}

function recordingEffects() {
  return {
    notify: vi.fn().mockResolvedValue(true),
    sendChatMessage: vi.fn().mockResolvedValue(true),
    setExpenseStatus: vi.fn().mockResolvedValue(true),
  };
}

describe('catalogue de modèles', () => {
  it('le registry agrège des modèles', () => {
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThanOrEqual(9);
  });

  it('chaque modèle a les métadonnées requises et un bloc trigger event_*', () => {
    for (const t of templates) {
      expect(typeof t.id).toBe('string');
      expect(typeof t.name).toBe('string');
      expect(typeof t.category).toBe('string');
      const top = t.state?.blocks?.blocks?.[0];
      expect(top, `template ${t.id} top block`).toBeTruthy();
      expect(top.type.startsWith('event_'), `template ${t.id} trigger`).toBe(true);
    }
  });

  it('les ids sont uniques', () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque state est sérialisable en JSON (pas de cycle)', () => {
    for (const t of templates) {
      expect(() => JSON.stringify(t.state)).not.toThrow();
    }
  });

  it('chaque modèle s\'exécute dans l\'interpréteur sans erreur (champs/blocs valides)', async () => {
    for (const t of templates) {
      const effects = recordingEffects();
      const env = permissiveEnv(effects);
      const firstBody = t.state.blocks.blocks[0].next?.block;
      await expect(interpreter.runWorkflow(firstBody, env), `template ${t.id}`).resolves.toBeUndefined();
    }
  });

  it('un modèle sans condition envoie bien son action (journal des entrées)', async () => {
    const entryLog = templates.find((t) => t.id === 'inv_entry_log');
    expect(entryLog).toBeTruthy();
    const effects = recordingEffects();
    const env = permissiveEnv(effects);
    await interpreter.runWorkflow(entryLog.state.blocks.blocks[0].next.block, env);
    expect(effects.sendChatMessage).toHaveBeenCalled();
  });

  it('le modèle filtre-item (boeuf) déclenche sur l\'item correspondant', async () => {
    const tpl = templates.find((t) => t.id === 'inv_item_filter_example');
    expect(tpl).toBeTruthy();
    const effects = recordingEffects();
    const env = permissiveEnv(effects); // data.item = 'boeuf'
    await interpreter.runWorkflow(tpl.state.blocks.blocks[0].next.block, env);
    expect(effects.sendChatMessage).toHaveBeenCalled();
  });
});
