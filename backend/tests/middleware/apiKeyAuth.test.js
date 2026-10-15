import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req      = createRequire(import.meta.url);
const ROOT      = path.resolve(__dirname, '../../src');
const res       = (rel) => _req.resolve(path.join(ROOT, rel));

const MODULES = ['db', 'lib/moduleUtils', 'middleware/apiKeyAuth', 'modules/api/api.service'];

let mockPrisma;
let rows;
let authenticateApiKey;
let apiService;

function makeReply() {
    return {
        statusCode: 200,
        code(c) { this.statusCode = c; return this; },
        send(b) { this.body = b; return this; },
    };
}

beforeEach(() => {
    rows = [];
    mockPrisma = {
        companyApiKey: {
            create: vi.fn(async ({ data }) => { const r = { id: rows.length + 1, isActive: true, createdAt: new Date(), ...data }; rows.push(r); return r; }),
            findMany: vi.fn(async () => rows),
            findUnique: vi.fn(async ({ where }) => {
                const [field, value] = Object.entries(where)[0];
                return rows.find(r => r[field] === value) || null;
            }),
            update: vi.fn(async () => ({})),
        },
    };

    MODULES.forEach(p => delete _req.cache[res(p)]);
    const dbPath = res('db');
    _req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockPrisma };
    const muPath = res('lib/moduleUtils');
    _req.cache[muPath] = { id: muPath, filename: muPath, loaded: true, exports: { getActiveModulesForCompany: async () => [] } };

    ({ authenticateApiKey } = _req(path.join(ROOT, 'middleware/apiKeyAuth')));
    apiService = _req(path.join(ROOT, 'modules/api/api.service'));
});

afterEach(() => {
    MODULES.forEach(p => delete _req.cache[res(p)]);
});

describe('clés API hashées', () => {
    it('ne stocke jamais la clé en clair', async () => {
        const created = await apiService.create({ companyId: 10, name: 'k', scopes: { actions: ['GET'] } });
        expect(created.key).toMatch(/^[0-9a-f]{64}$/);
        const stored = rows[0];
        expect(stored.key).toBeUndefined();
        expect(stored.keyHash).not.toBe(created.key);
        expect(JSON.stringify(stored)).not.toContain(created.key);
        expect(created.maskedKey.startsWith(created.key.slice(0, 8))).toBe(true);
        expect(created.maskedKey.endsWith(created.key.slice(-4))).toBe(true);
    });

    it('authentifie avec la clé en clair', async () => {
        const created = await apiService.create({ companyId: 10, name: 'k', scopes: { actions: ['GET'] } });
        const request = { method: 'GET', headers: { 'x-api-key': created.key }, query: {}, routeOptions: { url: '/garage/vehicles' } };
        const reply = makeReply();
        await authenticateApiKey(request, reply);
        expect(reply.statusCode).toBe(200);
        expect(request.user).toMatchObject({ isApiKey: true, companyId: 10 });
    });

    it('refuse le hash présenté comme clé', async () => {
        await apiService.create({ companyId: 10, name: 'k', scopes: { actions: ['GET'] } });
        const request = { method: 'GET', headers: { 'x-api-key': rows[0].keyHash }, query: {}, routeOptions: { url: '/garage/vehicles' } };
        const reply = makeReply();
        await authenticateApiKey(request, reply);
        expect(reply.statusCode).toBe(401);
    });

    it('liste les clés avec un affichage masqué', async () => {
        const created = await apiService.create({ companyId: 10, name: 'k', scopes: { actions: ['GET'] } });
        const { data } = await apiService.list({ companyId: 10 });
        expect(data[0].maskedKey).toBe(created.maskedKey);
        expect(data[0]).not.toHaveProperty('keyHash');
    });
});
