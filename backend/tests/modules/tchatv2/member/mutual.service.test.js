import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req      = createRequire(import.meta.url);
const ROOT      = path.resolve(__dirname, '../../../../src');
const res       = (rel) => _req.resolve(path.join(ROOT, rel));

let mockPrisma;
let findMutualUsers;
let findManyMock;

beforeEach(() => {
    findManyMock = vi.fn();
    mockPrisma = { v2Member: { findMany: findManyMock } };

    const dbPath  = res('shards/database');
    const svcPath = res('modules/tchatv2/member/mutual.service');

    _req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { prisma: mockPrisma } };
    delete _req.cache[svcPath];

    ({ findMutualUsers } = _req(path.join(ROOT, 'modules/tchatv2/member/mutual.service')));
});

afterEach(() => {
    ['shards/database', 'modules/tchatv2/member/mutual.service']
        .forEach(p => delete _req.cache[res(p)]);
});

describe('findMutualUsers', () => {
    it('returns users sharing >=1 guild, excluding caller and target guild members', async () => {
        findManyMock
            .mockResolvedValueOnce([{ guildId: 10n }, { guildId: 20n }])
            .mockResolvedValueOnce([{ userId: 3n }])
            .mockResolvedValueOnce([
                { userId: 2n, user: { id: 2n, name: 'Alice', avatarHash: 'a' } },
                { userId: 4n, user: { id: 4n, name: 'Bob',   avatarHash: 'b' } },
            ]);

        const out = await findMutualUsers({ callerId: 1, excludeGuildId: 30, q: null, limit: 20 });

        expect(out).toEqual([
            { id: '2', name: 'Alice', avatarHash: 'a' },
            { id: '4', name: 'Bob',   avatarHash: 'b' },
        ]);
    });

    it('applies q filter via prisma where clause (case-insensitive)', async () => {
        findManyMock
            .mockResolvedValueOnce([{ guildId: 10n }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);

        await findMutualUsers({ callerId: 1, excludeGuildId: null, q: 'aL', limit: 20 });

        const candidateCall = findManyMock.mock.calls[1][0];
        expect(candidateCall.where.user.name).toEqual({ contains: 'aL', mode: 'insensitive' });
    });

    it('clamps limit to 1..50', async () => {
        findManyMock
            .mockResolvedValueOnce([{ guildId: 10n }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);

        await findMutualUsers({ callerId: 1, excludeGuildId: null, q: null, limit: 9999 });

        expect(findManyMock.mock.calls[1][0].take).toBe(50);
    });

    it('returns [] when caller has no guilds', async () => {
        findManyMock.mockResolvedValueOnce([]);
        const out = await findMutualUsers({ callerId: 1, excludeGuildId: null, q: null, limit: 20 });
        expect(out).toEqual([]);
        expect(findManyMock).toHaveBeenCalledTimes(1);
    });
});
