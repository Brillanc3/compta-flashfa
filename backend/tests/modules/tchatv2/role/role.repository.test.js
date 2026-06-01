import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req      = createRequire(import.meta.url);
const ROOT      = path.resolve(__dirname, '../../../../src');
const res       = (rel) => _req.resolve(path.join(ROOT, rel));

let mockPrisma;
let mockCache;
let findByGuild;

beforeEach(() => {
    mockPrisma = { v2Role: { findMany: vi.fn() } };
    mockCache  = {
        key: (...p) => p.join(':'),
        getOrCompute: vi.fn((k, ttl, fn) => fn()),
        del: vi.fn(),
    };

    const dbPath    = res('shards/database');
    const cachePath = res('modules/tchatv2/lib/cache');
    const repoPath  = res('modules/tchatv2/role/role.repository');

    _req.cache[dbPath]    = { id: dbPath,    filename: dbPath,    loaded: true, exports: { prisma: mockPrisma } };
    _req.cache[cachePath] = { id: cachePath, filename: cachePath, loaded: true, exports: mockCache };
    delete _req.cache[repoPath];

    ({ findByGuild } = _req(path.join(ROOT, 'modules/tchatv2/role/role.repository')));
});

afterEach(() => {
    ['shards/database', 'modules/tchatv2/lib/cache', 'modules/tchatv2/role/role.repository']
        .forEach(p => delete _req.cache[res(p)]);
});

describe('findByGuild', () => {
    it('trie par position desc et place @everyone en dernier', async () => {
        mockPrisma.v2Role.findMany.mockResolvedValue([
            { id: BigInt('100'), guildId: BigInt('100'), position: 0,  managed: false },
            { id: BigInt('201'), guildId: BigInt('100'), position: 10, managed: true  },
            { id: BigInt('202'), guildId: BigInt('100'), position: 15, managed: false },
            { id: BigInt('203'), guildId: BigInt('100'), position: 12, managed: true  },
        ]);

        const result = await findByGuild('100');
        const ids = result.map(r => String(r.id));
        expect(ids).toEqual(['202', '203', '201', '100']);
    });
});
