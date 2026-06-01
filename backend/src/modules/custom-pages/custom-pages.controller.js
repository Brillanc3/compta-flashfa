// /backend/src/modules/customPage/customPage.controller.js

const customPageService = require("./custom-pages.service");

/**
 * Validation stricte du header x-company-id.
 * - Doit exister
 * - Doit être une string non vide
 * - Doit être un entier positif (format "123")
 * Retourne un Number.
 */
function getCompanyIdOrThrow(req) {
    const raw = req.headers["x-company-id"];

    console.log("getCompanyIdOrThrow in customPagesService");

    // Fastify: header peut être string | string[] | undefined
    if (typeof raw !== "string") {
        const err = new Error("Missing or invalid x-company-id header");
        err.statusCode = 400;
        throw err;
    }

    const trimmed = raw.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
        const err = new Error("Missing or invalid x-company-id header");
        err.statusCode = 400;
        throw err;
    }

    const companyId = Number(trimmed);
    if (!Number.isSafeInteger(companyId) || companyId <= 0) {
        const err = new Error("Missing or invalid x-company-id header");
        err.statusCode = 400;
        throw err;
    }

    console.log("getCompanyIdOrThrow in customPagesService, return companyId ", companyId);

    return companyId;
}

function asyncHandler(fn) {
    return async (request, reply) => {
        try {
            await fn(request, reply);
        } catch (err) {
            // Fastify standard: on renvoie l'erreur pour être gérée par le handler global
            throw err;
        }
    };
}

function parseIdOr400(request, reply) {
    const id = Number(request.params?.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
        reply.code(400).send({ message: "Invalid id" });
        return null;
    }
    return id;
}

module.exports = {
    list: asyncHandler(async (request, reply) => {
        const companyId = getCompanyIdOrThrow(request);
        console.log('module.exports.list.user', request.user);
        const result = await customPageService.list({
            companyId,
            user: request.user,
            query: request.query,
        });

        reply.send(result);
    }),

    getById: asyncHandler(async (request, reply) => {
        const companyId = getCompanyIdOrThrow(request);

        const id = parseIdOr400(request, reply);
        if (!id) return;

        const result = await customPageService.getById({
            companyId,
            user: request.user,
            id,
            include: request.query,
        });

        reply.send(result);
    }),

    getBySlug: asyncHandler(async (request, reply) => {
        const companyId = getCompanyIdOrThrow(request);

        const slug = String(request.params?.slug || "").trim();
        if (!slug) return reply.code(400).send({ message: "Invalid slug" });

        const result = await customPageService.getBySlug({
            companyId,
            user: request.user,
            slug,
            include: request.query,
        });

        reply.send(result);
    }),

    create: asyncHandler(async (request, reply) => {
        const companyId = getCompanyIdOrThrow(request);

        const payload = request.body || {};
        const result = await customPageService.create({
            companyId,
            user: request.user,
            payload,
        });

        reply.code(201).send(result);
    }),

    getPublishedNav: asyncHandler(async  (request, reply) => {
        // x-company-id strict
        const raw = request.headers["x-company-id"];
        if (typeof raw !== "string" || !raw.trim() || !/^\d+$/.test(raw.trim())) {
            return reply.code(400).send({ message: "Missing or invalid x-company-id header" });
        }

        const companyId = Number(raw.trim());
        if (!Number.isInteger(companyId) || companyId <= 0) {
            return reply.code(400).send({ message: "Missing or invalid x-company-id header" });
        }

        const result = await customPageService.listPublishedNav({
            companyId,
            user: request.user,
        });

        return reply.send(result);
    }),

    /**
     * UPDATE SETTINGS (slug/title/type/sidebar meta) sans toucher le contenu
     */
    updateSettings: asyncHandler(async (request, reply) => {
        const companyId = getCompanyIdOrThrow(request);

        const id = parseIdOr400(request, reply);
        if (!id) return;

        const payload = request.body || {};
        const result = await customPageService.updateSettings({
            companyId,
            user: request.user,
            id,
            payload,
        });

        reply.send(result);
    }),

    /**
     * UPDATE DRAFT (contenu)
     */
    updateDraft: asyncHandler(async (request, reply) => {
        const companyId = getCompanyIdOrThrow(request);

        const id = parseIdOr400(request, reply);
        if (!id) return;

        const payload = request.body || {};
        const result = await customPageService.updateDraft({
            companyId,
            user: request.user,
            id,
            payload,
        });

        reply.send(result);
    }),

    publish: asyncHandler(async (request, reply) => {
        const companyId = getCompanyIdOrThrow(request);

        const id = parseIdOr400(request, reply);
        if (!id) return;

        const result = await customPageService.publish({
            companyId,
            user: request.user,
            id,
        });

        reply.send(result);
    }),

    updateAccess: asyncHandler(async (request, reply) => {
        const companyId = getCompanyIdOrThrow(request);

        const id = parseIdOr400(request, reply);
        if (!id) return;

        const payload = request.body || {};
        const result = await customPageService.updateAccess({
            companyId,
            user: request.user,
            id,
            payload,
        });

        reply.send(result);
    }),

    remove: asyncHandler(async (request, reply) => {
        const companyId = getCompanyIdOrThrow(request);

        const id = parseIdOr400(request, reply);
        if (!id) return;

        await customPageService.remove({
            companyId,
            user: request.user,
            id,
        });

        reply.code(204).send();
    }),
};
