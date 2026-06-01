// modules/ingest/handlers/inventory.handler.js

const prisma = require('../../db');
const { InventoryMovementType } = require('@prisma/client');

function supports(logType) {
    return logType === 'add' || logType === 'remove';
}

async function handle(log) {
    if (!log || !log.data) {
        throw new Error('[InventoryHandler] Log ou log.data manquant.');
    }

    let data;
    try {
        data = JSON.parse(log.data);
    } catch (e) {
        throw new Error('[InventoryHandler] log.data JSON invalide.');
    }

    if (log.category !== 'inventory') return;

    let type = null;
    if (log.logType === 'add') type = InventoryMovementType.ADD;
    else if (log.logType === 'remove') type = InventoryMovementType.REMOVE;
    else return;

    const ts = parseInt(log.date, 10);
    const occurredAt = Number.isFinite(ts)
        ? new Date(ts)
        : log.createdAt ?? new Date();

    const owner = data.owner || "Owner not found";

    const itemCode = data.item || null;
    const quantity = typeof data.count === 'number' ? data.count : 0;
    const metadata = data.metadata || null;

    if (!itemCode) return;

    // -----------------------------------------------------
    // 1. Résolution par characterId + discordId (priorité)
    // -----------------------------------------------------
    let userId = null;
    const properName = data.properName || null;
    const characterId = data.characterId != null ? Number(data.characterId) : null;
    const discordId = data.discord != null ? String(data.discord) : null;
    let foundUser = null;

    if (characterId && discordId) {
        foundUser = await prisma.user.findFirst({
            where: { characterId, discordId },
        });
    }
    if (!foundUser && characterId) {
        foundUser = await prisma.user.findFirst({ where: { characterId } });
    }
    if (!foundUser && discordId) {
        foundUser = await prisma.user.findFirst({ where: { discordId } });
    }
    // Fallback legacy : properName
    if (!foundUser && properName) {
        foundUser = await prisma.user.findFirst({ where: { name: properName } });
    }

    // -----------------------------------------------------
    // 2. Résultat + mise à jour du nom si changé
    // -----------------------------------------------------
    if (foundUser) {
        userId = foundUser.id;
        if (properName && properName !== (foundUser.name || '').trim()) {
            try {
                await prisma.user.update({ where: { id: foundUser.id }, data: { name: properName } });
            } catch (_) {}
        }
    } else {
        console.log(`[InventoryUserLookup] ❌ Aucun user trouvé → properName="${properName}"`);
    }

    // -----------------------------------------------------
    // 🏹 1.5 Tentative via mapping d'emplacement (Inventory)
    // -----------------------------------------------------
    let ownerRefId = null;
    if (owner && prisma.inventory) {
        const mapping = await prisma.inventory.findUnique({
            where: {
                companyId_owner: {
                    companyId: log.companyId,
                    owner: owner
                }
            }
        });
        if (mapping) {
            ownerRefId = mapping.id;
        }
    } else if (owner && !prisma.inventory) {
        console.warn('[InventoryHandler] prisma.inventory est indéfini. Vérifiez la génération du client Prisma.');
    }

    // -----------------------------------------------------
    // 🚀 INSERT ONLY
    // -----------------------------------------------------
    try {
        await prisma.inventoryMovement.create({
            data: {
                companyId: log.companyId,
                logId: log.id,
                owner: owner,
                ownerRefId,
                occurredAt,
                type,
                itemCode,
                itemLabel: metadata?.formatname || null,
                quantity,
                userId,
                properName,
                metadata: metadata ? JSON.stringify(metadata) : null,
            },
        });
    } catch (error) {
        if (error.code === 'P2002' && error.meta?.target?.includes('logId')) {
            console.warn(`[InventoryUserLookup] Log #${log.id} déjà traité → ignoré.\n`);
            return;
        }
        console.error(`[InventoryUserLookup] ❌ ERREUR en créant inventoryMovement :`, error);
        throw error;
    }
}

module.exports = { supports, handle };
