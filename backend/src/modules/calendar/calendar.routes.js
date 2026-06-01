// /backend/src/modules/calendar/calendar.routes.js
const controller = require('./calendar.controller');
const { PERMISSIONS } = require('./calendar.permissions');
const { buildEffectiveCompanyPermissions, hasPermission } = require("../../middleware/auth");

function parseCompanyId(request) {
    const rawCompanyId = request.headers['x-company-id'];
    const companyId = Number(rawCompanyId);
    return rawCompanyId && Number.isFinite(companyId) && companyId > 0 ? companyId : null;
}

const canViewEvents = async (request, reply) => {
    const companyId = parseCompanyId(request);

    if (!companyId) {
        return reply.code(400).send({ message: "Header 'x-company-id' manquant ou invalide." });
    }

    request.companyId = companyId;

    const userId = request.user?.userId;
    if (!userId) {
        return reply.code(401).send({ message: 'Non authentifié.' });
    }

    const userPermissions = await buildEffectiveCompanyPermissions(userId, companyId);

    const permViewAll = PERMISSIONS.VIEW_ALL.replace('{companyId}', String(companyId));
    const permViewSelf = PERMISSIONS.VIEW_SELF.replace('{companyId}', String(companyId));

    const permManageAll = PERMISSIONS.MANAGE_ALL.replace('{companyId}', String(companyId));
    const permManageCategories = PERMISSIONS.MANAGE_CATEGORIES.replace('{companyId}', String(companyId));

    // ALL si on peut VIEW_ALL ou si on a des permissions de gestion qui impliquent la vue globale
    const canAll =
        hasPermission(userPermissions, permViewAll) ||
        hasPermission(userPermissions, permManageAll) ||
        hasPermission(userPermissions, permManageCategories);

    if (canAll) {
        request.calendarViewMode = 'ALL';
        return;
    }

    const canSelf = hasPermission(userPermissions, permViewSelf);

    if (canSelf) {
        request.calendarViewMode = 'SELF';
        return;
    }

    return reply.code(403).send({
        message: "Accès interdit : vous n'avez pas la permission de consulter les services.",
    });
};

async function calendarRoutes(fastify, options) {
    const { authenticate, checkPermission } = options.authMiddleware;

    fastify.addHook('preHandler', authenticate);

    const manageCategoriesOpts = { preHandler: [checkPermission(PERMISSIONS.MANAGE_CATEGORIES, undefined)] };
    const viewCalendar = { preHandler: [canViewEvents] };

    fastify.get('/events', viewCalendar, controller.getEvents);
    fastify.post('/events', controller.createEvent);
    fastify.put('/events/:eventId', controller.updateEvent);
    fastify.put('/events/:eventId/finish', controller.finishEvent);
    fastify.delete('/events/:eventId', controller.deleteEvent);

    fastify.get('/categories', controller.getCategories);
    fastify.post('/categories', manageCategoriesOpts, controller.createCategory);
    fastify.put('/categories/:categoryId', manageCategoriesOpts, controller.updateCategory);
    fastify.delete('/categories/:categoryId', manageCategoriesOpts, controller.deleteCategory);
}

module.exports = {
    name: 'calendar',
    isDefault: true,
    routes: calendarRoutes
};
