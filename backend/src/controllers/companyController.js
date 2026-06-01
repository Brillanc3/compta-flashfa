// backend/src/controllers/companyController.js

const prisma = require('../db');
const crypto = require('crypto');
const { add } = require('date-fns');
const { CompanyEmployeeStatus } = require('@prisma/client');
const { hasWildcardPermission } = require('../middleware/auth');
const billService = require('../services/billService');

/**
 * Récupère TOUTES les entreprises pour un administrateur.
 */
const getAllCompaniesForAdmin = async (request, reply) => {
    try {
        const companies = await prisma.company.findMany({
            orderBy: {
                name: 'asc'
            }
        });
        reply.send(companies);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la récupération de la liste complète des entreprises.", error: error.message });
    }
};

/**
 * Récupère la liste des entreprises.
 * La logique est maintenant basée sur les permissions de l'utilisateur.
 */
const getAllCompanies = async (request, reply) => {
    try {
        const userId = request.user.userId;

        const userWithPermissions = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: { include: { permissions: true } },
                permissions: true,
            },
        });

        if (!userWithPermissions) {
            return reply.code(404).send({ message: 'Utilisateur non trouvé.' });
        }

        const userPermissions = new Set();
        userWithPermissions.roles.forEach(role => role.permissions.forEach(p => userPermissions.add(p.action)));
        userWithPermissions.permissions.forEach(p => userPermissions.add(p.action));

        let companies;

        // --- BLOC CORRIGÉ ---
        // On utilise la fonction hasWildcardPermission qui sait interpréter "ADMIN.*"
        if (hasWildcardPermission(userPermissions, 'ADMIN.PANEL.COMPANY.VIEW')) {
            companies = await prisma.company.findMany({
                include: { users: { select: { id: true, name: true, username: true } } },
            });
        } else {
            // ... (logique pour les utilisateurs non-admin inchangée)
            companies = await prisma.company.findMany({
                where: {
                    users: {
                        some: {
                            id: userId,
                        },
                    },
                },
                include: { users: { select: { id: true, name: true, username: true } } },
            });
        }
        // --- FIN DU BLOC CORRIGÉ ---

        reply.send(companies);
    } catch (error)
    {
        reply.code(500).send({ message: 'Erreur serveur', error: error.message });
    }
};


/**
 * Crée une nouvelle entreprise et ses permissions par défaut.
 */
const createCompany = async (request, reply) => {
    try {
        const newCompany = await prisma.$transaction(async (tx) => {
            const company = await tx.company.create({ data: { name: request.body.name } });
            await tx.permission.create({ data: { action: `COMPANY.${company.id}.*` } });
            const defaultModules = ['COMPTABILITE', 'ANALYTICS'];
            for (const moduleName of defaultModules) {
                const moduleToActivate = await tx.module.findUnique({ where: { name: moduleName } });
                if (moduleToActivate) {
                    await tx.companyModule.create({ data: { companyId: company.id, moduleId: moduleToActivate.id } });
                    const permissionTemplates = await tx.permissionTemplate.findMany({ where: { moduleId: moduleToActivate.id } });
                    const permissionsToCreate = permissionTemplates.map(template => ({ action: `COMPANY.${company.id}.${template.action}` }));
                    if (permissionsToCreate.length > 0) {
                        await tx.permission.createMany({ data: permissionsToCreate, skipDuplicates: true });
                    }
                }
            }
            return company;
        });
        reply.code(201).send(newCompany);
    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors de la création de l\'entreprise', error: error.message });
    }
};

/**
 * Met à jour les modules actifs pour une entreprise et gère les permissions associées.
 */
const updateCompanyModules = async (request, reply) => {
    const companyId = parseInt(request.params.id, 10);
    const { moduleIds } = request.body;

    try {
        await prisma.$transaction(async (tx) => {
            // 1. On supprime toutes les permissions dynamiques et les liaisons de modules actuelles.
            await tx.permission.deleteMany({ where: { action: { startsWith: `COMPANY.${companyId}.` } } });
            await tx.companyModule.deleteMany({ where: { companyId: companyId } });

            // 2. On recrée systématiquement la permission joker principale.
            await tx.permission.create({ data: { action: `COMPANY.${companyId}.*` } });

            if (moduleIds && moduleIds.length > 0) {
                // 3. On recrée les liaisons pour les modules sélectionnés.
                await tx.companyModule.createMany({
                    data: moduleIds.map(moduleId => ({ companyId, moduleId })),
                });

                // 4. On récupère les templates de permissions pour les modules activés.
                const permissionTemplates = await tx.permissionTemplate.findMany({
                    where: { moduleId: { in: moduleIds } },
                });

                // 5. On génère les nouvelles permissions spécifiques.
                const permissionsToCreate = permissionTemplates.map(template => ({
                    action: `COMPANY.${companyId}.${template.action}`
                }));
                if (permissionsToCreate.length > 0) {
                    await tx.permission.createMany({ data: permissionsToCreate });
                }
            }
        });

        const updatedCompany = await prisma.company.findUnique({
            where: { id: companyId },
            include: { activeModules: { include: { module: true } } }
        });

        reply.send(updatedCompany);
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: 'Erreur lors de la mise à jour des modules.', error: error.message });
    }
};

