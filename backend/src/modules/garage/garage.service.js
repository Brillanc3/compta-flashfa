// /backend/src/modules/garage/garage.service.js

'use strict';

const prisma = require('../../db');

/* ---------------------------------------------------------
   GET VEHICLES (liste des véhicules enregistrés)
--------------------------------------------------------- */
async function listVehicles(companyId) {
    return prisma.vehicle.findMany({
        where: { companyId },
        orderBy: { updatedAt: "desc" },
        select: {
            id: true,
            vehicleId: true,
            plate: true,
            displayName: true,
            createdAt: true,
            updatedAt: true,
            createdBy: {
                select: { id: true, name: true, imageUrl: true }
            },
            updatedBy: {
                select: { id: true, name: true, imageUrl: true }
            }
        }
    });
}

/* ---------------------------------------------------------
   CREATE VEHICLE
   - Enregistre nom + plaque + vehicleId
   - Relie rétroactivement tous les mouvements
--------------------------------------------------------- */
async function createVehicle(companyId, userId, data) {
    const { vehicleId, plate, displayName } = data;

    const created = await prisma.vehicle.create({
        data: {
            companyId,
            vehicleId,
            plate,
            displayName,
            createdById: userId,
            updatedById: userId
        }
    });

    // Mise à jour rétroactive des mouvements
    await prisma.vehicleMovement.updateMany({
        where: { vehicleId, companyId },
        data: { vehicleRefId: created.id }
    });

    return created;
}

/* ---------------------------------------------------------
   UPDATE VEHICLE
   - Met à jour l'info
   - Met à jour rétroactivement les mouvements
--------------------------------------------------------- */
async function updateVehicle(id, userId, data) {
    const updated = await prisma.vehicle.update({
        where: { id },
        data: {
            plate: data.plate ?? null,
            displayName: data.displayName ?? null,
            updatedById: userId
        }
    });

    // Propagation rétroactive
    await prisma.vehicleMovement.updateMany({
        where: {
            vehicleId: updated.vehicleId,
            companyId: updated.companyId
        },
        data: { vehicleRefId: updated.id }
    });

    return updated;
}

/* ---------------------------------------------------------
   DELETE VEHICLE
   - Supprime l’enregistrement
   - NE supprime PAS les mouvements !
   - Supprime juste le lien vehicleRefId
--------------------------------------------------------- */
async function deleteVehicle(id) {
    const deleted = await prisma.vehicle.delete({ where: { id } });

    // On nettoie les liens
    await prisma.vehicleMovement.updateMany({
        where: { vehicleRefId: id },
        data: { vehicleRefId: null }
    });

    return deleted;
}

/* ---------------------------------------------------------
   LIST VEHICLE MOVEMENTS
   - Entrées / Sorties (OUT/IN)
   - Avec informations user + vehicleRef si existant
--------------------------------------------------------- */
async function listMovements(companyId) {
    return prisma.vehicleMovement.findMany({
        where: { companyId },
        orderBy: { occurredAt: "desc" },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                    characterId: true,
                    discordId: true
                }
            },
            vehicleRef: {
                select: {
                    id: true,
                    displayName: true,
                    plate: true
                }
            }
        }
    });
}

module.exports = {
    listVehicles,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    listMovements
};
