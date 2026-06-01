import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../src');
const res  = (rel) => _req.resolve(path.join(ROOT, rel));

let mockNotif;
let svc;

function loadSvc() {
    const dbPath  = res('shards/database');
    const svcPath = res('modules/tchatv2/notification/userSettings.service');
    _req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { prisma: { v2UserChannelNotification: mockNotif } } };
    delete _req.cache[svcPath];
    return _req(path.join(ROOT, 'modules/tchatv2/notification/userSettings.service'));
}

beforeEach(() => {
    mockNotif = {
        findUnique:  vi.fn(),
        upsert:      vi.fn(),
        updateMany:  vi.fn(),
        findMany:    vi.fn(),
    };
    svc = loadSvc();
});

afterEach(() => {
    ['shards/database', 'modules/tchatv2/notification/userSettings.service']
        .forEach(p => delete _req.cache[res(p)]);
});

describe('userSettings.service', () => {
    it('returns default settings when no row exists', async () => {
        mockNotif.findUnique.mockResolvedValue(null);
        const result = await svc.get(1, '100');
        expect(result).toEqual({ level: 0, mutedUntil: null, isMuted: false });
    });

    it('isMuted=true when mutedUntil in future', async () => {
        const future = new Date(Date.now() + 3600_000);
        mockNotif.findUnique.mockResolvedValue({ level: 2, mutedUntil: future });
        const result = await svc.get(1, '100');
        expect(result.level).toBe(2);
        expect(result.isMuted).toBe(true);
    });

    it('isMuted=false when mutedUntil in past', async () => {
        const past = new Date(Date.now() - 1000);
        mockNotif.findUnique.mockResolvedValue({ level: 1, mutedUntil: past });
        const result = await svc.get(1, '100');
        expect(result.isMuted).toBe(false);
    });

    it('shouldDeliver returns false when level=NONE', async () => {
        mockNotif.findUnique.mockResolvedValue({ level: 3, mutedUntil: null });
        expect(await svc.shouldDeliver(1, '100', { isMention: false })).toBe(false);
        expect(await svc.shouldDeliver(1, '100', { isMention: true })).toBe(false);
    });

    it('shouldDeliver: MENTIONS_ONLY lets through mentions only', async () => {
        mockNotif.findUnique.mockResolvedValue({ level: 2, mutedUntil: null });
        expect(await svc.shouldDeliver(1, '100', { isMention: true })).toBe(true);
        expect(await svc.shouldDeliver(1, '100', { isMention: false })).toBe(false);
    });

    it('shouldDeliver returns false when muted', async () => {
        mockNotif.findUnique.mockResolvedValue({ level: 1, mutedUntil: new Date(Date.now() + 3600_000) });
        expect(await svc.shouldDeliver(1, '100', { isMention: true })).toBe(false);
    });
});
