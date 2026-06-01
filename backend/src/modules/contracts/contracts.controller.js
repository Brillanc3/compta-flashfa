// /backend/src/modules/contracts/contracts.controller.js

/**
 * Controller du module Contracts
 * ------------------------------
 * Contient uniquement la logique de "contrôle" :
 *   - extraction des paramètres
 *   - validation basique
 *   - appels au service
 *   - réponses formatées
 *
 * Toute la logique métier (DB, validation profonde, etc.)
 * doit rester dans contracts.service.js.
 */

const contractService = require("./contracts.service");

function parseCompanyId(req) {
    const headerId = parseInt(req.headers['x-company-id'], 10);
    return Number.isInteger(headerId) && headerId > 0 ? headerId : null;
}

function handleContractShareError(reply, err) {
    switch (err.message) {
        case "PARTAGE_INVALIDE":
        case "PARTAGE_PUBLIC_INVALIDE":
            return reply.code(400).send({ error: err.message });

        case "PARTAGE_INTROUVABLE_OU_INTERDIT":
            return reply.code(403).send({ error: err.message });

        case "PARTAGE_PUBLIC_INTROUVABLE":
            return reply.code(404).send({ error: err.message });

        case "PARTAGE_PUBLIC_MOT_DE_PASSE_REQUIS":
        case "PARTAGE_PUBLIC_MOT_DE_PASSE_INVALIDE":
            return reply.code(401).send({ error: err.message });

        default:
            return reply.code(400).send({ error: err.message });
    }
}

function sendServiceError(reply, err, fallbackStatusCode = 400) {
    const statusCode = Number.isInteger(err?.statusCode) ? err.statusCode : fallbackStatusCode;
    const payload = { error: err?.message || "Erreur inconnue." };

    if (err?.details) {
        payload.details = err.details;
    }

    return reply.code(statusCode).send(payload);
}




/* ========================================================================== */
/* 🧩 GESTION DES TEMPLATES                                                   */
/* ========================================================================== */

async function createTemplateFieldHandler(req, reply) {
    try {
        const templateId = Number(req.params.templateId);
        const field = await contractService.createTemplateField(
            templateId,
            req.body
        );
        reply.send(field);
    } catch (err) {
        reply.code(400).send({ error: err.message });
    }
}

async function updateTemplateFieldHandler(req, reply) {
    try {
        const templateId = Number(req.params.templateId);
        const fieldId = Number(req.params.fieldId);
        const field = await contractService.updateTemplateField(
            templateId,
            fieldId,
            req.body
        );
        reply.send(field);
    } catch (err) {
        reply.code(400).send({ error: err.message });
    }
}

async function deleteTemplateFieldHandler(req, reply) {
    try {
        const templateId = Number(req.params.templateId);
        const fieldId = Number(req.params.fieldId);
        await contractService.deleteTemplateField(templateId, fieldId);
        reply.send({ success: true });
    } catch (err) {
        reply.code(400).send({ error: err.message });
    }
}


/**
 * POST /contracts/templates
 */
async function createTemplateHandler(req, reply) {
    try {
        const { title, content, type, backgroundImageUrl } = req.body;
        const ownerUserId = req.user.userId;
        const companyId = parseCompanyId(req);

        const result = await contractService.createTemplate({
            title,
            content,
            type,
            ownerUserId,
            backgroundImageUrl,
            companyId
        });

        reply.send(result);
    } catch (err) {
        reply.code(400).send({ error: err.message });
    }
}

/**
 * PUT /contracts/templates/:templateId/articles
 */
async function updateArticlesHandler(req, reply) {
    try {
        const templateId = parseInt(req.params.templateId, 10);
        const { articles } = req.body;

        if (!Array.isArray(articles)) {
            return reply.code(400).send({ error: "articles doit être un tableau." });
        }

        await contractService.updateArticles(templateId, articles);

        reply.send({ success: true });
    } catch (err) {
        reply.code(400).send({ error: err.message });
    }
}

/**
 * GET /contracts/templates/:templateId
 */
async function getTemplateHandler(req, reply) {
    try {
        const templateId = parseInt(req.params.templateId, 10);
        const template = await contractService.getTemplate(templateId);

        if (!template) {
            return reply.code(404).send({ error: "Template introuvable." });
        }

        reply.send(template);
    } catch (err) {
        reply.code(400).send({ error: err.message });
    }
}

/**
 * GET /contracts/templates
 */
