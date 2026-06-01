// backend/src/services/adminCompanyService.js
const prisma = require('../db');
const crypto = require('crypto');
const { addDays } = require('date-fns');
const adminAnalyticsService = require('./adminAnalyticsService');


/**
 * Récupère toutes les entreprises avec le nombre d'employés et de contacts facturables.
 */
async function getAllCompanies() {
    return prisma.company.findMany({
        include: {
            _count: {
                select: { employees: true, billableContacts: true },
            },
        },
        orderBy: { name: 'asc' },
    });
}

/**
 * Récupère les détails d'une entreprise, y compris ses contacts facturables et modules.
 * @param {number} companyId
 */
async function getCompanyById(companyId) {
    return prisma.company.findUnique({
        where: { id: companyId },
        include: {
            billableContacts: {
                include: {
                    user: {
                        select: { id: true, name: true, username: true },
                    },
                },
            },
            activeModules: {
                include: {
                    module: true,
                },
            },
        },
    });
}

/**
 * Met en attente les modifications d'une entreprise et identifie le gérant principal.
 * @param {number} companyId
 * @param {object} data - { name, accountingPrice, moduleIds }
 */
async function updateCompany(companyId, data) {
    const { name, accountingPrice, moduleIds } = data;

    const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: { activeModules: true },
    });

    if (!company) {
        throw new Error("Entreprise non trouvée.");
    }

    // --- Calcul du delta pour les modules ---
    const currentModuleIds = new Set(company.activeModules.map(m => m.moduleId));
    const requestedModuleIds = new Set(moduleIds || []);

    const modulesToAdd = [...requestedModuleIds].filter(id => !currentModuleIds.has(id));
    const modulesToRemove = [...currentModuleIds].filter(id => !requestedModuleIds.has(id));

    // --- Construction de l'objet de changements en attente ---
    const pendingChanges = {
        name: name !== company.name ? name : undefined,
        accountingPrice: accountingPrice !== company.accountingPrice ? accountingPrice : undefined,
        modules: {
            add: modulesToAdd.length > 0 ? modulesToAdd : undefined,
            remove: modulesToRemove.length > 0 ? modulesToRemove : undefined,
        },
    };
    // Nettoyage des clés undefined
    Object.keys(pendingChanges).forEach(key => pendingChanges[key] === undefined && delete pendingChanges[key]);
    if (pendingChanges.modules) {
        Object.keys(pendingChanges.modules).forEach(key => pendingChanges.modules[key] === undefined && delete pendingChanges.modules[key]);
        if (Object.keys(pendingChanges.modules).length === 0) delete pendingChanges.modules;
    }


    if (Object.keys(pendingChanges).length === 0) {
        throw new Error("Aucun changement détecté.");
    }

    const deadline = addDays(new Date(), 7);

    const updatedCompany = await prisma.company.update({
        where: { id: companyId },
        data: {
            pendingChanges,
            pendingChangesDeadline: deadline,
        },
    });

    // --- Identification du gérant principal ---
    const permissionString = `COMPANY.${companyId}.*`;
    const manager = await prisma.user.findFirst({
        where: {
            OR: [
                { permissions: { some: { action: permissionString } } },
                { roles: { some: { permissions: { some: { action: permissionString } } } } }
            ]
        },
        select: { id: true, name: true }
    });

    if (!manager) {
        // Annuler les changements si aucun gérant n'est trouvé
        await prisma.company.update({
            where: { id: companyId },
            data: { pendingChanges: null, pendingChangesDeadline: null }
        });
        throw new Error("Impossible de trouver un gérant principal pour cette entreprise.");
    }

    return { updatedCompany, manager, pendingChanges };
}

/**
 * Ajoute un utilisateur à la liste des contacts facturables d'une entreprise.
 * Déclenche la vérification du profil et la suspension si nécessaire.
 * @param {number} companyId
 * @param {number} userId
 */
async function addBillableContact(companyId, userId) {
    return prisma.$transaction(async (tx) => {
        // 1. Vérifier que l'utilisateur est bien un employé de l'entreprise
        const employee = await tx.companyEmployee.findUnique({
            where: { companyId_userId: { companyId, userId } },
        });
        if (!employee) {
            throw new Error("Cet utilisateur n'est pas un employé de l'entreprise.");
        }

        // 2. Ajouter le contact facturable
        await tx.billableContact.create({
            data: { companyId, userId },
        });

        // 3. Vérifier le profil de l'utilisateur
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user.discordId || !user.characterId) {
            // Si le profil est incomplet, suspendre le compte
            await tx.user.update({
                where: { id: userId },
                data: { status: 'SUSPENDED' },
            });
        }
        return { success: true };
    });
}

