import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req      = createRequire(import.meta.url);
const ROOT      = path.resolve(__dirname, '../../../src');
const res       = (rel) => _req.resolve(path.join(ROOT, rel));

const MODULES = ['db', 'middleware/auth', 'modules/chat/chat.service', 'modules/calendar/calendar.service'];

let mockPrisma;
let service;

// Catégorie 1 appartient à l'entreprise 10. Utilisateur 1 : employé actif de l'entreprise 10.
const categories = [{ id: 1, companyId: 10, name: 'A', color: '#000' }];
const employments = [{ id: 1, companyId: 10, userId: 1, status: 'ACTIVE' }];
const actor = { id: 1, permissions: [], roles: [] };
const admin = { id: 99, permissions: [{ action: 'ADMIN.*' }], roles: [] };

beforeEach(() => {
    mockPrisma = {
        eventCategory: {
            findFirst: vi.fn(async ({ where }) => categories.find(c => c.id === where.id && c.companyId === where.companyId) || null),
            create: vi.fn(async ({ data }) => data),
            update: vi.fn(async ({ data }) => data),
            delete: vi.fn(async () => ({})),
        },
        companyEmployee: {
            findFirst: vi.fn(async ({ where }) =>
                employments.find(e => e.companyId === where.companyId && e.userId === where.userId && e.status === where.status) || null),
        },
        calendarEvent: { create: vi.fn(async ({ data }) => data) },
    };

    MODULES.forEach(p => delete _req.cache[res(p)]);
    const dbPath = res('db');
    _req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockPrisma };
    const chatPath = res('modules/chat/chat.service');
    _req.cache[chatPath] = { id: chatPath, filename: chatPath, loaded: true, exports: { _sendSystemMessage: vi.fn() } };

    service = _req(path.join(ROOT, 'modules/calendar/calendar.service'));
});

afterEach(() => {
    MODULES.forEach(p => delete _req.cache[res(p)]);
});

describe('calendar : catégories', () => {
    it("refuse la modification d'une catégorie d'une autre entreprise", async () => {
        await expect(service.updateCategory(11, 1, { name: 'X' })).rejects.toThrow('Catégorie introuvable');
        expect(mockPrisma.eventCategory.update).not.toHaveBeenCalled();
    });

    it("refuse la suppression d'une catégorie d'une autre entreprise", async () => {
        await expect(service.deleteCategory(11, 1)).rejects.toThrow('Catégorie introuvable');
        expect(mockPrisma.eventCategory.delete).not.toHaveBeenCalled();
    });

    it("ne laisse pas déplacer une catégorie vers une autre entreprise", async () => {
        await service.updateCategory(10, 1, { name: 'B', companyId: 11 });
        expect(mockPrisma.eventCategory.update.mock.calls[0][0].data).toEqual({ name: 'B' });
    });

    it("ignore le companyId du body à la création", async () => {
        await service.createCategory(10, { name: 'C', companyId: 11 });
        expect(mockPrisma.eventCategory.create.mock.calls[0][0].data).toEqual({ name: 'C', companyId: 10 });
    });
});

describe('calendar : création d\'événement', () => {
    const base = { title: 'Service', startTime: '2026-01-01T10:00:00Z' };

    it("refuse un événement dans une entreprise dont l'acteur n'est pas membre", async () => {
        await expect(service.createEvent(actor, { ...base, companyId: 11 })).rejects.toThrow("pas membre");
        expect(mockPrisma.calendarEvent.create).not.toHaveBeenCalled();
    });

    it("accepte un événement dans sa propre entreprise", async () => {
        await expect(service.createEvent(actor, { ...base, companyId: 10 })).resolves.toMatchObject({ companyId: 10, userId: 1 });
    });

    it("refuse un événement personnel créé pour un autre utilisateur", async () => {
        await expect(service.createEvent(actor, { ...base, userId: 2 })).rejects.toThrow('autre utilisateur');
    });

    it("laisse un admin créer dans n'importe quelle entreprise", async () => {
        await expect(service.createEvent(admin, { ...base, companyId: 11 })).resolves.toMatchObject({ companyId: 11 });
    });
});
