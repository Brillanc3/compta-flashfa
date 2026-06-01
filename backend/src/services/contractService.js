// backend/src/services/contractService.js
const prisma = require('../db');
const { createNotification } = require('./notificationService');


/**
 * Crée un nouveau template de contrat avec ses champs variables dans une transaction.
 * @param {object} data
 * @param {string} data.title
 * @param {string} data.content - Contenu rich text/Markdown.
 * @param {string} data.type - ContractType (ex: 'ADMIN').
 * @param {Array<object>} data.fields - Liste des définitions de champs (key, fieldType, label).
 * @param {number} data.ownerUserId - ID de l'utilisateur créateur.
 */
async function createTemplate({ title, content, type, fields, ownerUserId }) {
    if (!title || !content || !type || !fields || fields.length === 0) {
        throw new Error("Le titre, le contenu, le type et au moins un champ sont requis.");
    }

    return prisma.$transaction(async (tx) => {
        const template = await tx.contractTemplate.create({
            data: {
                title,
                content,
                type,
                ownerUserId,
            }
        });

        const fieldsData = fields.map((field, index) => ({
            templateId: template.id,
            key: field.key,
            fieldType: field.fieldType,
            label: field.label,
            order: index,
            options: field.options || null,
        }));

        await tx.contractTemplateField.createMany({
            data: fieldsData
        });

        return { ...template, fields: fieldsData };
    });
}


/**
 * Récupère tous les modèles de contrat avec leur type et le nombre de champs associés.
 * @returns {Promise<Array>}
 */
async function getAllTemplates() {
    return prisma.contractTemplate.findMany({
        select: {
            id: true,
            title: true,
            type: true,
            _count: {
                select: { fields: true },
            },
        },
        orderBy: {
            title: 'asc',
        }
    });
}

/**
 * Récupère un modèle de contrat avec tous ses champs de formulaire.
 * @param {number} templateId
 * @returns {Promise<object|null>}
 */
async function getTemplateWithFields(templateId) {
    return prisma.contractTemplate.findUnique({
        where: { id: templateId },
        include: {
            fields: {
                orderBy: {
                    order: 'asc',
                }
            },
        },
    });
}

/**
 * Crée une entrée AssignedContract, après avoir vérifié qu'il n'y en a pas déjà un en attente.
 * @param {object} data
 * @returns {Promise<object>}
 */
async function assignContractToUser(data) {
    const { templateId, assignedToUserId, fieldValues, createCompanyOnSignature, assignerId, modifiesCompanyId } = data;

    const existingPendingContract = await prisma.assignedContract.findFirst({
        where: {
            templateId: parseInt(templateId, 10),
            assignedToUserId: parseInt(assignedToUserId, 10),
            status: 'PENDING',
            modifiesCompanyId: modifiesCompanyId ? parseInt(modifiesCompanyId, 10) : null,
        }
    });

    if (existingPendingContract) {
        throw new Error("Cet utilisateur a déjà un contrat de ce type en attente de signature.");
    }

    const finalFieldValues = {
        ...fieldValues,
        _system: {
            createCompanyOnSignature: !!createCompanyOnSignature
        }
    };

    const assignedContract = await prisma.assignedContract.create({
        data: {
            templateId: parseInt(templateId, 10),
            assignedToUserId: parseInt(assignedToUserId, 10),
            fieldValues: JSON.stringify(finalFieldValues),
            status: 'PENDING',
            modifiesCompanyId: modifiesCompanyId ? parseInt(modifiesCompanyId, 10) : null,
        },
        include: {
            template: true
        }
    });

    if (assignedContract) {
        await createNotification({
            recipientUserIds: [assignedContract.assignedToUserId],
            content: {
                title: "Nouveau contrat en attente",
                body: `Un nouveau contrat, "${assignedContract.template.title}", requiert votre signature.`,
                assignedContractId: assignedContract.id
            },
            type: 'SYSTEM',
            behavior: 'BLOCKING',
            senderId: assignerId,
        });
    }

    return assignedContract;
}

/**
 * Récupère un contrat assigné uniquement s'il appartient bien à l'utilisateur spécifié.
 * @param {number} contractId - L'ID du contrat assigné.
 * @param {number} userId - L'ID de l'utilisateur qui doit signer.
 * @returns {Promise<object|null>}
 */
async function getAssignedContractForUser(contractId, userId) {
    return prisma.assignedContract.findFirst({
        where: {
            id: contractId,
            assignedToUserId: userId
        },
        include: {
            template: {
                include: {
                    fields: true
                }
            }
        }
    });
}

/**
 * Valide et enregistre la signature d'un contrat.
 * @param {object} data
 */