/**
 * Supprime un contact facturable.
 * @param {number} companyId
 * @param {number} userId
 */
async function removeBillableContact(companyId, userId) {
    // On ne peut pas supprimer le "leader" (celui qui a la permission COMPANY.*)
    const userPermissions = await prisma.permission.findMany({
        where: { users: { some: { id: userId } } },
        select: { action: true },
    });

    const isLeader = userPermissions.some(p => p.action === `COMPANY.${companyId}.*`);
    if (isLeader) {
        throw new Error("Impossible de supprimer le leader de la liste des contacts facturables.");
    }

    await prisma.billableContact.delete({
        where: { userId_companyId: { userId, companyId } },
    });
    return { success: true };
}

/**
 * Crée une nouvelle entreprise.
 * @param {object} data - { name }
 */
async function createCompany(data) {
    const { name } = data;
    if (!name) {
        throw new Error("Le nom de l'entreprise est requis.");
    }
    // Génération de clés uniques pour l'onboarding et l'API
    const onboardingKey = `onboarding-${crypto.randomBytes(16).toString('hex')}`;
    const apiKey = crypto.randomBytes(32).toString('hex');

    return prisma.company.create({
        data: {
            name,
            onboardingKey,
            apiKey,
            isApiActive: true, // Active par défaut à la création
        },
    });
}

/**
 * Regénère une clé pour une entreprise.
 * @param {number} companyId
 * @param {'apiKey' | 'onboardingKey'} keyType
 */
async function regenerateKey(companyId, keyType) {
    let newKey;
    if (keyType === 'apiKey') {
        newKey = crypto.randomBytes(32).toString('hex');
    } else if (keyType === 'onboardingKey') {
        newKey = `onboarding-${crypto.randomBytes(16).toString('hex')}`;
    } else {
        throw new Error("Type de clé invalide.");
    }

    return prisma.company.update({
        where: { id: companyId },
        data: { [keyType]: newKey },
        select: { id: true, name: true, apiKey: true, onboardingKey: true }
    });
}

/**
 * Récupère TOUTES les données nécessaires pour la page de détail de l'entreprise.
 * @param {number} companyId
 */
async function getCompanyDetailsForAdminPage(companyId) {
    const permissionAction = `COMPANY.${companyId}.*`;

    const [companyDetails, kpiMetrics, revenueData, managers] = await Promise.all([
        prisma.company.findUnique({
            where: { id: companyId },
            include: {
                // CORRECTION : On s'assure d'inclure les employés
                employees: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                username: true,
                                status: true,
                                discordId: true,
                                characterId: true
                            }
                        }
                    }
                },
                activeModules: { include: { module: true } },
                bills: { take: 10, orderBy: { createdAt: 'desc' } },
                logs: { take: 10, orderBy: { createdAt: 'desc' } },
                billableContacts: { include: { user: { select: { id: true, name: true } } } }
            }
        }),
        adminAnalyticsService.getKpiMetrics(companyId),
        adminAnalyticsService.getRevenueData(companyId),
        prisma.user.findMany({
            where: {
                permissions: { some: { action: permissionAction } }
            },
            select: { id: true, name: true }
        })
    ]);

    if (!companyDetails) return null;

    return {
        company: companyDetails,
        analytics: {
            kpis: kpiMetrics,
            revenueChart: revenueData,
        },
        managers
    };
}

/**
 * Ajoute la permission de gérant principal à un utilisateur pour une entreprise.
 * @param {number} companyId
 * @param {number} userId
 */
async function addManager(companyId, userId) {
    const permissionAction = `COMPANY.${companyId}.*`;

    const permission = await prisma.permission.upsert({
        where: { action: permissionAction },
        update: {},
        create: { action: permissionAction },
    });

    await prisma.user.update({
        where: { id: userId },
        data: {
            permissions: {
                connect: { id: permission.id },
            },
        },
    });
}

/**
 * Retire la permission de gérant principal à un utilisateur pour une entreprise.
 * @param {number} companyId
 * @param {number} userId
 */
async function removeManager(companyId, userId) {
    const permissionAction = `COMPANY.${companyId}.*`;
    const permission = await prisma.permission.findUnique({
        where: { action: permissionAction },
    });

    if (permission) {
        await prisma.user.update({
            where: { id: userId },
            data: {
                permissions: {
                    disconnect: { id: permission.id },
                },
            },
        });
    }
}

module.exports = {
    getAllCompanies,
    getCompanyById,
    updateCompany,
    addBillableContact,
    removeBillableContact,
    createCompany,
    regenerateKey,
    getCompanyDetailsForAdminPage,
    addManager,
    removeManager,
};