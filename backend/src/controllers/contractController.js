// backend/src/controllers/contractController.js
const contractService = require('../services/contractService');

/**
 * POST /contracts/templates : Crée un nouveau template de contrat.
 */
const postTemplate = async (request, reply) => {
    try {
        const { title, content, type, fields } = request.body;
        const ownerUserId = request.user.userId;

        const newTemplate = await contractService.createTemplate({
            title,
            content,
            type,
            fields,
            ownerUserId,
        });

        reply.code(201).send(newTemplate);
    } catch (error) {
        request.log.error(error.message);
        reply.code(400).send({ message: error.message });
    }
};

/**
 * Récupère une liste simple de tous les modèles de contrat.
 */
const getTemplates = async (request, reply) => {
    try {
        const templates = await contractService.getAllTemplates();
        reply.send(templates);
    } catch (error) {
        request.log.error("Erreur dans getTemplates:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération des modèles de contrat." });
    }
};

/**
 * Récupère les détails complets d'un modèle de contrat par son ID.
 */
const getTemplateById = async (request, reply) => {
    try {
        const { id } = request.params;
        const template = await contractService.getTemplateWithFields(parseInt(id, 10));
        if (!template) {
            return reply.code(404).send({ message: "Modèle de contrat non trouvé." });
        }
        reply.send(template);
    } catch (error) {
        request.log.error("Erreur dans getTemplateById:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération du modèle de contrat." });
    }
};

// --- FONCTION POUR LA TÂCHE 2 (déjà incluse) ---

/**
 * Assigne un contrat à un utilisateur.
 */
const assignContract = async (request, reply) => {
    try {
        const assignerId = request.user.userId;
        const { templateId, assignedToUserId, fieldValues, createCompanyOnSignature, modifiesCompanyId } = request.body;

        if (!templateId || !assignedToUserId || !fieldValues) {
            return reply.code(400).send({ message: "Les champs templateId, assignedToUserId et fieldValues sont requis." });
        }

        const assignedContract = await contractService.assignContractToUser({
            templateId,
            assignedToUserId,
            fieldValues,
            createCompanyOnSignature,
            modifiesCompanyId,
            assignerId,
        });

        reply.code(201).send(assignedContract);
    } catch (error) {
        request.log.error("Erreur dans assignContract:", error);
        reply.code(500).send({ message: "Erreur lors de l'assignation du contrat." });
    }
};

/**
 * Récupère un contrat assigné spécifique pour l'utilisateur authentifié.
 */
const getAssignedContractById = async (request, reply) => {
    try {
        const contractId = parseInt(request.params.id, 10);
        const userId = request.user.userId; // ID de l'utilisateur qui fait la demande

        const contract = await contractService.getAssignedContractForUser(contractId, userId);

        if (!contract) {
            return reply.code(404).send({ message: "Contrat non trouvé ou non autorisé." });
        }
        reply.send(contract);
    } catch (error) {
        request.log.error("Erreur dans getAssignedContractById:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération du contrat assigné." });
    }
};

/**
 * Traite la signature d'un contrat par l'utilisateur authentifié.
 */
const signContract = async (request, reply) => {
    try {
        const contractId = parseInt(request.params.id, 10);
        const userId = request.user.userId;
        const { confirmationText } = request.body;

        if (confirmationText !== 'Lu et approuvé') {
            return reply.code(400).send({ message: "Le texte de confirmation est incorrect." });
        }

        await contractService.signAssignedContract({
            contractId,
            userId,
            confirmationText,
        });

        reply.code(200).send({ message: "Contrat signé avec succès." });
    } catch (error) {
        request.log.error("Erreur dans signContract:", error);
        // Le service peut renvoyer des erreurs spécifiques (ex: déjà signé)
        reply.code(400).send({ message: error.message });
    }
};

/**
 * Récupère tous les contrats (passés et présents) pour l'utilisateur authentifié.
 */
const getMyAssignedContracts = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const contracts = await contractService.getAllAssignedContractsForUser(userId);
        reply.send(contracts);
    } catch (error) {
        request.log.error("Erreur dans getMyAssignedContracts:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération de vos contrats." });
    }
};

module.exports = {
    postTemplate,
    getTemplates,
    getTemplateById,
    assignContract,
    getAssignedContractById,
    signContract,
    getMyAssignedContracts
};