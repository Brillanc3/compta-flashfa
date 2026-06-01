// backend/tests/modules/tchatv2/lib/companyChannels.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../../src');
const res = (rel) => _req.resolve(path.join(ROOT, rel));

let mockPrisma, getCompanyTextChannels;

beforeEach(() => {
  mockPrisma = {
    v2Guild: { findFirst: vi.fn() },
    v2Channel: { findMany: vi.fn() },
  };
  const dbPath = res('shards/database');
  const modPath = res('modules/tchatv2/lib/companyChannels');
  _req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { prisma: mockPrisma } };
  delete _req.cache[modPath];
  ({ getCompanyTextChannels } = _req(path.join(ROOT, 'modules/tchatv2/lib/companyChannels')));
});

describe('getCompanyTextChannels', () => {
  it('renvoie [] si aucun guild lié à la company', async () => {
    mockPrisma.v2Guild.findFirst.mockResolvedValue(null);
    expect(await getCompanyTextChannels(1)).toEqual([]);
  });

  it('renvoie les salons texte (type 0) en {id,name}', async () => {
    mockPrisma.v2Guild.findFirst.mockResolvedValue({ id: 99n });
    mockPrisma.v2Channel.findMany.mockResolvedValue([
      { id: 10n, name: 'général' }, { id: 11n, name: 'logs' },
    ]);
    const out = await getCompanyTextChannels(1);
    expect(out).toEqual([{ id: '10', name: 'général' }, { id: '11', name: 'logs' }]);
    expect(mockPrisma.v2Channel.findMany.mock.calls[0][0].where.type).toBe(0);
  });
});
