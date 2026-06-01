// /backend/src/modules/status/status.service.js

const prisma = require('../../db');

/**
 * Récupère la liste de tous les modules enregistrés dans la base de données.
 * @returns {Promise<Array<{name: string, status: string}>>} Une liste des modules et leur statut.
 */
async function getSystemStatus() {
    // On récupère les modules qui ont été synchronisés au démarrage du serveur.
    const modulesInDb = await prisma.module.findMany({
        select: {
            name: true
        },
        orderBy: {
            name: 'asc'
        }
    });

    // Pour chaque module, on assigne un statut par défaut.
    // Ce système pourra être enrichi plus tard si besoin.
    const statusReport = modulesInDb.map(module => ({
        name: module.name,
        status: 'operational', // Statut par défaut : Opérationnel
    }));

    return statusReport;
}

module.exports = {
    getSystemStatus,
};