/**
 * Récupère une entreprise par son ID.
 */
const getCompanyById = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            include: {
                users: true,
                bills: true,
                employees: true,
                activeModules: {
                    include: {
                        module: {
                            include: {
                                permissionTemplates: true
                            }
                        }
                    }
                }
            },
        });
        if (!company) {
            return reply.code(404).send({ message: 'Entreprise non trouvée.' });
        }
        reply.send(company);
    } catch (error) {
        reply.code(500).send({ message: 'Erreur serveur', error: error.message });
    }
};

/**
 * Récupère une liste d'entreprises sur la base d'un tableau d'IDs.
 * Utile pour le frontend quand il déduit des accès depuis les permissions.
 * @param {request} request - La requête fastify, qui contiendra les IDs dans la query string.
 * @param {reply} reply - La réponse fastify.
 */
const getCompaniesByIds = async (request, reply) => {
    try {
        // On récupère les IDs depuis la query string (ex: /by-ids?ids=7,8,9)
        const { ids } = request.query;
        if (!ids) {
            return reply.code(400).send({ message: "Le paramètre 'ids' est manquant." });
        }

        const companyIds = ids.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

        if (companyIds.length === 0) {
            return reply.send([]);
        }

        const companies = await prisma.company.findMany({
            where: {
                id: {
                    in: companyIds,
                },
            },
        });

        reply.send(companies);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la récupération des entreprises par IDs.", error: error.message });
    }
};

/**
 * Met à jour une entreprise.
 */
const updateCompany = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const { name } = request.body;
        const updatedCompany = await prisma.company.update({
            where: { id: companyId },
            data: { name },
        });
        reply.send(updatedCompany);
    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors de la mise à jour', error: error.message });
    }
};

/**
 * Supprime une entreprise ET toutes les données et permissions associées.
 */
const deleteCompany = async (request, reply) => {
    const companyId = parseInt(request.params.id, 10);
    try {
        await prisma.$transaction(async (tx) => {
            await tx.log.deleteMany({ where: { companyId } });
            await tx.transaction.deleteMany({ where: { companyId } });
            await tx.bill.deleteMany({ where: { companyId } });
            await tx.companyEmployee.deleteMany({ where: { companyId } });
            await tx.companyModule.deleteMany({ where: { companyId } });
            await tx.company.update({
                where: { id: companyId },
                data: { users: { set: [] } },
            });
            await tx.permission.deleteMany({
                where: { action: { startsWith: `COMPANY.${companyId}.` } }
            });
            await tx.company.delete({ where: { id: companyId } });
        });
        reply.code(204).send();
    } catch (error) {
        console.error("Erreur lors de la suppression de l'entreprise :", error);
        reply.code(500).send({ message: 'Erreur lors de la suppression', error: error.message });
    }
};

/**
 * Assigne un utilisateur à une entreprise ET lui donne la permission Gérant (COMPANY.ID.*).
 */
