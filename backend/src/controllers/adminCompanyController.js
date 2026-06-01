// backend/src/controllers/adminCompanyController.js
const adminCompanyService = require('../services/adminCompanyService');

const getCompanies = async (request, reply) => {
    try {
        const companies = await adminCompanyService.getAllCompanies();
        reply.send(companies);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la récupération des entreprises." });
    }
};

const getCompany = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const company = await adminCompanyService.getCompanyById(companyId);
        if (!company) {
            return reply.code(404).send({ message: "Entreprise non trouvée." });
        }
        reply.send(company);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la récupération de l'entreprise." });
    }
};

const updateCompany = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const updatedCompany = await adminCompanyService.updateCompany(companyId, request.body);
        reply.send(updatedCompany);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const addBillableContact = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const { userId } = request.body;
        const result = await adminCompanyService.addBillableContact(companyId, userId);
        reply.code(201).send(result);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const removeBillableContact = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const userId = parseInt(request.params.userId, 10);
        const result = await adminCompanyService.removeBillableContact(companyId, userId);
        reply.send(result);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const createCompany = async (request, reply) => {
    try {
        const newCompany = await adminCompanyService.createCompany(request.body);
        reply.code(201).send(newCompany);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const regenerateKey = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const { keyType } = request.body; // 'apiKey' ou 'onboardingKey'
        const updatedCompany = await adminCompanyService.regenerateKey(companyId, keyType);
        reply.send(updatedCompany);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const getCompanyDetails = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const details = await adminCompanyService.getCompanyDetailsForAdminPage(companyId);
        if (!details) {
            return reply.code(404).send({ message: "Entreprise non trouvée." });
        }
        reply.send(details);
    } catch (error) {
        // --- MODIFICATION ---
        // On log l'erreur complète sur le serveur pour le débogage
        console.error("[DEBUG] Erreur dans getCompanyDetails:", error);
        // --- FIN DE LA MODIFICATION ---

        reply.code(500).send({ message: "Erreur lors de la récupération des détails de l'entreprise." });
    }
};

const addManager = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const { userId } = request.body;
        await adminCompanyService.addManager(companyId, userId);
        reply.code(204).send();
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const removeManager = async (request, reply) => {
    try {
        const { id: companyId, userId } = request.params;
        await adminCompanyService.removeManager(parseInt(companyId, 10), parseInt(userId, 10));
        reply.code(204).send();
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

module.exports = {
    getCompanies,
    getCompany,
    updateCompany,
    addBillableContact,
    removeBillableContact,
    createCompany,
    regenerateKey,
    getCompanyDetails,
    addManager,
    removeManager,
};