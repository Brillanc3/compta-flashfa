import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req      = createRequire(import.meta.url);
const ROOT      = path.resolve(__dirname, '../../../../src');
const res       = (rel) => _req.resolve(path.join(ROOT, rel));

let mockPrisma;
let createGuild;

beforeEach(() => {
    mockPrisma = {
        v2Guild:   { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
        v2Role:    { create: vi.fn() },
        v2Member:  { create: vi.fn() },
        v2Channel: { create: vi.fn() },
        rank:      { findMany: vi.fn() },
        $transaction: vi.fn((ops) => Promise.all(ops)),
    };

    const dbPath    = res('shards/database');
    const snowPath  = res('modules/tchatv2/lib/snowflake');
    const cachePath = res('modules/tchatv2/lib/cache');
    const svcPath   = res('modules/tchatv2/guild/guild.service');

    _req.cache[dbPath]    = { id: dbPath,    filename: dbPath,    loaded: true, exports: { prisma: mockPrisma } };
    _req.cache[snowPath]  = { id: snowPath,  filename: snowPath,  loaded: true, exports: { nextV2: vi.fn().mockReturnValue(BigInt('123456789')) } };
    _req.cache[cachePath] = { id: cachePath, filename: cachePath, loaded: true, exports: { delPattern: vi.fn(), key: (...a) => a.join(':') } };
    delete _req.cache[svcPath];

    ({ createGuild } = _req(path.join(ROOT, 'modules/tchatv2/guild/guild.service')));
});

afterEach(() => {
    ['shards/database', 'modules/tchatv2/lib/snowflake', 'modules/tchatv2/lib/cache', 'modules/tchatv2/guild/guild.service']
        .forEach(p => delete _req.cache[res(p)]);
});

describe('createGuild', () => {
    it('rejette si la company a déjà une guild', async () => {
        mockPrisma.v2Guild.findFirst.mockResolvedValue({ id: BigInt('999') });
        await expect(
            createGuild(1, { name: 'Ma Guild', companyId: 42 })
        ).rejects.toMatchObject({ status: 409 });
    });

    it('crée une guild sans companyId sans vérification company', async () => {
        mockPrisma.v2Guild.findUnique.mockResolvedValue({ id: BigInt('123456789'), name: 'Ma Guild' });
        mockPrisma.rank.findMany.mockResolvedValue([]);
        await expect(createGuild(1, { name: 'Ma Guild' })).resolves.toBeDefined();
    });

    it('sync les Rank de la company comme managed V2Roles', async () => {
        mockPrisma.v2Guild.findFirst.mockResolvedValue(null);
        mockPrisma.v2Guild.findUnique.mockResolvedValue({ id: BigInt('123456789'), name: 'Test' });
        mockPrisma.rank.findMany.mockResolvedValue([
            { id: 1, name: 'Gérant',  position: 10 },
            { id: 2, name: 'Employé', position: 5  },
        ]);
        await createGuild(1, { name: 'Test', companyId: 42 });
        // @everyone (dans transaction) + 2 company ranks (après transaction) = 3 creates
        expect(mockPrisma.v2Role.create).toHaveBeenCalledTimes(3);
        const calls   = mockPrisma.v2Role.create.mock.calls.map(c => c[0].data);
        const managed = calls.filter(d => d.managed === true);
        expect(managed).toHaveLength(2);
        expect(managed[0]).toMatchObject({ companyRankId: 1, name: 'Gérant' });
    });
});

describe('syncManagedRoles', () => {
    let syncManagedRoles;
    let mockPrismaLocal;

    beforeEach(() => {
        mockPrismaLocal = {
            v2Member:     { findUnique: vi.fn() },
            v2Role:       { findMany: vi.fn() },
            v2MemberRole: { deleteMany: vi.fn(), create: vi.fn() },
            companyEmployee: { findFirst: vi.fn() },
        };

        const _req2 = createRequire(import.meta.url);
        const ROOT2 = path.resolve(__dirname, '../../../../src');
        const res2  = (rel) => _req2.resolve(path.join(ROOT2, rel));

        const dbPath        = res2('shards/database');
        const snowPath      = res2('modules/tchatv2/lib/snowflake');
        const cachePath     = res2('modules/tchatv2/lib/cache');
        const memberSvcPath = res2('modules/tchatv2/member/member.service');
        const svcPath       = res2('modules/tchatv2/guild/guild.service');

        _req2.cache[dbPath]         = { id: dbPath,        filename: dbPath,        loaded: true, exports: { prisma: mockPrismaLocal } };
        _req2.cache[snowPath]       = { id: snowPath,       filename: snowPath,       loaded: true, exports: { nextV2: vi.fn().mockReturnValue(BigInt('1')) } };
        _req2.cache[cachePath]      = { id: cachePath,      filename: cachePath,      loaded: true, exports: { del: vi.fn(), delPattern: vi.fn(), key: (...a) => a.join(':') } };
        _req2.cache[memberSvcPath]  = { id: memberSvcPath,  filename: memberSvcPath,  loaded: true, exports: { recomputeMemberPermissions: vi.fn().mockResolvedValue() } };
        delete _req2.cache[svcPath];

        ({ syncManagedRoles } = _req2(path.join(ROOT2, 'modules/tchatv2/guild/guild.service')));
    });

    it('ne fait rien si le member est absent de la guilde', async () => {
        mockPrismaLocal.v2Member.findUnique.mockResolvedValue(null);
        await syncManagedRoles(BigInt('1'), 42, 1);
        expect(mockPrismaLocal.v2MemberRole.deleteMany).not.toHaveBeenCalled();
    });

    it('retire les anciens rôles managed et assigne le nouveau rang', async () => {
        mockPrismaLocal.v2Member.findUnique.mockResolvedValue({ id: BigInt('10') });
        mockPrismaLocal.v2Role.findMany.mockResolvedValue([
            { id: BigInt('100'), companyRankId: 5 },
            { id: BigInt('101'), companyRankId: 6 },
        ]);
        mockPrismaLocal.companyEmployee.findFirst.mockResolvedValue({ rankId: 6 });
        mockPrismaLocal.v2MemberRole.deleteMany.mockResolvedValue({ count: 1 });
        mockPrismaLocal.v2MemberRole.create.mockResolvedValue({});

        await syncManagedRoles(BigInt('1'), 42, 1);

        expect(mockPrismaLocal.v2MemberRole.deleteMany).toHaveBeenCalledWith({
            where: { memberId: BigInt('10'), roleId: { in: [BigInt('100'), BigInt('101')] } },
        });
        expect(mockPrismaLocal.v2MemberRole.create).toHaveBeenCalledWith({
            data: { memberId: BigInt('10'), roleId: BigInt('101') },
        });
    });

    it('ne crée pas de rôle si l\'employé n\'a pas de rang actif', async () => {
        mockPrismaLocal.v2Member.findUnique.mockResolvedValue({ id: BigInt('10') });
        mockPrismaLocal.v2Role.findMany.mockResolvedValue([{ id: BigInt('100'), companyRankId: 5 }]);
        mockPrismaLocal.companyEmployee.findFirst.mockResolvedValue(null);
        mockPrismaLocal.v2MemberRole.deleteMany.mockResolvedValue({ count: 0 });

        await syncManagedRoles(BigInt('1'), 42, 1);

        expect(mockPrismaLocal.v2MemberRole.create).not.toHaveBeenCalled();
    });
});
