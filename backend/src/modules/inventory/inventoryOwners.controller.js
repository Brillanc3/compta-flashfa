'use strict';

const prisma = require('../../db');

/**
 * Liste toutes les correspondances d'inventaire pour une entreprise.
 */
async function getOwners(request, reply) {
    const companyId = parseInt(request.headers['x-company-id'], 10);
    
    try {
        const inventories = await prisma.inventory.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
            include: {
                createdBy: { select: { id: true, name: true, imageUrl: true } },
                updatedBy: { select: { id: true, name: true, imageUrl: true } }
            }
        });
        return reply.send({ inventories });
    } catch (error) {
        console.error('[InventoryOwners] Error fetching inventories:', error);
        return reply.code(500).send({ message: "Erreur lors de la récupération des inventaires." });
    }
}

/**
 * Crée ou met à jour une correspondance (owner -> name).
 * Effectue également un lien rétroactif sur les mouvements existants.
 */
async function upsertOwner(request, reply) {
    const companyId = parseInt(request.headers['x-company-id'], 10);
    const userId = request.user.userId;
    const { owner, name } = request.body;

    if (!owner || !name) {
        return reply.code(400).send({ message: "Le code emplacement (owner) et le nom sont requis." });
    }

    try {
        const inventory = await prisma.inventory.upsert({
            where: {
                companyId_owner: { companyId, owner }
            },
            update: {
                name,
                updatedById: userId
            },
            create: {
                companyId,
                owner,
                name,
                createdById: userId,
                updatedById: userId
            }
        });

        // Propagation rétroactive sur les mouvements qui n'ont pas encore de lien
        await prisma.inventoryMovement.updateMany({
            where: { 
                companyId, 
                owner, 
                OR: [
                    { ownerRefId: null },
                    { ownerRefId: { not: inventory.id } } // Si on a changé de mapping (rare mais possible)
                ]
            },
            data: { ownerRefId: inventory.id }
        });

        return reply.send(inventory);
    } catch (error) {
        console.error('[InventoryOwners] Error upserting inventory:', error);
        return reply.code(500).send({ message: "Erreur lors de l'enregistrement de l'inventaire." });
    }
}

/**
 * Supprime une correspondance.
 * Les mouvements liés perdent leur référence mais conservent leur champ 'owner' brut.
 */
async function deleteOwner(request, reply) {
    const id = parseInt(request.params.id, 10);

    try {
        // Nettoyage des références
        await prisma.inventoryMovement.updateMany({
            where: { ownerRefId: id },
            data: { ownerRefId: null }
        });

        await prisma.inventory.delete({
            where: { id }
        });

        return reply.send({ success: true });
    } catch (error) {
        console.error('[InventoryOwners] Error deleting inventory:', error);
        return reply.code(500).send({ message: "Erreur lors de la suppression de l'inventaire." });
    }
}

module.exports = {
    getOwners,
    upsertOwner,
    deleteOwner
};
