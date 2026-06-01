// backend/tests/modules/automation/integration.workflow.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../src');
const res = (rel) => _req.resolve(path.join(ROOT, rel));

// Workflow simulé tel que sérialisé par Blockly :
// event_inventory_entry -> control_if_else( quantity < 5 ) -> action_tchat_send_message
function buildWorkflow() {
  return {
    id: 'wf-stock',
    name: 'Alerte stock',
    active: true,
    trigger: 'INVENTORY_ENTRY', // ancien format MAJUSCULE => doit matcher via normalize
    json: {
      blocks: {
        blocks: [
          {
            type: 'event_inventory_entry',
            next: {
              block: {
                type: 'control_if_else',
                inputs: {
                  IF0: {
                    block: {
                      type: 'check_inventory_quantity',
                      fields: { OPERATOR: 'LT', VALUE: 5 },
                    },
                  },
                  DO0: {
                    block: {
                      type: 'action_tchat_send_message',
                      fields: { CHANNEL: '10', MESSAGE: 'Stock bas: {quantity}x {item}' },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    },
  };
}

let mockPrisma, mockSystem, engine;

beforeEach(() => {
  vi.useFakeTimers();
  mockPrisma = {
    companyModule: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
    companySettings: {
      findUnique: vi.fn().mockResolvedValue({ settings: { automation_workflows: [buildWorkflow()] } }),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
  mockSystem = { sendSystemMessage: vi.fn().mockResolvedValue({}) };

  const dbPath = res('db');
  const sysPath = res('modules/tchatv2/message/system.service');
  _req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockPrisma };
  _req.cache[sysPath] = { id: sysPath, filename: sysPath, loaded: true, exports: mockSystem };

  // recharge la chaîne automation pour qu'elle prenne les mocks
  for (const rel of [
    'modules/automation/lib/effects',
    'modules/automation/lib/memoryStore',
    'modules/automation/lib/automationEngine',
  ]) delete _req.cache[res(rel)];

  engine = _req(path.join(ROOT, 'modules/automation/lib/automationEngine'));
});

describe('parcours inventaire → tchat', () => {
  it('envoie un message quand la quantité passe sous le seuil', async () => {
    await engine.trigger({
      companyId: 5, category: 'inventory', logType: 'add',
      data: JSON.stringify({ item: 'water', count: 3, metadata: { formatname: 'Eau' } }),
    });
    expect(mockSystem.sendSystemMessage).toHaveBeenCalledWith({
      channelId: '10', content: 'Stock bas: 3x Eau',
    });
  });

  it('n\'envoie rien quand la quantité est au-dessus du seuil', async () => {
    await engine.trigger({
      companyId: 5, category: 'inventory', logType: 'add',
      data: JSON.stringify({ item: 'water', count: 12, metadata: { formatname: 'Eau' } }),
    });
    expect(mockSystem.sendSystemMessage).not.toHaveBeenCalled();
  });
});
