import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req      = createRequire(import.meta.url);
const ROOT      = path.resolve(__dirname, '../../../../src');
const res       = (rel) => _req.resolve(path.join(ROOT, rel));

let mockRepo;
let mockCache;
let deleteRole;
let updateRole;
let reorderRoles;

beforeEach(() => {
    mockRepo = {
        findById:              vi.fn(),
        getMaxPositionForUser: vi.fn(),
        remove:                vi.fn(),
        findByGuild:           vi.fn(),
        create:                vi.fn(),
        update:                vi.fn(),
        batchUpdatePositions:  vi.fn(),
    };
    mockCache = { invalidateRole: vi.fn(), invalidateGuild: vi.fn() };

    const repoPath  = res('modules/tchatv2/role/role.repository');
    const cachePath = res('modules/tchatv2/permissions/permission.cache');
    const svcPath   = res('modules/tchatv2/role/role.service');

    _req.cache[repoPath]  = { id: repoPath,  filename: repoPath,  loaded: true, exports: mockRepo  };
    _req.cache[cachePath] = { id: cachePath, filename: cachePath, loaded: true, exports: mockCache };
    delete _req.cache[svcPath];

    ({ deleteRole, updateRole, reorderRoles } = _req(path.join(ROOT, 'modules/tchatv2/role/role.service')));
});

afterEach(() => {
    ['modules/tchatv2/role/role.repository', 'modules/tchatv2/permissions/permission.cache', 'modules/tchatv2/role/role.service']
        .forEach(p => delete _req.cache[res(p)]);
});

describe('updateRole — verrou @everyone', () => {
    it('rejette une modif d\'affichage sur @everyone (id === guildId)', async () => {
        mockRepo.findById.mockResolvedValue({
            id: BigInt('100'), guildId: BigInt('100'), position: 0, managed: false,
        });
        await expect(updateRole('100', '100', '1', { name: 'staff' }))
            .rejects.toMatchObject({ status: 400 });
        expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('autorise une modif de permissions sur @everyone', async () => {
        mockRepo.findById.mockResolvedValue({
            id: BigInt('100'), guildId: BigInt('100'), position: 0, managed: false,
        });
        mockRepo.getMaxPositionForUser.mockResolvedValue(Number.MAX_SAFE_INTEGER);
        mockRepo.update.mockResolvedValue({ id: BigInt('100'), permissions: 8n });
        await expect(updateRole('100', '100', '1', { permissions: '8' }))
            .resolves.toMatchObject({ id: BigInt('100') });
        expect(mockRepo.update).toHaveBeenCalled();
    });
});

describe('reorderRoles — protège @everyone', () => {
    it('filtre l\'entrée ciblant @everyone avant batchUpdatePositions', async () => {
        mockRepo.batchUpdatePositions.mockResolvedValue();
        await reorderRoles('100', [
            { id: '202', position: 5 },
            { id: '100', position: 9 },
        ]);
        expect(mockRepo.batchUpdatePositions).toHaveBeenCalledWith([
            { id: '202', position: 5 },
        ]);
    });
});

describe('deleteRole', () => {
    it('bloque la suppression si managed = true', async () => {
        mockRepo.findById.mockResolvedValue({
            id: BigInt('555'), guildId: BigInt('100'), position: 5, managed: true,
        });
        await expect(deleteRole('100', '555', '1')).rejects.toMatchObject({ status: 400 });
        expect(mockRepo.remove).not.toHaveBeenCalled();
    });

    it('autorise la suppression si managed = false', async () => {
        mockRepo.findById.mockResolvedValue({
            id: BigInt('555'), guildId: BigInt('100'), position: 5, managed: false,
        });
        mockRepo.getMaxPositionForUser.mockResolvedValue(10);
        mockRepo.remove.mockResolvedValue({});
        await expect(deleteRole('100', '555', '1')).resolves.toBeUndefined();
        expect(mockRepo.remove).toHaveBeenCalledWith('555');
    });
});
