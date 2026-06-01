// backend/src/services/dashboardService.js

const prisma = require('../db');
const { hasWildcardPermission: checkUserPermission } = require('../middleware/auth');

/**
 * Récupère et filtre les définitions de widgets en fonction du contexte et des permissions de l'utilisateur.
 */
async function getFilteredWidgetDefinitions(userId, contextId, contextType) {
    const allDefinitions = await prisma.widgetDefinition.findMany();

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { permissions: true, roles: { include: { permissions: true } } }
    });

    if (!user) return [];

    const userPermissions = new Set();
    user.permissions.forEach(p => userPermissions.add(p.action));
    user.roles.forEach(role => role.permissions.forEach(p => userPermissions.add(p.action)));

    const availableWidgets = allDefinitions.filter(def => {
        if (def.targetContext !== contextType) {
            return false;
        }

        const requiredPermissions = Array.isArray(def.requiredPermission) ? def.requiredPermission : [];
        if (requiredPermissions.length === 0) {
            return true;
        }

        return requiredPermissions.some(template => {
            let requiredPermission = template;
            if (contextType === 'COMPANY' && template.includes('{id}')) {
                requiredPermission = template.replace('{id}', contextId);
            }
            return checkUserPermission(userPermissions, requiredPermission);
        });
    });

    return availableWidgets;
}

/**
 * Récupère la disposition de widgets sauvegardée par l'utilisateur.
 */
async function getUserDashboardLayout({ userId, companyId, contextType }) {
    const whereClause = {
        userId: userId,
        companyId: companyId,
        widgetDefinition: {
            targetContext: {
                in: [contextType, 'GLOBAL']
            },
        },
    };

    const widgets = await prisma.userWidget.findMany({
        where: whereClause,
        include: { widgetDefinition: true },
    });

    return widgets.map(widget => {
        try {
            return {
                ...widget,
                layout: JSON.parse(widget.layout),
                config: widget.config ? JSON.parse(widget.config) : {},
            };
        } catch (e) {
            console.error(`Impossible de parser le layout/config pour le widget ID ${widget.id}`, e);
            return { ...widget, layout: {}, config: {} };
        }
    });
}

/**
 * Sauvegarde la disposition actuelle des widgets.
 */
async function saveUserDashboardLayout({ userId, companyId, contextType, widgets }) {
    const currentWidgetIds = widgets.map(w => w.id).filter(id => typeof id === 'number' && id > 0);

    await prisma.userWidget.deleteMany({
        where: {
            userId: userId,
            companyId: companyId,
            id: { notIn: currentWidgetIds },
            widgetDefinition: {
                targetContext: {
                    in: [contextType, 'GLOBAL']
                }
            }
        }
    });

    const upsertPromises = widgets.map(widget => {
        const widgetData = {
            // --- CORRECTION : On convertit les objets en chaînes JSON ---
            layout: JSON.stringify(widget.layout),
            config: JSON.stringify(widget.config || {}),
        };

        return prisma.userWidget.upsert({
            where: { id: widget.id || -1 }, // Utilise -1 pour forcer la création si l'ID est absent/nouveau
            update: widgetData,
            create: {
                ...widgetData,
                userId: userId,
                companyId: companyId,
                widgetDefinitionId: widget.widgetDefinitionId,
            },
        });
    });

    await Promise.all(upsertPromises);
}

/**
 * Récupère les données de transaction pour un widget.
 */
async function getTransactionLogData(companyId, config) {
    const { transactionCount = 10, groupBy, startDate, endDate } = config;

    const where = {
        companyId: companyId,
        ...(startDate && endDate && { createdAt: { gte: new Date(startDate), lte: new Date(endDate) } }),
    };

    // La logique pour la vue TABLEAU reste inchangée
    if (config.variantType === 'TABLE_VIEW') {
        return prisma.transaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(transactionCount, 10),
            include: { category: true },
        });
    }

    // --- BLOC MODIFIÉ POUR LA VUE GRAPHIQUE ---
    const transactions = await prisma.transaction.findMany({ where, include: { category: true } });

    // 1. Agréger les données comme avant
    const aggregatedData = transactions.reduce((acc, tx) => {
        const key = groupBy === 'TYPE' ? tx.category.type : tx.category.name;
        if (!acc[key]) acc[key] = 0;
        acc[key] += tx.amount.toNumber();
        return acc;
    }, {});

    // 2. Formater les données pour correspondre aux attentes du frontend
    const labels = Object.keys(aggregatedData);
    const data = Object.values(aggregatedData);

    return { labels, data };
    // --- FIN DU BLOC MODIFIÉ ---
}

module.exports = {
    getFilteredWidgetDefinitions,
    getUserDashboardLayout,
    saveUserDashboardLayout,
    getTransactionLogData
};