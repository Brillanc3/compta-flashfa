// /backend/src/services/handlers/garage.handler.js

"use strict";

const prisma = require("../../db");

/**
 * Ce handler traite les logs FiveM :
 *   - logType = "garage"     → sortie véhicule  (OUT)
 *   - logType = "putInside"  → rangement        (IN)
 */

function supports(logType) {
    return logType === "garage" || logType === "putInside";
}

/**
 * Création du mouvement de garage
 */
async function handle(log) {
    let data;

    try {
        data = JSON.parse(log.data);
    } catch (e) {
        throw new Error("garage.handler: JSON invalide dans log.data");
    }

    const companyId = Number(log.companyId);
    const vehicleId = Number(data.vehicleId);
    const occurredAt = new Date(Number(log.date));

    if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
        throw new Error(`garage.handler: vehicleId invalide (${data.vehicleId})`);
    }

    const isOut = log.logType === "garage";      // sortie
    const isIn  = log.logType === "putInside";   // rangement

    const type = isOut ? "OUT" : "IN";

    // -------------------------------------------------------
    // 1. Lookup utilisateur interne (par characterId / discordId)
    // -------------------------------------------------------
    let foundUser = null;

    if (data.characterId && data.discord) {
        foundUser = await prisma.user.findFirst({
            where: {
                characterId: Number(data.characterId),
                discordId: data.discord,
            },
            select: {
                id: true,
                name: true,
                imageUrl: true,
            },
        });
    }

    // Mise à jour du nom si changé
    if (foundUser && data.properName) {
        const incoming = String(data.properName).trim();
        if (incoming && incoming !== (foundUser.name || '').trim()) {
            try {
                await prisma.user.update({ where: { id: foundUser.id }, data: { name: incoming } });
            } catch (_) {}
        }
    }

    // -------------------------------------------------------
    // 2. Chercher si ce véhicule est enregistré chez nous
    // -------------------------------------------------------
    const vehicleRef = await prisma.vehicle.findUnique({
        where: { vehicleId },
        select: { id: true }
    });

    // -------------------------------------------------------
    // 3. Enregistrer le mouvement
    // -------------------------------------------------------
    await prisma.vehicleMovement.create({
        data: {
            companyId,
            occurredAt,
            vehicleId,
            type,

            // utilisateur résolu ou null
            userId: foundUser?.id ?? null,

            properName: data.properName ?? null,
            markerId: data.markerId ?? null,

            // logId = identifiant du log interne → UNIQUE
            logId: log.id,

            // infos brutes en stockage longtext
            metadata: log.data,

            // lien vers véhicule enregistré
            vehicleRefId: vehicleRef?.id ?? null
        }
    });
}

module.exports = {
    supports,
    handle,
};
