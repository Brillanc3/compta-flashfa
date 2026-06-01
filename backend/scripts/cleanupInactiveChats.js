// backend/scripts/cleanupInactiveChats.js

const { PrismaClient } = require('@prisma/client');
const { subDays } = require('date-fns');

const prisma = new PrismaClient();

async function main() {
    console.log('--- Lancement du script de nettoyage des conversations inactives ---');

    // 1. Définir la date limite : tout ce qui n'a pas été mis à jour avant cette date sera supprimé.
    const sevenDaysAgo = subDays(new Date(), 7);
    console.log(`Date limite : les conversations non mises à jour depuis le ${sevenDaysAgo.toISOString()} seront supprimées.`);

    // 2. Trouver les conversations inactives à supprimer.
    // On ne supprime pas les tickets, qui peuvent avoir besoin d'être archivés différemment.
    const conversationsToDelete = await prisma.conversation.findMany({
        where: {
            updatedAt: {
                lt: sevenDaysAgo, // 'lt' = less than (inférieur à)
            },
            // On s'assure de ne pas supprimer les tickets ouverts ou en cours
            NOT: {
                type: 'TICKET',
                status: {
                    in: ['OPEN', 'IN_PROGRESS'],
                },
            },
        },
        select: {
            id: true,
        },
    });

    if (conversationsToDelete.length === 0) {
        console.log('Aucune conversation inactive à supprimer. Terminé.');
        return;
    }

    const idsToDelete = conversationsToDelete.map(c => c.id);
    console.log(`Trouvé ${idsToDelete.length} conversations à supprimer :`, idsToDelete);

    // 3. Supprimer les conversations (et les messages associés grâce à `onDelete: Cascade`)
    const deleteResult = await prisma.conversation.deleteMany({
        where: {
            id: {
                in: idsToDelete,
            },
        },
    });

    console.log(`Suppression terminée. ${deleteResult.count} conversations ont été effacées.`);
    console.log('--- Script de nettoyage terminé ---');
}

main()
    .catch((e) => {
        console.error('Une erreur est survenue durant le script de nettoyage :', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });