// backend/tests/modules/automation/effects.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../src');
const res = (rel) => _req.resolve(path.join(ROOT, rel));

let mockPrisma, mockNotif, mockSystem, effects;
const { createMemory } = _req(path.join(ROOT, 'modules/automation/lib/memory'));
const { makeEnv } = _req(path.join(ROOT, 'modules/automation/lib/interpreter'));

beforeEach(() => {
  mockPrisma = { user: { findMany: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]) } };
  mockNotif = { createNotification: vi.fn().mockResolvedValue({}) };
  mockSystem = { sendSystemMessage: vi.fn().mockResolvedValue({}) };

  const dbPath = res('db');
  const notifPath = res('services/notificationService');
  const sysPath = res('modules/tchatv2/message/system.service');
  const effPath = res('modules/automation/lib/effects');

  _req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockPrisma };
  _req.cache[notifPath] = { id: notifPath, filename: notifPath, loaded: true, exports: mockNotif };
  _req.cache[sysPath] = { id: sysPath, filename: sysPath, loaded: true, exports: mockSystem };
  delete _req.cache[effPath];
  effects = _req(path.join(ROOT, 'modules/automation/lib/effects'));
});

describe('effects.sendChatMessage', () => {
  it('interpole {item},{quantity},{owner} et envoie au salon choisi', async () => {
    const env = makeEnv({
      context: { companyId: 5, data: { item: 'water', count: 4, owner: 'stash_1', metadata: { formatname: 'Eau' } } },
      memory: createMemory({ seuil: 10 }), effects: {},
    });
    const block = { type: 'action_tchat_send_message',
      fields: { CHANNEL: '10', MESSAGE: '{quantity}x {item} pour {owner} (seuil {memory.seuil})' } };
    await effects.sendChatMessage(block, env);
    expect(mockSystem.sendSystemMessage).toHaveBeenCalledWith({
      channelId: '10', content: '4x Eau pour stash_1 (seuil 10)',
    });
  });

  it('ignore l\'envoi si CHANNEL vide ou placeholder', async () => {
    const env = makeEnv({ context: { companyId: 5, data: {} }, memory: createMemory(), effects: {} });
    await effects.sendChatMessage({ type: 'action_tchat_send_message', fields: { CHANNEL: '0', MESSAGE: 'x' } }, env);
    expect(mockSystem.sendSystemMessage).not.toHaveBeenCalled();
  });
});

describe('effects.notify', () => {
  it('cible ALL => tous les users de la company', async () => {
    const env = makeEnv({ context: { companyId: 5, data: { amount: 50, reason: 'Loyer' } }, memory: createMemory(), effects: {} });
    const block = { type: 'action_notify_detailed',
      fields: { TARGET_TYPE: 'ALL', TARGET_ID: '', TITLE: 'Alerte', BODY: 'Montant {amount} ({reason})' } };
    await effects.notify(block, env);
    const arg = mockNotif.createNotification.mock.calls[0][0];
    expect(arg.recipientUserIds).toEqual([1, 2]);
    expect(arg.content.body).toBe('Montant 50.00 (Loyer)');
  });
});
