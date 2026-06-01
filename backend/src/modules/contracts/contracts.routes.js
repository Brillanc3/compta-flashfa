// /backend/src/modules/contracts/contracts.routes.js

const controller = require("./contracts.controller");
const { PERMISSIONS, HIERARCHY } = require("./contracts.permissions");

async function contractsRoutes(fastify, options) {
    const auth = options?.authMiddleware || {};
    const authenticate = auth.authenticate || (req => Promise.resolve());
    const checkPermission = auth.checkPermission || (() => () => (req, reply, done) => done());
    const checkModuleAccess = auth.checkModuleAccess || (() => (req, reply, done) => done());

    async function ensureContractsModuleIfCompanyScope(req, reply) {
        const companyId = Number.parseInt(req.headers["x-company-id"], 10);
        if (!Number.isInteger(companyId) || companyId <= 0) {
            return;
        }

        await checkModuleAccess("Contracts")(req, reply);
    }

    async function ensureSharesPermissionIfCompanyScope(req, reply) {
        const companyId = Number.parseInt(req.headers["x-company-id"], 10);
        if (!Number.isInteger(companyId) || companyId <= 0) {
            return;
        }

        await checkPermission(PERMISSIONS.SHARES, HIERARCHY)(req, reply);
    }

    fastify.get("/public/:publicId/meta", controller.getPublicContractShareMetaHandler);
    fastify.post("/public/:publicId/access", controller.accessPublicContractShareHandler);

    fastify.post(
        "/templates",
        {
            preHandler: [
                authenticate,
                checkModuleAccess("Contracts"),
                checkPermission(PERMISSIONS.TEMPLATE_CREATE, HIERARCHY)
            ]
        },
        controller.createTemplateHandler
    );

    fastify.put(
        "/templates/:templateId/articles",
        {
            preHandler: [
                authenticate,
                checkModuleAccess("Contracts"),
                checkPermission(PERMISSIONS.TEMPLATE_ARTICLE_MANAGE, HIERARCHY)
            ]
        },
        controller.updateArticlesHandler
    );

    fastify.get(
        "/templates/:templateId",
        {
            preHandler: [
                authenticate,
                checkModuleAccess("Contracts"),
                checkPermission(PERMISSIONS.TEMPLATE_VIEW, HIERARCHY)
            ]
        },
        controller.getTemplateHandler
    );

    fastify.put(
        "/templates/:templateId",
        {
            preHandler: [
                authenticate,
                checkModuleAccess("Contracts"),
                checkPermission(PERMISSIONS.TEMPLATE_UPDATE, HIERARCHY)
            ]
        },
        controller.updateTemplateHandler
    );

    fastify.get(
        "/templates",
        {
            preHandler: [
                authenticate,
                checkModuleAccess("Contracts"),
                checkPermission(PERMISSIONS.TEMPLATE_LIST, HIERARCHY)
            ]
        },
        controller.listTemplatesHandler
    );

    fastify.post(
        "/assign",
        {
            preHandler: [
                authenticate,
                checkModuleAccess("Contracts"),
                checkPermission(PERMISSIONS.ASSIGN, HIERARCHY)
            ]
        },
        controller.assignContractHandler
    );

    fastify.get(
        "/shares",
        {
            preHandler: [
                authenticate,
                ensureContractsModuleIfCompanyScope,
                ensureSharesPermissionIfCompanyScope
            ]
        },
        controller.listContractSharesHandler
    );

    fastify.post(
        "/shares",
        {
            preHandler: [
                authenticate,
                ensureContractsModuleIfCompanyScope,
                ensureSharesPermissionIfCompanyScope
            ]
        },
        controller.createContractShareHandler
    );

    fastify.get(
        "/shares/:shareId",
        {
            preHandler: [
                authenticate,
                ensureContractsModuleIfCompanyScope,
                ensureSharesPermissionIfCompanyScope
            ]
        },
        controller.getManagedContractShareHandler
    );

    fastify.delete(
        "/shares/:shareId",
        {
            preHandler: [
                authenticate,
                ensureContractsModuleIfCompanyScope,
                ensureSharesPermissionIfCompanyScope
            ]
        },
        controller.deleteContractShareHandler
    );

    fastify.put(
        "/shares/:shareId/password",
        {
            preHandler: [
                authenticate,
                ensureContractsModuleIfCompanyScope,
                ensureSharesPermissionIfCompanyScope
            ]
        },
        controller.updateContractSharePasswordHandler
    );

    fastify.post(
        "/shares/:shareId/activate",
        {
            preHandler: [
                authenticate,
                ensureContractsModuleIfCompanyScope,
                ensureSharesPermissionIfCompanyScope
            ]
        },
        controller.activateContractShareHandler
    );

    fastify.post(
        "/shares/:shareId/regenerate",
        {
            preHandler: [
                authenticate,
                ensureContractsModuleIfCompanyScope,
                ensureSharesPermissionIfCompanyScope
            ]
        },
        controller.regenerateContractShareHandler
    );

    fastify.post(
        "/shares/:shareId/revoke",
        {
            preHandler: [
                authenticate,
                ensureContractsModuleIfCompanyScope,
                ensureSharesPermissionIfCompanyScope
            ]
        },
        controller.revokeContractShareHandler
    );

    fastify.get(
        "/assigned",
        {
            preHandler: [
                authenticate,
                checkModuleAccess("Contracts"),
                async (req, reply) => {
                    await checkPermission(PERMISSIONS.COMPANY_ASSIGNMENTS_VIEW, HIERARCHY)(req, reply);
                }
            ]
        },
        controller.listCompanyContractsHandler
    );

    fastify.post(
        "/templates/:templateId/fields",
        {
            preHandler: [
                authenticate,
                checkModuleAccess("Contracts"),
                checkPermission(PERMISSIONS.TEMPLATE_UPDATE, HIERARCHY)
            ]
        },
        controller.createTemplateFieldHandler
    );

    fastify.patch(
        "/templates/:templateId/fields/:fieldId",
        {
            preHandler: [
                authenticate,
                checkModuleAccess("Contracts"),
                checkPermission(PERMISSIONS.TEMPLATE_UPDATE, HIERARCHY)
            ]
        },
        controller.updateTemplateFieldHandler
    );

    fastify.delete(
        "/templates/:templateId/fields/:fieldId",
        {
            preHandler: [
                authenticate,
                checkModuleAccess("Contracts"),
                checkPermission(PERMISSIONS.TEMPLATE_UPDATE, HIERARCHY)
            ]
        },
        controller.deleteTemplateFieldHandler
    );

    fastify.get("/assigned/self", { preHandler: [authenticate] }, controller.listMyContractsHandler);
    fastify.get("/assigned/me", { preHandler: [authenticate] }, controller.listMyContractsHandler);
    fastify.get("/assigned/:assignedContractId", { preHandler: [authenticate] }, controller.getAssignedContractHandler);

    fastify.post(
        "/assigned/:assignedContractId/sign",
        {
            preHandler: [authenticate]
        },
        controller.signAssignedContractHandler
    );

    fastify.post(
        "/assigned/:assignedContractId/reject",
        {
            preHandler: [authenticate]
        },
        controller.rejectAssignedContractHandler
    );
}

module.exports = {
    name: "contracts",
    routes: contractsRoutes,
};