const assignUserToCompany = async (request, reply) => {
    const companyId = parseInt(request.params.id, 10);
    const { userId } = request.body;

    // --- LOG DE DÉBOGAGE ---
    console.log(`[assignUserToCompany] Démarrage pour companyId: ${companyId}, userId: ${userId}`);

    try {
        await prisma.$transaction(async (tx) => {
            // --- LOG DE DÉBOGAGE ---
            console.log(`[assignUserToCompany] Début de la transaction.`);

            const permissionAction = `COMPANY.${companyId}.*`;
            const managerPermission = await tx.permission.upsert({
                where: { action: permissionAction },
                update: {},
                create: { action: permissionAction },
            });

            // --- LOG DE DÉBOGAGE ---
            if (managerPermission) {
                console.log(`[assignUserToCompany] Permission trouvée ou créée avec succès. ID: ${managerPermission.id}, Action: ${managerPermission.action}`);
            } else {
                // Ce cas ne devrait jamais arriver avec upsert, mais c'est une sécurité
                console.error(`[assignUserToCompany] ERREUR CRITIQUE : L'opération upsert n'a retourné aucune permission.`);
                throw new Error("La création de la permission a échoué.");
            }

            await tx.company.update({
                where: { id: companyId },
                data: { users: { connect: { id: userId } } },
            });

            // --- LOG DE DÉBOGAGE ---
            console.log(`[assignUserToCompany] L'utilisateur ${userId} a été connecté à l'entreprise ${companyId}.`);

            await tx.user.update({
                where: { id: userId },
                data: { permissions: { connect: { id: managerPermission.id } } },
            });

            // --- LOG DE DÉBOGAGE ---
            console.log(`[assignUserToCompany] La permission ID ${managerPermission.id} a été connectée à l'utilisateur ${userId}.`);
            console.log(`[assignUserToCompany] Fin de la transaction.`);
        });

        const updatedCompany = await prisma.company.findUnique({
            where: { id: companyId },
            include: { users: true }
        });
        reply.send(updatedCompany);

    } catch (error) {
        // --- LOG DE DÉBOGAGE ---
        console.error("[assignUserToCompany] Une ERREUR est survenue durant le processus :", error);
        reply.code(500).send({ message: 'Erreur lors de l\'assignation de l\'utilisateur.' });
    }
};

/**
 * Génère une nouvelle clé d'API.
 */
const generateApiKey = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const newApiKey = crypto.randomBytes(32).toString('hex');
        await prisma.company.update({
            where: { id: companyId },
            data: { apiKey: newApiKey },
        });
        reply.send({ apiKey: newApiKey });
    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors de la génération de la clé API', error: error.message });
    }
};

/**
 * Active ou désactive l'API pour une entreprise et enregistre la raison.
 */
const setApiStatus = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const { isActive, reason } = request.body;
        if (typeof isActive !== 'boolean') {
            return reply.code(400).send({ message: "Le champ 'isActive' (booléen) est requis." });
        }
        let deactivationReason = null;
        if (isActive === false) {
            deactivationReason = reason || "Aucune raison spécifiée";
        }
        const updatedCompany = await prisma.company.update({
            where: { id: companyId },
            data: {
                isApiActive: isActive,
                apiDeactivationReason: deactivationReason,
            },
        });
        reply.send(updatedCompany);
    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors de la mise à jour du statut de l\'API', error: error.message });
    }
};

/**
 * Retire un utilisateur d'une entreprise ET retire sa permission Gérant.
 */
const removeUserFromCompany = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const { userId } = request.body;
        await prisma.$transaction(async (tx) => {
            await tx.company.update({
                where: { id: companyId },
                data: { users: { disconnect: { id: userId } } },
            });
            const managerPermission = await tx.permission.findUnique({
                where: { action: `COMPANY.${companyId}.*` },
            });
            if (managerPermission) {
                await tx.user.update({
                    where: { id: userId },
                    data: { permissions: { disconnect: { id: managerPermission.id } } },
                });
            }
        });
        const updatedCompany = await prisma.company.findUnique({
            where: { id: companyId },
            include: { users: true }
        });
        reply.send(updatedCompany);
    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors du retrait de l\'utilisateur', error: error.message });
    }
};

// --- FONCTIONS POUR LA PAGE DES PARAMÈTRES ---

/**
 * Récupère les paramètres spécifiques d'une entreprise.
 */
const getCompanySettings = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const settings = await prisma.company.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                name: true,
                apiKey: true,
                onboardingKey: true,
            },
        });

        if (!settings) {
            return reply.code(404).send({ message: 'Entreprise non trouvée.' });
        }
        reply.send(settings);
    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors de la récupération des paramètres', error: error.message });
    }
};

/**
 * Génère une nouvelle clé d'onboarding unique pour une entreprise.
 */
const regenerateOnboardingKey = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);

        const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
        const slug = company.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const randomPart = crypto.randomBytes(16).toString('hex');
        const newOnboardingKey = `${slug}-${randomPart}`;

        await prisma.company.update({
            where: { id: companyId },
            data: { onboardingKey: newOnboardingKey },
        });

        reply.send({ onboardingKey: newOnboardingKey });
    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors de la génération de la clé d\'onboarding', error: error.message });
    }
};

// --- NOUVELLES FONCTIONS POUR LA GESTION DES CODES D'ONBOARDING ---

/**
 * Récupère la liste des codes d'onboarding valides pour une entreprise.
 */
const getOnboardingCodes = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const codes = await prisma.onboardingCode.findMany({
            where: {
                companyId: companyId,
                isUsed: false,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gte: new Date() } }
                ],
            },
            orderBy: { createdAt: 'desc' },
        });
        reply.send(codes);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la récupération des codes.", error: error.message });
    }
};

