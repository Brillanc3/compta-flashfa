// /backend/src/modules/customPage/customPage.routes.js

const authMiddleware = require("../../middleware/auth");
const customPageController = require("./custom-pages.controller");
const { PERMISSIONS, HIERARCHY } = require("./custom-pages.permissions");

const MODULE_NAME = "custom-pages";

async function customPageRoutes(fastify) {
    const { authenticate, checkPermission, checkModuleAccess } = authMiddleware;

    const moduleGuard = checkModuleAccess(MODULE_NAME);

    // LIST
    fastify.get(
        "",
        {
            preHandler: [authenticate, moduleGuard, checkPermission(PERMISSIONS.VIEW, HIERARCHY)],
        },
        customPageController.list
    );

    fastify.get(
        "/nav",
        {
            preHandler: [authenticate, moduleGuard],
        },
        customPageController.getPublishedNav
    );

    // GET BY ID
    fastify.get(
        "/:id",
        {
            preHandler: [authenticate, moduleGuard, checkPermission(PERMISSIONS.VIEW, HIERARCHY)],
        },
        customPageController.getById
    );

    // GET BY SLUG
    fastify.get(
        "/slug/:slug",
        {
            preHandler: [authenticate, moduleGuard, checkPermission(PERMISSIONS.VIEW, HIERARCHY)],
        },
        customPageController.getBySlug
    );

    // CREATE
    fastify.post(
        "",
        {
            preHandler: [authenticate, moduleGuard, checkPermission(PERMISSIONS.MANAGE, HIERARCHY)],
        },
        customPageController.create
    );

    // UPDATE SETTINGS (slug, title, sidebar meta, type) - sans toucher le contenu
    fastify.patch(
        "/:id/settings",
        {
            preHandler: [authenticate, moduleGuard, checkPermission(PERMISSIONS.MANAGE, HIERARCHY)],
        },
        customPageController.updateSettings
    );

    // UPDATE DRAFT (contenu)
    fastify.patch(
        "/:id/draft",
        {
            preHandler: [authenticate, moduleGuard, checkPermission(PERMISSIONS.MANAGE, HIERARCHY)],
        },
        customPageController.updateDraft
    );

    // PUBLISH
    fastify.post(
        "/:id/publish",
        {
            preHandler: [authenticate, moduleGuard, checkPermission(PERMISSIONS.PUBLISH, HIERARCHY)],
        },
        customPageController.publish
    );

    // UPDATE ACCESS (ACL)
    fastify.patch(
        "/:id/access",
        {
            preHandler: [authenticate, moduleGuard, checkPermission(PERMISSIONS.ACCESS_MANAGE, HIERARCHY)],
        },
        customPageController.updateAccess
    );

    // DELETE
    fastify.delete(
        "/:id",
        {
            preHandler: [authenticate, moduleGuard, checkPermission(PERMISSIONS.DELETE, HIERARCHY)],
        },
        customPageController.remove
    );
}

module.exports = {
    name: MODULE_NAME,
    isDefault: true,
    routes: customPageRoutes,
};