async function listTemplatesHandler(req, reply) {
    try {
        const userId = req.user?.userId
        const companyId = parseCompanyId(req);
        const templates = await contractService.listTemplates(req.user?.userId, companyId);
        reply.send(templates);
    } catch (err) {
        reply.code(400).send({ error: err.message });
    }
}

/* ========================================================================== */
/* 📨 ASSIGNATION DE CONTRATS                                                */
/* ========================================================================== */

/**
 * POST /contracts/assign
 */
async function assignContractHandler(req, reply) {
    try {
        const assignerId = req.user.userId;
        const { templateId, assignedToUserId, fieldValues, modifiesCompanyId } = req.body;

        const assigned = await contractService.assignContract({
            templateId,
            assignedToUserId,
            fieldValues,
            modifiesCompanyId,
            assignerId
        });

        reply.send(assigned);
    } catch (err) {
        reply.code(400).send({ error: err.message });
    }
}

/* ========================================================================== */
/* 🔗 PARTAGES PUBLICS                                                       */
/* ========================================================================== */

async function createContractShareHandler(req, reply) {
    try {
        const userId = req.user.userId;
        const companyId = parseCompanyId(req);

        const assignedContractIds = Array.isArray(req.body?.assignedContractIds)
            ? req.body.assignedContractIds
            : [req.body?.assignedContractId].filter(Boolean);

        const share = await contractService.createContractShare({
            createdByUserId: userId,
            assignedContractIds,
            password: req.body?.password,
            companyId
        });

        reply.send(share);
    } catch (err) {
        handleContractShareError(reply, err);
    }
}

async function listContractSharesHandler(req, reply) {
    try {
        const userId = req.user.userId;
        const companyId = parseCompanyId(req);

        const shares = await contractService.listContractShares({
            userId,
            companyId
        });

        reply.send(shares);
    } catch (err) {
        handleContractShareError(reply, err);
    }
}

async function getManagedContractShareHandler(req, reply) {
    try {
        const userId = req.user.userId;
        const companyId = parseCompanyId(req);
        const shareId = req.params.shareId;

        const share = await contractService.getManagedContractShare({
            shareId,
            userId,
            companyId
        });

        reply.send(share);
    } catch (err) {
        handleContractShareError(reply, err);
    }
}

async function regenerateContractShareHandler(req, reply) {
    try {
        const userId = req.user.userId;
        const companyId = parseCompanyId(req);
        const shareId = req.params.shareId;

        const share = await contractService.regenerateContractShare({
            shareId,
            userId,
            companyId
        });

        reply.send(share);
    } catch (err) {
        handleContractShareError(reply, err);
    }
}

async function revokeContractShareHandler(req, reply) {
    try {
        const userId = req.user.userId;
        const companyId = parseCompanyId(req);
        const shareId = req.params.shareId;

        const share = await contractService.revokeContractShare({
            shareId,
            userId,
            companyId
        });

        reply.send(share);
    } catch (err) {
        handleContractShareError(reply, err);
    }
}

async function activateContractShareHandler(req, reply) {
    try {
        const userId = req.user.userId;
        const companyId = parseCompanyId(req);
        const shareId = req.params.shareId;

        const share = await contractService.activateContractShare({
            shareId,
            userId,
            companyId
        });

        reply.send(share);
    } catch (err) {
        handleContractShareError(reply, err);
    }
}

async function updateContractSharePasswordHandler(req, reply) {
    try {
        const userId = req.user.userId;
        const companyId = parseCompanyId(req);
        const shareId = req.params.shareId;

        const share = await contractService.updateContractSharePassword({
            shareId,
            userId,
            companyId,
            password: req.body?.password
        });

        reply.send(share);
    } catch (err) {
        handleContractShareError(reply, err);
    }
}

async function deleteContractShareHandler(req, reply) {
    try {
        const userId = req.user.userId;
        const companyId = parseCompanyId(req);
        const shareId = req.params.shareId;

        const result = await contractService.deleteContractShare({
            shareId,
            userId,
            companyId
        });

        reply.send(result);
    } catch (err) {
        handleContractShareError(reply, err);
    }
}

async function getPublicContractShareMetaHandler(req, reply) {
    try {
        const { publicId } = req.params;
        const meta = await contractService.getPublicContractShareMeta(publicId);
        reply.send(meta);
    } catch (err) {
        handleContractShareError(reply, err);
    }
}

async function accessPublicContractShareHandler(req, reply) {
    try {
        const { publicId } = req.params;
        const { password } = req.body || {};

        const share = await contractService.accessPublicContractShare({
            publicId,
            password
        });

        reply.send(share);
    } catch (err) {
        handleContractShareError(reply, err);
    }
}

/* ========================================================================== */
/* 🧾 LISTE DES CONTRATS D'UNE ENTREPRISE                                    */
/* ========================================================================== */

/**
 * GET /contracts/assigned
 * companyId vient *uniquement* du header x-company-id (requis par proxy)
 */
async function listCompanyContractsHandler(req, reply) {
    try {
        const companyId = parseCompanyId(req);

        if (!companyId) {
            return reply.code(400).send({
                error: "x-company-id est manquant dans les headers."
            });
        }

        const contracts = await contractService.getCompanyContracts(companyId);
        reply.send(contracts);
    } catch (err) {
        sendServiceError(reply, err);
    }
}

/* ========================================================================== */
/* 👤 CONTRATS PERSONNELS                                                    */
/* ========================================================================== */

/**
 * GET /contracts/assigned/:assignedContractId
 */
async function getAssignedContractHandler(req, reply) {
    try {
        const assignedContractId = parseInt(req.params.assignedContractId, 10);
        const userId = req.user.userId;

        const contract = await contractService.getAssignedContract(assignedContractId, userId);

        if (!contract) {
            return reply.code(404).send({ error: "Contrat introuvable." });
        }

        reply.send(contract);
    } catch (err) {
        sendServiceError(reply, err);
    }
}


/**
 * POST /contracts/assigned/:assignedContractId/sign
 */
async function signAssignedContractHandler(req, reply) {
    try {
        const userId = req.user.userId;
        const contractId = parseInt(req.params.assignedContractId, 10);
        const { confirmationText, role } = req.body || {};

        const result = await contractService.signContract({
            contractId,
            userId,
            role,
            confirmationText,
            ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
            userAgent: req.headers["user-agent"] || null
        });

        reply.send(result);
    } catch (err) {
        sendServiceError(reply, err);
    }
}

/**
 * POST /contracts/assigned/:assignedContractId/reject
 */
async function rejectAssignedContractHandler(req, reply) {
    try {
        const userId = req.user.userId;
        const contractId = parseInt(req.params.assignedContractId, 10);
        const { reason } = req.body || {};

        const result = await contractService.rejectContract(contractId, userId, reason);
        reply.send(result);
    } catch (err) {
        sendServiceError(reply, err);
    }
}

/**
 * GET /contracts/assigned/self
 * Liste les contrats personnels de l'utilisateur connecté
 */
async function listMyContractsHandler(req, reply) {
    try {
        const userId = req.user.userId;

        const contracts = await contractService.getContractsForUser(userId);

        reply.send(contracts);
    } catch (err) {
        console.error("listMyContractsHandler error:", err);
        reply.code(400).send({ error: err.message });
    }
}

/**
 * PUT /contracts/templates/:templateId
 * Met à jour un template de contrat
 */
async function updateTemplateHandler(req, reply) {
    const { templateId } = req.params;
    const userId = req.user?.id || null;

    const {
        title,
        type,
        content,
        backgroundImageUrl
    } = req.body;

    if (!title || !content) {
        return reply.code(400).send({
            error: "INVALID_PAYLOAD",
            message: "title et content sont obligatoires"
        });
    }

    try {
        const updated = await contractService.updateContractTemplate({
            templateId: Number(templateId),
            ownerUserId: userId,
            data: {
                title,
                type,
                content,
                backgroundImageUrl
            }
        });

        return reply.send(updated);
    } catch (err) {
        req.log.error(err);

        return reply.code(500).send({
            error: "TEMPLATE_UPDATE_FAILED",
            message: "Impossible de mettre à jour le template"
        });
    }
}


/* ========================================================================== */
/* EXPORT                                                                     */
/* ========================================================================== */

module.exports = {
    createTemplateHandler,
    updateArticlesHandler,
    getTemplateHandler,
    listTemplatesHandler,
    createTemplateFieldHandler,
    updateTemplateFieldHandler,
    deleteTemplateFieldHandler,
    updateTemplateHandler,

    assignContractHandler,

    createContractShareHandler,
    listContractSharesHandler,
    getManagedContractShareHandler,
    regenerateContractShareHandler,
    revokeContractShareHandler,
    activateContractShareHandler,
    updateContractSharePasswordHandler,
    deleteContractShareHandler,
    getPublicContractShareMetaHandler,
    accessPublicContractShareHandler,

    listCompanyContractsHandler,

    getAssignedContractHandler,
    listMyContractsHandler,
    signAssignedContractHandler,
    rejectAssignedContractHandler
};
