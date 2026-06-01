// /backend/src/lib/moduleUtils.js

const prisma = require('../db');
const moduleRegistry = require('./moduleRegistry');

/**
 * Récupère la liste complète des modules actifs pour une entreprise,
 * en combinant ceux en base de données et les modules par défaut du registre.
 * 
 * @param {number} companyId - ID de l'entreprise.
 * @returns {Promise<Array>} - Tableau d'objets { module: { id, name, description } }
 */
async function getActiveModulesForCompany(companyId) {
    const cid = Number(companyId);
    if (!cid) return [];

    // 1) Modules activés explicitement en base de données
    const dbModules = await prisma.companyModule.findMany({
        where: { companyId: cid },
        include: { module: { select: { id: true, name: true, description: true } } },
    });

    // 2) Modules par défaut définis dans le registre (en code)
    const defaultModuleNames = moduleRegistry.getAllDefault();

    const existingNames = new Set(dbModules.map(dm => dm.module.name.toLowerCase()));
    const missingDefaults = defaultModuleNames.filter(name => !existingNames.has(name.toLowerCase()));

    if (missingDefaults.length > 0) {
        // On récupère les IDs et métadonnées de la table Module pour les modules manquants
        const extraModules = await prisma.module.findMany({
            where: { name: { in: missingDefaults } },
            select: { id: true, name: true, description: true }
        });

        for (const m of extraModules) {
            dbModules.push({ module: m });
        }
    }

    return dbModules;
}

module.exports = {
    getActiveModulesForCompany,
};
