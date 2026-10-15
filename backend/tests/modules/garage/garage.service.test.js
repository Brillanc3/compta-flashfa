import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _req      = createRequire(import.meta.url);
const ROOT      = path.resolve(__dirname, '../../../src');
const res       = (rel) => _req.resolve(path.join(ROOT, rel));

let mockPrisma;
let service;

// Véhicule 1 appartient à l'entreprise 10.
const vehicles = [{ id: 1, companyId: 10, vehicleId: 'abc' }];

beforeEach(() => {
    mockPrisma = {
        vehicle: {
            findFirst: vi.fn(async ({ where }) => vehicles.find(v => v.id === where.id && v.companyId === where.companyId) || null),
            update: vi.fn(async ({ where, data }) => ({ ...vehicles.find(v => v.id === where.id), ...data })),
            delete: vi.fn(async ({ where }) => vehicles.find(v => v.id === where.id)),
        },
        vehicleMovement: { updateMany: vi.fn(async () => ({ count: 0 })) },
    };

    const dbPath = res('db');
    _req.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockPrisma };
    delete _req.cache[res('modules/garage/garage.service')];
    service = _req(path.join(ROOT, 'modules/garage/garage.service'));
});

afterEach(() => {
    ['db', 'modules/garage/garage.service'].forEach(p => delete _req.cache[res(p)]);
});

describe('garage : isolation par entreprise', () => {
    it("refuse la modification d'un véhicule d'une autre entreprise", async () => {
        await expect(service.updateVehicle(11, 1, 5, { plate: 'X' })).rejects.toThrow('Véhicule introuvable');
        expect(mockPrisma.vehicle.update).not.toHaveBeenCalled();
    });

    it("refuse la suppression d'un véhicule d'une autre entreprise", async () => {
        await expect(service.deleteVehicle(11, 1)).rejects.toThrow('Véhicule introuvable');
        expect(mockPrisma.vehicle.delete).not.toHaveBeenCalled();
    });

    it("modifie et supprime un véhicule de sa propre entreprise", async () => {
        await expect(service.updateVehicle(10, 1, 5, { plate: 'X' })).resolves.toMatchObject({ plate: 'X' });
        await expect(service.deleteVehicle(10, 1)).resolves.toMatchObject({ id: 1 });
    });
});
