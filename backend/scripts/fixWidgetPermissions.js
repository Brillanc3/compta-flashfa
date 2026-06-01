// backend/scripts/fixWidgetPermissions.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPermissions() {
    console.log('Démarrage de la correction des permissions de widgets...');

    // 1. Récupérer toutes les définitions de widgets
    // NOTE: Pour les champs de type Json, on utilise le type par défaut de Prisma.
    const definitions = await prisma.widgetDefinition.findMany();
    let updatedCount = 0;

    for (const def of definitions) {
        let currentPermission = def.requiredPermission;
        let needsUpdate = false;
        let newPermissionArray = [];

        // ----------------------------------------------------
        // LOGIQUE DE DÉTECTION AGRESSIVE
        // ----------------------------------------------------

        // Si la valeur est lue comme une String (le cas de l'erreur C, A, etc.)
        if (typeof currentPermission === 'string') {
            const trimmed = currentPermission.trim();

            if (trimmed.length > 0 && !trimmed.startsWith('[') && !trimmed.startsWith('{') && !trimmed.startsWith('"')) {
                // Si la valeur est une chaîne qui ne commence ni par [, {, ni ", c'est la chaîne littérale (ex: COMPANY.VIEW)
                newPermissionArray = [trimmed];
                needsUpdate = true;

            } else if (trimmed.startsWith('{') || trimmed.startsWith('"')) {
                // Tenter de corriger les anciens formats JSON non-array ({action: '...'} ou "perm")
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) continue; // Déjà bon

                    if (typeof parsed === 'string') {
                        newPermissionArray = [parsed]; // Correction de '"COMPANY.VIEW"' -> ['COMPANY.VIEW']
                        needsUpdate = true;
                    } else if (parsed.action) {
                        newPermissionArray = [parsed.action]; // Correction de {action: '...'} -> ['...']
                        needsUpdate = true;
                    }
                } catch (e) {
                    // Ignorer les erreurs de parsing si le format est déjà JSON mais cassé
                }
            }
        }
        // ----------------------------------------------------

        // 2. Mettre à jour si nécessaire
        if (needsUpdate) {
            await prisma.widgetDefinition.update({
                where: { id: def.id },
                data: {
                    requiredPermission: JSON.stringify(newPermissionArray),
                }
            });
            updatedCount++;
            console.log(`[CORRECTIF] Widget ${def.type} mis à jour : ${JSON.stringify(currentPermission)} -> ${JSON.stringify(newPermissionArray)}`);
        }
    }

    console.log(`Correction des permissions terminée. ${updatedCount} widgets mis à jour.`);
}

fixPermissions()
    .catch((e) => {
        console.error("Échec critique du script de correction:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });