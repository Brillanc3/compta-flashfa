import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req      = createRequire(import.meta.url);
const ROOT      = path.resolve(__dirname, '../../../src');
const res       = (rel) => _req.resolve(path.join(ROOT, rel));

const MODULES = ['db', 'middleware/auth', 'modules/pawnshop/pawnshop.service', 'modules/pawnshop/pawnshop.controller'];

let mockPrisma;
let mockService;
let controller;
let clients;

function makeReply() {
    return {
        statusCode: 200,
        body: undefined,
        code(c) { this.statusCode = c; return this; },
        status(c) { this.statusCode = c; return this; },
        send(b) { this.body = b; return this; },
    };
}

const pngFile = () => vi.fn(async () => ({ mimetype: 'image/png', toBuffer: async () => Buffer.from('x') }));

async function submit(body) {
    const reply = makeReply();
    await controller.submitPublicEstimation({ params: { slug: 'shop' }, body }, reply);
    return reply;
}

async function uploadCni(clientId, token, slug = 'shop') {
    const reply = makeReply();
    await controller.uploadPublicClientCni({
        params: { slug, clientId: String(clientId) },
        headers: token ? { 'x-upload-token': token } : {},
        file: pngFile(),
    }, reply);
    return reply;
}

beforeEach(() => {
    clients = [{ id: 1, companyId: 10, name: 'Victime', phoneNumber: '555', iban: 'FR-VICTIME', cni: 'CNI-V', cniImagePublicId: 'img-1' }];
    const configs = {
        shop:  { companyId: 10, isEnabled: true, publicSlug: 'shop' },
        other: { companyId: 11, isEnabled: true, publicSlug: 'other' },
    };

    mockPrisma = {
        pawnshopPublicPageConfig: { findUnique: vi.fn(async ({ where }) => configs[where.publicSlug] || null) },
        companyEmployee: { findFirst: vi.fn(async () => ({ id: 1 })) },
        client: {
            findFirst: vi.fn(async ({ where }) => clients.find(c =>
                c.companyId === where.companyId &&
                (where.id === undefined || c.id === where.id) &&
                (where.phoneNumber === undefined || c.phoneNumber === where.phoneNumber) &&
                (where.name === undefined || c.name === where.name)) || null),
            create: vi.fn(async ({ data }) => { const c = { id: clients.length + 1, ...data }; clients.push(c); return c; }),
            update: vi.fn(async ({ where, data }) => Object.assign(clients.find(c => c.id === where.id), data)),
        },
        pawnshopProduct: { findMany: vi.fn(async () => [{ id: 5, buyPrice: 100 }]) },
        pawnshopEstimation: { create: vi.fn(async () => ({ id: 42 })) },
    };
    mockService = { uploadClientCni: vi.fn(async () => ({ ok: true })) };

    MODULES.forEach(p => delete _req.cache[res(p)]);
    const dbPath = res('db');
    _req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockPrisma };
    const svcPath = res('modules/pawnshop/pawnshop.service');
    _req.cache[svcPath] = { id: svcPath, filename: svcPath, loaded: true, exports: mockService };

    controller = _req(path.join(ROOT, 'modules/pawnshop/pawnshop.controller'));
});

afterEach(() => {
    MODULES.forEach(p => delete _req.cache[res(p)]);
});

const items = [{ productId: 5, quantity: 1 }];

describe('pawnshop public : upload CNI', () => {
    it('refuse un upload sans jeton', async () => {
        const reply = await uploadCni(1, null);
        expect(reply.statusCode).toBe(403);
        expect(mockService.uploadClientCni).not.toHaveBeenCalled();
    });

    it("accepte l'upload d'un nouveau client avec le jeton de sa soumission", async () => {
        const sub = await submit({ firstName: 'Jean', lastName: 'Neuf', phoneNumber: '777', items });
        expect(sub.statusCode).toBe(201);
        const reply = await uploadCni(sub.body.clientId, sub.body.cniUploadToken);
        expect(reply.statusCode).toBe(200);
        expect(mockService.uploadClientCni).toHaveBeenCalledWith(expect.objectContaining({ companyId: 10, clientId: sub.body.clientId }));
    });

    it("refuse le jeton d'un client pour un autre client", async () => {
        const sub = await submit({ firstName: 'Jean', lastName: 'Neuf', phoneNumber: '777', items });
        const reply = await uploadCni(1, sub.body.cniUploadToken);
        expect(reply.statusCode).toBe(403);
    });

    it("refuse le jeton sur la page publique d'une autre société", async () => {
        const sub = await submit({ firstName: 'Jean', lastName: 'Neuf', phoneNumber: '777', items });
        const reply = await uploadCni(sub.body.clientId, sub.body.cniUploadToken, 'other');
        expect(reply.statusCode).toBe(403);
    });

    it("n'écrase pas la CNI d'un client existant retrouvé par téléphone", async () => {
        const sub = await submit({ firstName: 'Pirate', lastName: 'X', phoneNumber: '555', items });
        expect(sub.body.clientId).toBe(1);
        const reply = await uploadCni(1, sub.body.cniUploadToken);
        expect(reply.statusCode).toBe(409);
        expect(mockService.uploadClientCni).not.toHaveBeenCalled();
    });
});

describe('pawnshop public : soumission', () => {
    it("n'écrase pas l'IBAN ni le numéro de CNI d'un client existant", async () => {
        await submit({ firstName: 'Pirate', lastName: 'X', phoneNumber: '555', iban: 'FR-PIRATE', cniNumber: 'CNI-P', items });
        expect(clients[0].iban).toBe('FR-VICTIME');
        expect(clients[0].cni).toBe('CNI-V');
    });

    it("complète l'IBAN d'un client existant qui n'en a pas", async () => {
        clients[0].iban = null;
        await submit({ firstName: 'Jean', lastName: 'X', phoneNumber: '555', iban: 'FR-NEW', items });
        expect(clients[0].iban).toBe('FR-NEW');
    });
});