async function signAssignedContract(data) {
    const { contractId, userId, confirmationText } = data;
    console.log(`[signContract DEBUG] Démarrage de la signature pour le contrat ID: ${contractId} par l'utilisateur ID: ${userId}`);

    return prisma.$transaction(async (tx) => {
        console.log(`[signContract DEBUG] Début de la transaction Prisma.`);

        const contract = await tx.assignedContract.findFirst({
            where: {
                id: contractId,
                assignedToUserId: userId
            }
        });
        console.log(`[signContract DEBUG] Contrat trouvé en base de données:`, contract ? `ID ${contract.id}, Status ${contract.status}` : 'Non trouvé');

        if (!contract) {
            throw new Error("Contrat non trouvé ou vous n'êtes pas autorisé à le signer.");
        }
        if (contract.status !== 'PENDING') {
            throw new Error("Ce contrat n'est plus en attente de signature.");
        }

        // --- DÉBUT DE LA LOGIQUE DE MODIFICATION D'ENTREPRISE ---
        if (contract.modifiesCompanyId) {
            console.log(`[signContract DEBUG] Ce contrat est lié à une modification de l'entreprise ID: ${contract.modifiesCompanyId}.`);

            const company = await tx.company.findUnique({
                where: { id: contract.modifiesCompanyId }
            });

            if (company && company.pendingChanges) {
                console.log(`[signContract DEBUG] Modifications en attente trouvées pour l'entreprise:`, company.pendingChanges);

                if (new Date() > new Date(company.pendingChangesDeadline)) {
                    console.error(`[signContract DEBUG] ERREUR: Le délai de signature est dépassé.`);
                    await tx.company.update({
                        where: { id: company.id },
                        data: { pendingChanges: null, pendingChangesDeadline: null }
                    });
                    throw new Error("Le délai de 7 jours pour signer ce contrat est dépassé. Les modifications ont été annulées.");
                }

                const changes = company.pendingChanges;
                const updateData = {};
                if (changes.name) updateData.name = changes.name;
                if (changes.accountingPrice !== undefined) updateData.accountingPrice = changes.accountingPrice;

                // --- BLOC CORRIGÉ ---
                let moduleUpdates = {};
                // On utilise le bon identifiant composite 'companyId_moduleId'
                if (changes.modules?.remove?.length > 0) {
                    moduleUpdates.disconnect = changes.modules.remove.map(id => ({ companyId_moduleId: { moduleId: id, companyId: company.id } }));
                }
                if (changes.modules?.add?.length > 0) {
                    moduleUpdates.connectOrCreate = changes.modules.add.map(id => ({
                        where: { companyId_moduleId: { moduleId: id, companyId: company.id } },
                        create: { moduleId: id }
                    }));
                }
                // --- FIN DE LA CORRECTION ---

                console.log(`[signContract DEBUG] Préparation de la mise à jour de l'entreprise avec ces données:`, { ...updateData, activeModules: moduleUpdates });

                await tx.company.update({
                    where: { id: company.id },
                    data: {
                        ...updateData,
                        activeModules: moduleUpdates,
                        pendingChanges: null,
                        pendingChangesDeadline: null,
                    }
                });
                console.log(`[signContract DEBUG] ✅ Mise à jour de l'entreprise et nettoyage des pendingChanges réussis.`);
            } else {
                console.log(`[signContract DEBUG] AVERTISSEMENT: L'entreprise (ID: ${contract.modifiesCompanyId}) n'a pas été trouvée ou n'a pas de modifications en attente.`);
            }
        } else {
            console.log(`[signContract DEBUG] Ce contrat n'est pas lié à une modification d'entreprise (modifiesCompanyId est null).`);
        }
        // --- FIN DE LA LOGIQUE DE MODIFICATION D'ENTREPRISE ---

        await tx.contractSignature.create({
            data: {
                assignedContractId: contractId,
                confirmationText: confirmationText,
            }
        });
        console.log(`[signContract DEBUG] Enregistrement de la signature créé.`);

        const updatedContract = await tx.assignedContract.update({
            where: { id: contractId },
            data: {
                status: 'SIGNED',
                signedAt: new Date(),
            }
        });
        console.log(`[signContract DEBUG] Statut du contrat mis à jour à 'SIGNED'.`);

        // La logique de création d'entreprise utilise maintenant fieldValuesObject
        // const shouldCreateCompany = fieldValuesObject?._system?.createCompanyOnSignature;
        // if (shouldCreateCompany) {
        //     const companyName = fieldValuesObject?.COMPANY_NAME;
        //     if (companyName) {
        //         const newCompany = await tx.company.create({
        //             data: { name: companyName }
        //         });
        //         await tx.assignedContract.update({
        //             where: { id: contractId },
        //             data: { generatedCompanyId: newCompany.id }
        //         });
        //     }
        // }

        console.log(`[signContract DEBUG] Fin de la transaction.`);
        return updatedContract;
    });
}

/**
 * Récupère tous les contrats assignés à un utilisateur.
 * @param {number} userId - L'ID de l'utilisateur.
 * @returns {Promise<Array>}
 */
async function getAllAssignedContractsForUser(userId) {
    return prisma.assignedContract.findMany({
        where: {
            assignedToUserId: userId
        },
        include: {
            template: {
                select: {
                    title: true
                }
            }
        },
        orderBy: {
            assignedAt: 'desc'
        }
    });
}

module.exports = {
    createTemplate,
    getAllTemplates,
    getTemplateWithFields,
    assignContractToUser,
    getAssignedContractForUser,
    signAssignedContract,
    getAllAssignedContractsForUser
};