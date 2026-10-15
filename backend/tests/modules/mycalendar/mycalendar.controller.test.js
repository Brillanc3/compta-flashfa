import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req      = createRequire(import.meta.url);
const ROOT      = path.resolve(__dirname, '../../../src');
const res       = (rel) => _req.resolve(path.join(ROOT, rel));

const MODULES = ['db', 'middleware/auth', 'modules/mycalendar/mycalendar.service', 'modules/mycalendar/mycalendar.controller'];

let mockPrisma;
let controller;

// Utilisateur 1 : employé actif de l'entreprise 10 uniquement. Utilisateur 99 : admin plateforme.
const users = {
    1:  { id: 1,  permissions: [], roles: [] },
    2:  { id: 2,  permissions: [], roles: [] },
    99: { id: 99, permissions: [{ action: 'ADMIN.*' }], roles: [] },
};
const employments = [{ id: 1, companyId: 10, userId: 1, status: 'ACTIVE' }];

function makeReply() {
    return {
        statusCode: 200,
        body: undefined,
        status(c) { this.statusCode = c; return this; },
        code(c) { this.statusCode = c; return this; },
        send(b) { this.body = b; return this; },
    };
}

function makeRequest({ userId, companyId, params = {}, body = {}, isApiKey = false }) {
    return {
        user: isApiKey ? { userId: null, isApiKey: true, companyId: 10 } : { userId },
        headers: companyId !== undefined ? { 'x-company-id': String(companyId) } : {},
        params,
        body,
    };
}

beforeEach(() => {
    mockPrisma = {
        user: { findUnique: vi.fn(async ({ where }) => users[where.id] || null) },
        companyEmployee: {
            findFirst: vi.fn(async ({ where }) =>
                employments.find(e => e.companyId === where.companyId && e.userId === where.userId && e.status === where.status) || null),
        },
        myCalendarEvent: {
            findMany: vi.fn(async () => []),
            findUnique: vi.fn(),
            create: vi.fn(async ({ data }) => ({ id: 1, ...data })),
            update: vi.fn(async ({ data }) => data),
            delete: vi.fn(async () => ({})),
        },
        myCalendarGuest: { create: vi.fn(), delete: vi.fn() },
        myCalendarCategory: { findMany: vi.fn(async () => []), findUnique: vi.fn(), delete: vi.fn(async () => ({})) },
    };

    MODULES.forEach(p => delete _req.cache[res(p)]);
    const dbPath = res('db');
    _req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockPrisma };
    const sharpPath = _req.resolve('sharp');
    _req.cache[sharpPath] = { id: sharpPath, filename: sharpPath, loaded: true, exports: vi.fn(() => ({ webp: () => ({ toFile: async () => {} }) })) };

    controller = _req(path.join(ROOT, 'modules/mycalendar/mycalendar.controller'));
});

afterEach(() => {
    MODULES.forEach(p => delete _req.cache[res(p)]);
    delete _req.cache[_req.resolve('sharp')];
});

describe('mycalendar : en-tête x-company-id', () => {
    it("refuse l'accès aux événements d'une entreprise dont l'utilisateur n'est pas membre", async () => {
        const reply = makeReply();
        await controller.getEvents(makeRequest({ userId: 2, companyId: 10 }), reply);
        expect(reply.statusCode).toBe(403);
        expect(mockPrisma.myCalendarEvent.findMany).not.toHaveBeenCalled();
    });

    it("accepte l'en-tête pour un employé actif", async () => {
        const reply = makeReply();
        await controller.getEvents(makeRequest({ userId: 1, companyId: 10 }), reply);
        expect(reply.statusCode).toBe(200);
        const where = mockPrisma.myCalendarEvent.findMany.mock.calls[0][0].where;
        expect(where.OR).toContainEqual({ companyId: 10 });
    });

    it("refuse la création d'un événement dans une autre entreprise", async () => {
        const reply = makeReply();
        await controller.createEvent(makeRequest({ userId: 1, companyId: 11, body: { title: 'x' } }), reply);
        expect(reply.statusCode).toBe(403);
        expect(mockPrisma.myCalendarEvent.create).not.toHaveBeenCalled();
    });

    it('refuse les clés API', async () => {
        const reply = makeReply();
        await controller.getEvents(makeRequest({ isApiKey: true, companyId: 10 }), reply);
        expect(reply.statusCode).toBe(403);
    });
});

describe('mycalendar : droits sur les événements', () => {
    it("refuse la suppression d'un événement d'une autre entreprise", async () => {
        mockPrisma.myCalendarEvent.findUnique.mockResolvedValue({ id: 5, authorId: 3, companyId: 11, guests: [] });
        const reply = makeReply();
        await controller.deleteEvent(makeRequest({ userId: 1, companyId: 10, params: { id: '5' } }), reply);
        expect(reply.statusCode).toBe(400);
        expect(mockPrisma.myCalendarEvent.delete).not.toHaveBeenCalled();
    });

    it("refuse la modification de l'événement personnel d'un autre utilisateur sans entreprise", async () => {
        mockPrisma.myCalendarEvent.findUnique.mockResolvedValue({ id: 5, authorId: 3, companyId: null });
        const reply = makeReply();
        await controller.updateEvent(makeRequest({ userId: 2, params: { id: '5' }, body: { title: 'pirate' } }), reply);
        expect(reply.statusCode).toBe(400);
        expect(mockPrisma.myCalendarEvent.update).not.toHaveBeenCalled();
    });

    it('autorise un admin plateforme (ADMIN.*) à modifier un événement prédéfini', async () => {
        mockPrisma.myCalendarEvent.findUnique.mockResolvedValue({ id: 5, authorId: 3, companyId: null, isPredefined: true });
        const reply = makeReply();
        await controller.updateEvent(makeRequest({ userId: 99, params: { id: '5' }, body: { title: 'ok' } }), reply);
        expect(reply.statusCode).toBe(200);
        expect(mockPrisma.myCalendarEvent.update).toHaveBeenCalled();
    });

    it('ignore isPredefined pour un non-admin', async () => {
        const reply = makeReply();
        await controller.createEvent(makeRequest({ userId: 1, body: { title: 'x', isPredefined: true } }), reply);
        expect(reply.statusCode).toBe(201);
        expect(mockPrisma.myCalendarEvent.create.mock.calls[0][0].data.isPredefined).toBe(false);
    });

    it("refuse le changement d'image d'un événement dont on n'est pas l'auteur", async () => {
        mockPrisma.myCalendarEvent.findUnique.mockResolvedValue({ id: 5, authorId: 3, companyId: null });
        const req = makeRequest({ userId: 2, params: { id: '5' } });
        req.file = vi.fn(async () => ({ toBuffer: async () => Buffer.from('') }));
        const reply = makeReply();
        await controller.uploadImage(req, reply);
        expect(reply.statusCode).toBe(400);
        expect(mockPrisma.myCalendarEvent.update).not.toHaveBeenCalled();
    });
});

describe('mycalendar : catégories', () => {
    it("refuse la suppression de la catégorie personnelle d'un autre utilisateur", async () => {
        mockPrisma.myCalendarCategory.findUnique.mockResolvedValue({ id: 7, userId: 3, companyId: null });
        const reply = makeReply();
        await controller.deleteCategory(makeRequest({ userId: 2, params: { id: '7' } }), reply);
        expect(reply.statusCode).toBe(400);
        expect(mockPrisma.myCalendarCategory.delete).not.toHaveBeenCalled();
    });
});
