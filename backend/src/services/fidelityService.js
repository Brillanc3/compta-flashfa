// backend/src/services/fidelityService.js
const prisma = require('../db');
const crypto = require('crypto');



/**
 * Crée ou réinitialise la carte de fidélité pour un client.
 * @param {number} companyId - L'ID de l'entreprise.
 * @param {number} clientId - L'ID du client.
 */
async function createOrResetFidelityCard(companyId, clientId) {
    return prisma.$transaction(async (tx) => {
        // 1. Récupérer le template de carte actif pour l'entreprise
        const template = await tx.fidelityCardTemplate.findFirst({
            where: { companyId: companyId, isActive: true },
            include: { stampZones: true },
        });

        if (!template || template.stampZones.length === 0) {
            throw new Error("Aucun modèle de carte de fidélité avec des zones de tampon n'est configuré pour cette entreprise.");
        }
        const requiredStamps = template.stampZones.length;

        // 2. Vérifier si une carte existe déjà pour ce client
        const existingCard = await tx.fidelityCard.findUnique({
            where: { clientId: clientId },
        });

        // 3. Appliquer la logique de réinitialisation si une carte existe
        if (existingCard) {
            if (existingCard.stampCount < requiredStamps) {
                throw new Error(`La carte n'est pas encore pleine (${existingCard.stampCount}/${requiredStamps}). La réinitialisation est impossible.`);
            }
            // Si la carte est pleine, on la supprime pour en créer une nouvelle
            await tx.fidelityCard.delete({ where: { clientId: clientId } });
        }

        // 4. Créer la nouvelle carte
        const newCard = await tx.fidelityCard.create({
            data: {
                clientId: clientId,
                publicLink: crypto.randomBytes(6).toString('hex'),
                stampCount: 0,
            },
        });

        return newCard;
    });
}

module.exports = {
    createOrResetFidelityCard,
};