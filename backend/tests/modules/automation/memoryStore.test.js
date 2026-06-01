// backend/tests/modules/automation/memoryStore.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../src');
const res = (rel) => _req.resolve(path.join(ROOT, rel));

let mockPrisma, store;

beforeEach(() => {
  mockPrisma = {
    companySettings: {
      findUnique: vi.fn().mockResolvedValue({ settings: { automation_memory: { wf1: { stock: 3 } } } }),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
  const dbPath = res('db');
  const modPath = res('modules/automation/lib/memoryStore');
  _req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockPrisma };
  delete _req.cache[modPath];
  store = _req(path.join(ROOT, 'modules/automation/lib/memoryStore'));
});

describe('memoryStore', () => {
  it('load lit la mémoire du workflow', async () => {
    const mem = await store.load(5, 'wf1');
    expect(mem.get('stock')).toBe(3);
    expect(mem.dirty).toBe(false);
  });

  it('load renvoie une mémoire vide si absente', async () => {
    mockPrisma.companySettings.findUnique.mockResolvedValue({ settings: {} });
    const mem = await store.load(5, 'inconnu');
    expect(mem.toObject()).toEqual({});
  });

  it('save fusionne sans écraser les autres workflows', async () => {
    const mem = await store.load(5, 'wf1');
    mem.set('stock', 99);
    await store.save(5, 'wf1', mem);
    const upsertArg = mockPrisma.companySettings.upsert.mock.calls[0][0];
    expect(upsertArg.update.settings.automation_memory.wf1).toEqual({ stock: 99 });
  });

  it('withCompanyLock sérialise les exécutions concurrentes', async () => {
    const order = [];
    const slow = (id, ms) => store.withCompanyLock(5, async () => {
      order.push(`start-${id}`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`end-${id}`);
    });
    await Promise.all([slow('A', 30), slow('B', 1)]);
    expect(order).toEqual(['start-A', 'end-A', 'start-B', 'end-B']);
  });
});