/**
 * Crée un nouveau code d'onboarding pour une entreprise.
 */
const createOnboardingCode = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const { durationInHours } = request.body;
        let expiresAt = null;
        if (durationInHours && typeof durationInHours === 'number') {
            expiresAt = add(new Date(), { hours: durationInHours });
        }
        const newCode = await prisma.onboardingCode.create({
            data: {
                companyId: companyId,
                code: crypto.randomBytes(4).toString('hex').toUpperCase(),
                expiresAt: expiresAt,
            },
        });
        reply.code(201).send(newCode);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la création du code.", error: error.message });
    }
};

/**
 * Supprime un code d'onboarding.
 */
const deleteOnboardingCode = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const codeId = parseInt(request.params.codeId, 10);

        // On vérifie que le code appartient bien à l'entreprise pour la sécurité
        const code = await prisma.onboardingCode.findFirst({
            where: { id: codeId, companyId: companyId }
        });

        if (!code) {
            return reply.code(404).send({ message: "Code non trouvé ou n'appartient pas à cette entreprise." });
        }

        await prisma.onboardingCode.delete({ where: { id: codeId } });

        reply.code(204).send();
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la suppression du code.", error: error.message });
    }
};

/**
 * Récupère la liste de tous les employés d'une entreprise.
 */
const getCompanyEmployees = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const employees = await prisma.companyEmployee.findMany({
            where: { companyId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        characterId: true,
                    },
                },
                rank: {
                    select: {
                        name: true,
                    }
                }
            },
            orderBy: {
                user: { name: 'asc' }
            }
        });
        reply.send(employees);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la récupération des employés.", error: error.message });
    }
};

/**
 * Met à jour le statut d'un employé (ex: débloquer un compte).
 */
const updateEmployeeStatus = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const employeeId = parseInt(request.params.employeeId, 10);
        const { status } = request.body;

        // Validation pour s'assurer que le statut est valide
        if (!Object.values(CompanyEmployeeStatus).includes(status)) {
            return reply.code(400).send({ message: `Statut '${status}' invalide.` });
        }

        // Vérifie que l'employé appartient bien à la bonne entreprise avant de le modifier
        const employee = await prisma.companyEmployee.findFirst({
            where: { id: employeeId, companyId: companyId }
        });

        if (!employee) {
            return reply.code(404).send({ message: "Employé non trouvé dans cette entreprise." });
        }

        const dataToUpdate = { status };
        // Si on réactive un compte bloqué, on réinitialise le compteur d'échecs
        if (employee.status === 'BLOCKED' && status === 'ACTIVE') {
            dataToUpdate.failedLinkAttempts = 0;
        }

        const updatedEmployee = await prisma.companyEmployee.update({
            where: { id: employeeId },
            data: dataToUpdate,
            include: { user: true, rank: true } // Renvoyer les données complètes
        });

        if ((status === 'FIRE' || status === 'RESIGNED') && updatedEmployee.userId) {
            const { removeCompanyGuildMember } = require('../modules/tchatv2/guild/guild.service');
            removeCompanyGuildMember(updatedEmployee.userId, companyId).catch(() => {});
        }

        reply.send(updatedEmployee);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la mise à jour du statut de l'employé.", error: error.message });
    }
};

/**
 * Récupère la liste paginée des factures pour une entreprise.
 */
const getCompanyBills = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const page = parseInt(request.query.page, 10) || 1;
        const pageSize = parseInt(request.query.limit, 10) || 15;

        // Le service retourne { bills, totalCount }
        const { bills, totalCount } = await billService.getBillsForCompany(companyId, page, pageSize);

        // --- MODIFICATION : On formate la réponse comme le frontend l'attend ---
        reply.send({
            data: bills,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / pageSize),
                totalItems: totalCount,
                limit: pageSize
            }
        });

    } catch (error) {
        request.log.error("Erreur lors de la récupération des factures de l'entreprise:", error);
        reply.code(500).send({ message: "Erreur serveur lors de la récupération des factures." });
    }
};


module.exports = {
    getAllCompanies, createCompany, updateCompanyModules, getCompanyById,
    updateCompany, deleteCompany, assignUserToCompany, removeUserFromCompany,
    generateApiKey, setApiStatus, regenerateOnboardingKey, getCompanySettings,
    getOnboardingCodes, createOnboardingCode, deleteOnboardingCode,
    getCompanyEmployees, updateEmployeeStatus, getAllCompaniesForAdmin,
    getCompaniesByIds, getCompanyBills
};