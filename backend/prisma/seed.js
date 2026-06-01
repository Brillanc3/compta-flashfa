// backend/prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Fonction pour nettoyer les chaînes JSON doublement échappées du dump SQL
function cleanJsonString(jsonString) {
    if (!jsonString || jsonString === 'null') return null;
    try {
        // La chaîne est souvent de la forme '"{\\"key\\":\\"value\\"}"'
        // On la parse une première fois pour enlever les guillemets externes et les échappements de premier niveau
        let cleaned = JSON.parse(jsonString);
        // Si le résultat est toujours une chaîne (ce qui est probable), on la parse à nouveau
        if (typeof cleaned === 'string') {
            cleaned = JSON.parse(cleaned);
        }
        // On la re-stringify pour un stockage propre
        return JSON.stringify(cleaned);
    } catch (e) {
        console.error("Impossible de parser la chaîne JSON:", jsonString, e);
        return jsonString; // Retourne la chaîne originale en cas d'erreur
    }
}


const CATEGORY_LABELS = {
    CHIFFRE_AFFAIRES: "Chiffre d'affaires",
    AUTRES_ENTREES: "Autres entrées",
    DONS_RECUS: "Dons reçus",
    DECORATION: "Décoration",
    SUBVENTIONS_RECUES: "Subventions reçues",
    SALAIRES: "Salaires (Transactions Manuelles)",
    MATIERES_PREMIERES: "Matières premières",
    AVOCATS: "Frais d'Avocats",
    FRAIS_COMPTABLE: "Frais Comptables",
    LOCATIONS: "Locations",
    FRAIS_VEHICULES: "Frais véhicules",
    NOURRITURE: "Nourriture",
    DONS_EFFECTUES: "Dons effectués",
    LOCATIONS_NON_DEDUC: "Locations non déductibles",
    CHARGES_VEHICULES_NON_DEDUC: "Charges véhicules non déductibles",
    AUTRES_NON_DEDUC: "Autres non déductibles",
};

// Définition du type pour chaque catégorie
const CATEGORY_TYPES = {
    CHIFFRE_AFFAIRES: 'REVENUE',
    AUTRES_ENTREES: 'REVENUE',
    DONS_RECUS: 'REVENUE',
    DECORATION: 'REVENUE',
    SUBVENTIONS_RECUES: 'REVENUE',
    SALAIRES: 'EXPENSE',
    MATIERES_PREMIERES: 'EXPENSE',
    AVOCATS: 'EXPENSE',
    FRAIS_COMPTABLE: 'EXPENSE',
    LOCATIONS: 'EXPENSE',
    FRAIS_VEHICULES: 'EXPENSE',
    NOURRITURE: 'EXPENSE',
    DONS_EFFECTUES: 'EXPENSE',
    LOCATIONS_NON_DEDUC: 'EXPENSE',
    CHARGES_VEHICULES_NON_DEDUC: 'EXPENSE',
    AUTRES_NON_DEDUC: 'EXPENSE',
};

// Catégories non déductibles
const NON_DEDUCTIBLE = [
    'LOCATIONS_NON_DEDUC',
    'CHARGES_VEHICULES_NON_DEDUC',
    'AUTRES_NON_DEDUC',
];

async function main() {
    console.log('🌱 Seeding transaction categories...');

    for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
        const type = CATEGORY_TYPES[key] || 'EXPENSE';
        const isDeductible = !NON_DEDUCTIBLE.includes(key);

        await prisma.transactionCategory.upsert({
            where: { name: key },
            update: {},
            create: {
                name: key,
                type,
                isDefault: true,
                isDeductible,
            },
        });

        console.log(`✅ ${label} (${key}) ajouté (${type}, ${isDeductible ? 'Déductible' : 'Non déductible'})`);
    }

    console.log('🌱 Seeding demo data...');

    const demoUsername = 'demo';
    const demoPassword = 'demo';
    const hashedDemoPassword = await bcrypt.hash(demoPassword, 10);

    const demoUser = await prisma.user.upsert({
        where: { username: demoUsername },
        update: {},
        create: {
            username: demoUsername,
            name: 'Utilisateur Démo',
            password: hashedDemoPassword,
        }
    });

    const demoCompany = await prisma.company.upsert({
        where: { id: 9999 },
        update: {
            isApiActive: true,
        },
        create: {
            id: 9999,
            name: 'Demo Corp',
            balance: 50000,
            isApiActive: true,
        }
    });

    // Create a Rank for the demo company
    const demoRank = await prisma.rank.upsert({
        where: { companyId_name: { companyId: demoCompany.id, name: 'Gérant' } },
        update: {},
        create: {
            name: 'Gérant',
            position: 1,
            companyId: demoCompany.id,
        }
    });

    // Link demo user to demo company with the rank
    await prisma.companyEmployee.upsert({
        where: { companyId_userId: { companyId: demoCompany.id, userId: demoUser.id } },
        update: {
            rankId: demoRank.id,
            status: 'ACTIVE',
        },
        create: {
            companyId: demoCompany.id,
            userId: demoUser.id,
            rankId: demoRank.id,
            status: 'ACTIVE',
        }
    });

    // Activate all modules for the demo company
    const allModules = await prisma.module.findMany();
    for (const module of allModules) {
        await prisma.companyModule.upsert({
            where: { companyId_moduleId: { companyId: demoCompany.id, moduleId: module.id } },
            update: {},
            create: {
                companyId: demoCompany.id,
                moduleId: module.id,
            }
        });
    }
    console.log(`✅ ${allModules.length} modules activés pour Demo Corp.`);

    // Add some random transactions if none exist for this company
    const transactionCount = await prisma.transaction.count({ where: { companyId: demoCompany.id } });
    if (transactionCount === 0) {
        // Fetch categories to get IDs
        const allCategories = await prisma.transactionCategory.findMany();
        const categoryMap = allCategories.reduce((acc, cat) => {
            acc[cat.name] = cat.id;
            return acc;
        }, {});

        for (let i = 0; i < 15; i++) {
            const type = i % 2 === 0 ? 'REVENUE' : 'EXPENSE';
            const categories = Object.keys(CATEGORY_LABELS);
            const categoryName = categories[Math.floor(Math.random() * categories.length)];
            const categoryId = categoryMap[categoryName];

            if (categoryId) {
                await prisma.transaction.create({
                    data: {
                        amount: Math.floor(Math.random() * 1000) + 50,
                        date: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
                        description: `Transaction démo #${i + 1}`,
                        companyId: demoCompany.id,
                        categoryId: categoryId,
                    }
                });
            }
        }
        console.log('✅ 15 transactions démo ajoutées.');
    } else {
        console.log('ℹ️ Des transactions démo existent déjà.');
    }

    console.log('✅ Seeding terminé.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });