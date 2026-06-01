// /backend/src/modules/partenariat/partenariat.controller.js

/**
 * Controller du module Partenariat
 * --------------------------------
 * Gère :
 *  - CRUD Partenaires
 *  - CRUD Services d'un partenaire
 *  - Enregistrement des prestations (services rendus)
 *  - Résumé hebdomadaire (avec option includeEmployees)
 *
 * ⚠️ Le companyId est récupéré via l'en-tête `x-company-id`
 */

const partenariatService = require('./partenariat.service');

/* -------------------------------------------------------------------------- */
/* 🔧 UTILITAIRES                                                              */
/* -------------------------------------------------------------------------- */

function getCompanyIdFromRequest(request) {
    const headerValue =
        request.headers['x-company-id'] ||
        request.headers['X-Company-Id'] ||
        request.headers['x-Company-Id'];

    const companyId = parseInt(headerValue, 10);
    if (!companyId || Number.isNaN(companyId)) {
        const error = new Error("En-tête 'x-company-id' manquant ou invalide.");
        error.statusCode = 400;
        throw error;
    }
    return companyId;
}

function getUserIdFromRequest(request) {
    return request.user.userId;
}

function handleControllerError(reply, error, defaultMessage) {
    const statusCode = error.statusCode || error.statusCode === 0 ? error.statusCode : 500;
    const message = error.message || defaultMessage || "Erreur interne dans le module Partenariat.";

    if (reply?.log?.error) reply.log.error(error);
    else console.error(error);

    return reply.code(statusCode).send({ message });
}

/* ========================================================================== */
/* 🧩 PARTENAIRES                                                             */
/* ========================================================================== */

async function createPartnerHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const userId = getUserIdFromRequest(request);
        const partner = await partenariatService.createPartner({
            companyId,
            userId,
            data: request.body || {}
        });
        return reply.code(201).send(partner);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de créer le partenaire.");
    }
}

async function updatePartnerHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const partnerId = parseInt(request.params.partnerId, 10);

        if (!partnerId) return reply.code(400).send({ message: "ID partenaire invalide." });

        const partner = await partenariatService.updatePartner({
            companyId,
            partnerId,
            data: request.body || {}
        });

        return reply.code(200).send(partner);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de mettre à jour le partenaire.");
    }
}

async function deactivatePartnerHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const partnerId = parseInt(request.params.partnerId, 10);

        if (!partnerId) return reply.code(400).send({ message: "ID partenaire invalide." });

        const partner = await partenariatService.deactivatePartner({
            companyId,
            partnerId
        });

        return reply.code(200).send(partner);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de désactiver le partenaire.");
    }
}

async function activatePartnerHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const partnerId = parseInt(request.params.partnerId, 10);

        if (!partnerId) return reply.code(400).send({ message: "ID partenaire invalide." });

        const partner = await partenariatService.activatePartner({
            companyId,
            partnerId
        });

        return reply.code(200).send(partner);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de d'activer le partenaire.");
    }
}

async function listPartnersHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const includeInactive = String(request.query.includeInactive || "false") === "true";

        const partners = await partenariatService.listPartners({
            companyId,
            includeInactive
        });

        return reply.code(200).send(partners);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de récupérer les partenaires.");
    }
}

async function getPartnerByIdHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const partnerId = parseInt(request.params.partnerId, 10);

        if (!partnerId) return reply.code(400).send({ message: "ID partenaire invalide." });

        const partner = await partenariatService.getPartnerById({
            companyId,
            partnerId
        });

        if (!partner) return reply.code(404).send({ message: "Partenaire introuvable." });

        return reply.code(200).send(partner);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de charger le partenaire.");
    }
}

/* ========================================================================== */
/* 🧩 SERVICES PAR PARTENAIRE                                                 */
/* ========================================================================== */

async function createPartnerServiceTypeHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const partnerId = parseInt(request.params.partnerId, 10);
        if (!partnerId) return reply.code(400).send({ message: "ID partenaire invalide." });

        const serviceType = await partenariatService.createPartnerServiceType({
            companyId,
            partnerId,
            data: request.body || {}
        });

        return reply.code(201).send(serviceType);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de créer un service pour ce partenaire.");
    }
}

async function updatePartnerServiceTypeHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const partnerId = parseInt(request.params.partnerId, 10);
        const serviceTypeId = parseInt(request.params.serviceTypeId, 10);

        if (!partnerId || !serviceTypeId)
            return reply.code(400).send({ message: "ID invalide." });

        const serviceType = await partenariatService.updatePartnerServiceType({
            companyId,
            partnerId,
            serviceTypeId,
            data: request.body || {}
        });

        return reply.code(200).send(serviceType);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de mettre à jour le service.");
    }
}

async function deactivatePartnerServiceTypeHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const partnerId = parseInt(request.params.partnerId, 10);
        const serviceTypeId = parseInt(request.params.serviceTypeId, 10);

        if (!partnerId || !serviceTypeId)
            return reply.code(400).send({ message: "ID invalide." });

        const service = await partenariatService.deactivatePartnerServiceType({
            companyId,
            partnerId,
            serviceTypeId
        });

        return reply.code(200).send(service);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de désactiver le service.");
    }
}

async function activatePartnerServiceTypeHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const partnerId = parseInt(request.params.partnerId, 10);
        const serviceTypeId = parseInt(request.params.serviceTypeId, 10);

        if (!partnerId || !serviceTypeId)
            return reply.code(400).send({ message: "ID invalide." });

        const service = await partenariatService.activatePartnerServiceType({
            companyId,
            partnerId,
            serviceTypeId
        });

        return reply.code(200).send(service);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de désactiver le service.");
    }
}

async function listPartnerServiceTypesHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const partnerId = parseInt(request.params.partnerId, 10);
        if (!partnerId) return reply.code(400).send({ message: "ID partenaire invalide." });

        const includeInactive = String(request.query.includeInactive || "false") === "true";

        const services = await partenariatService.listPartnerServiceTypes({
            companyId,
            partnerId,
            includeInactive
        });

        return reply.code(200).send(services);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de charger les services du partenaire.");
    }
}

async function listPartnerServiceTypesForWidgetHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const partnerId = parseInt(request.params.partnerId, 10);
        if (!partnerId) return reply.code(400).send({ message: "ID partenaire invalide." });

        const includeInactive = false;

        const services = await partenariatService.listPartnerServiceTypes({
            companyId,
            partnerId,
            includeInactive
        });

        return reply.code(200).send(services);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de charger les services du partenaire.");
    }
}


/**
 * Liste tous les services actifs de TOUS les partenaires de l'entreprise.
 * Utilisé pour paymentSchemasLoader (matrix).
 */
async function listAllActiveServicesForCompanyHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);

        const services = await partenariatService.listAllActiveServicesForCompany({ companyId });

        return reply.code(200).send(services);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de charger les services actifs.");
    }
}

/* ========================================================================== */
/* 🧩 SERVICES RENDUS                                                         */
/* ========================================================================== */

async function createServiceRenderedHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const userId = getUserIdFromRequest(request);

        const record = await partenariatService.createServiceRendered({
            companyId,
            userId,
            data: request.body || {}
        });

        return reply.code(201).send(record);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible d'enregistrer le service rendu.");
    }
}

async function updateServiceRenderedHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const serviceRenderedId = parseInt(request.params.serviceRenderedId, 10);

        if (!serviceRenderedId) return reply.code(400).send({ message: "ID invalide." });

        const record = await partenariatService.updateServiceRendered({
            companyId,
            serviceRenderedId,
            data: request.body || {}
        });

        return reply.code(200).send(record);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de mettre à jour le service rendu.");
    }
}

async function listServicesRenderedHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);
        const userId = request.user.userId;
        const filters = {
            companyId,
            partnerId: request.query.partnerId ? parseInt(request.query.partnerId, 10) : undefined,
            employeeId: parseInt(userId, 10),
            from: request.query.from || undefined,
            to: request.query.to || undefined
        };

        const result = await partenariatService.listServicesRendered(filters);

        return reply.code(200).send(result);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de charger les services rendus.");
    }
}

async function listAllServicesRenderedHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);

        const partnerId = request.query.partnerId
            ? parseInt(request.query.partnerId, 10)
            : undefined;

        const from = request.query.from || undefined;
        const to = request.query.to || undefined;

        // Validation minimaliste (évite new Date("n'importe quoi"))
        if (from && Number.isNaN(Date.parse(from))) {
            return reply.code(400).send({ message: "Paramètre 'from' invalide." });
        }
        if (to && Number.isNaN(Date.parse(to))) {
            return reply.code(400).send({ message: "Paramètre 'to' invalide." });
        }

        const filters = { companyId, partnerId, from, to };

        const result = await partenariatService.listServicesRendered(filters);
        return reply.code(200).send(result);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de charger les services rendus.");
    }
}

/* ========================================================================== */
/* 🧮 RÉCAPITULATIF HEBDOMADAIRE                                              */
/* ========================================================================== */

async function getWeeklySummaryHandler(request, reply) {
    try {
        const companyId = getCompanyIdFromRequest(request);

        const includeEmployees =
            String(request.query.includeEmployees || "false") === "true";

        const partnerId = request.query.partnerId
            ? parseInt(request.query.partnerId, 10)
            : undefined;

        const from = request.query.from || undefined;
        const to = request.query.to || undefined;

        // Validation minimaliste (évite new Date("n'importe quoi"))
        if (from && Number.isNaN(Date.parse(from))) {
            return reply.code(400).send({ message: "Paramètre 'from' invalide." });
        }
        if (to && Number.isNaN(Date.parse(to))) {
            return reply.code(400).send({ message: "Paramètre 'to' invalide." });
        }

        const summary = await partenariatService.getSummaryByPartner({
            companyId,
            partnerId,
            from,
            to,
            includeEmployees,
        });

        return reply.code(200).send(summary);
    } catch (err) {
        return handleControllerError(reply, err, "Impossible de charger le résumé hebdomadaire.");
    }
}


/* ========================================================================== */
/* 🧮 CALCULATEUR DE PAIE POUR LE MOTEUR DE RÉMUNÉRATION                     */
/* ========================================================================== */

async function calculatePartnerServiceRemuneration({ companyId, period, config, context = {} }) {
    return partenariatService.calculatePartnerServiceRemuneration({
        companyId,
        period,
        config,
        context
    });
}

/* ============================================================================
   WIDGET : Mes services rendus
   ============================================================================
*/
async function getWidget_MyServices(req, reply) {
    try {
        const companyId = Number(req.headers["x-company-id"]);
        const userId = req.user?.userId;

        if (!companyId) return reply.code(400).send({ message: "Missing company" });

        const items = await prisma.partnerServiceRendered.findMany({
            where: { companyId, userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                partner: true,
                serviceType: true
            }
        });

        return items.map(i => ({
            id: i.id,
            partner: i.partner?.name ?? "Partenaire",
            service: i.serviceType?.name ?? "Service",
            quantity: i.quantity,
            pricePerUnit: i.price ?? 0,
            amount: i.amount ?? 0,
            createdAt: i.createdAt
        }));

    } catch (err) {
        console.error("Widget MyServices error:", err);
        return reply.code(500).send({ message: "Erreur interne (widget)" });
    }
}

async function deleteServiceRenderedHandler(req, reply) {
    try {
        const companyId = Number(req.headers["x-company-id"]);
        const id = Number(req.params.serviceRenderedId);

        const existing = await prisma.partnerServiceRendered.findFirst({
            where: { id, companyId }
        });

        if (!existing)
            return reply.code(404).send({ message: "Service rendu introuvable" });

        await prisma.partnerServiceRendered.delete({ where: { id } });

        return { success: true };
    } catch (err) {
        console.error("Delete serviceRendered error:", err);
        reply.code(500).send({ message: "Erreur interne." });
    }
};

/* ========================================================================== */
/* 📦 EXPORTS                                                                 */
/* ========================================================================== */

module.exports = {
    // Partenaires
    createPartnerHandler,
    updatePartnerHandler,
    deactivatePartnerHandler,
    activatePartnerHandler,
    listPartnersHandler,
    getPartnerByIdHandler,

    // Services des partenaires
    createPartnerServiceTypeHandler,
    updatePartnerServiceTypeHandler,
    deactivatePartnerServiceTypeHandler,
    activatePartnerServiceTypeHandler,
    listPartnerServiceTypesHandler,
    listAllActiveServicesForCompanyHandler,
    listAllServicesRenderedHandler,
    listPartnerServiceTypesForWidgetHandler,

    // Services rendus
    createServiceRenderedHandler,
    updateServiceRenderedHandler,
    listServicesRenderedHandler,
    deleteServiceRenderedHandler,

    // Résumé
    getWeeklySummaryHandler,

    // Calculateur rémunération
    calculatePartnerServiceRemuneration,

    // Widgets
    getWidget_MyServices,
};
