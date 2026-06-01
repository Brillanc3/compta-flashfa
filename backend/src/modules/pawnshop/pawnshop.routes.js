// backend/src/modules/pawnshop/pawnshop.routes.js

const controller = require("./pawnshop.controller");
const { PERMISSIONS, HIERARCHY } = require("./pawnshop.permissions");
const { buildEffectiveCompanyPermissions, hasPermission } = require("../../middleware/auth");

function parseCompanyId(request) {
    const rawCompanyId = request.headers["x-company-id"] ?? request.params?.companyId ?? request.params?.company_id;
    const companyId = Number(rawCompanyId);
    return rawCompanyId && Number.isFinite(companyId) && companyId > 0 ? companyId : null;
}

function allowIfAnyPermission(permissionTemplates, hierarchy = {}) {
    return async (request, reply) => {
        try {
            const companyId = parseCompanyId(request);
            if (!companyId) {
                return reply.code(400).send({ message: "Header 'x-company-id' manquant ou invalide." });
            }

            request.companyId = companyId;

            const userId = request.user?.userId;
            if (!userId) {
                return reply.code(401).send({ message: "Non authentifié." });
            }

            const userPermissions = await buildEffectiveCompanyPermissions(userId, companyId);

            if (userPermissions.has(`COMPANY.${companyId}.*`) || userPermissions.has("ADMIN.*")) {
                return;
            }

            const resolvedPermissions = permissionTemplates
                .filter(Boolean)
                .map((perm) => String(perm).replaceAll("{companyId}", String(companyId)));

            const allowed = resolvedPermissions.some((perm) => hasPermission(userPermissions, perm, hierarchy));
            if (allowed) {
                return;
            }

            return reply.code(403).send({
                message: `Accès interdit: une des permissions suivantes est requise (${resolvedPermissions.join(", ")}).`,
            });
        } catch (error) {
            console.error("[pawnshop] permission guard error:", error?.message || error);
            return reply.code(500).send({ message: "Erreur lors de la vérification des permissions." });
        }
    };
}

const canViewPurchases = async (request, reply) => {
    try {
        const companyId = parseCompanyId(request);

        if (!companyId) {
            return reply.code(400).send({ message: "Header 'x-company-id' manquant ou invalide." });
        }

        request.companyId = companyId;

        const userId = request.user?.userId;
        if (!userId) {
            return reply.code(401).send({ message: "Non authentifié." });
        }

        // Permissions effectives (user + rôles + rang d’entreprise)
        const userPermissions = await buildEffectiveCompanyPermissions(userId, companyId);

        // Gérant de l’entreprise -> bypass générique
        if (userPermissions.has(`COMPANY.${companyId}.*`) || userPermissions.has("ADMIN.*")) {
            request.purchaseViewMode = "ALL";
            return;
        }

        const permViewAll = PERMISSIONS.PURCHASES_VIEW_ALL.replace("{companyId}", String(companyId));
        const permViewSelf = PERMISSIONS.PURCHASES_VIEW_SELF.replace("{companyId}", String(companyId));

        // 1) ALL
        if (hasPermission(userPermissions, permViewAll, HIERARCHY)) {
            request.purchaseViewMode = "ALL";
            return;
        }

        // 2) SELF
        if (hasPermission(userPermissions, permViewSelf, HIERARCHY)) {
            request.purchaseViewMode = "SELF";
            return;
        }

        // 3) Rien -> 403
        return reply.code(403).send({
            message: "Accès interdit : Vous n'avez pas la permission de voir les feuilles d'achat.",
        });
    } catch (error) {
        console.error("[pawnshop] canViewPurchases error:", error?.message || error);
        return reply.code(500).send({ message: "Erreur lors de la vérification des permissions." });
    }
};

async function pawnshopRoutes(fastify, options) {
    const { authenticate, checkModuleAccess, checkPermission } = options.authMiddleware;

    // ---------------------------------------------------------------------------
    fastify.addHook("preHandler", authenticate);

    const moduleGuard = [
        checkModuleAccess("Pawnshop"),
        checkPermission(PERMISSIONS.ACCESS, HIERARCHY),
    ];

    const canReadPawnshopClients = allowIfAnyPermission(
        [
            PERMISSIONS.PURCHASES_CREATE,
            PERMISSIONS.CLIENTS_CREATE,
            PERMISSIONS.CLIENTS_UPDATE,
            PERMISSIONS.CLIENTS_MANAGE,
        ],
        HIERARCHY
    );

    const canReadPartnersForPurchase = allowIfAnyPermission(
        [PERMISSIONS.PURCHASES_CREATE, PERMISSIONS.PARTNERS_VIEW, PERMISSIONS.PARTNERS_MANAGE],
        HIERARCHY
    );

    const canReadPurchaseCatalog = allowIfAnyPermission(
        [PERMISSIONS.PURCHASES_CREATE, PERMISSIONS.PRODUCTS_VIEW, PERMISSIONS.PRODUCTS_MANAGE],
        HIERARCHY
    );

    // ---------------------------------------------------------------------------
    // Public page config (admin)
    // ---------------------------------------------------------------------------
    const publicPageGuard = allowIfAnyPermission([PERMISSIONS.PUBLIC_PAGE_MANAGE], HIERARCHY);
    fastify.get("/public-page", { preHandler: [...moduleGuard, publicPageGuard] }, controller.getPublicPageConfig);
    fastify.put("/public-page", { preHandler: [...moduleGuard, publicPageGuard] }, controller.updatePublicPageConfig);

    // ---------------------------------------------------------------------------
    // Purchases
    // ---------------------------------------------------------------------------
    fastify.get(
        "/purchases",
        {
            preHandler: [...moduleGuard, canViewPurchases],
        },
        controller.listPurchases
    );

    fastify.post(
        "/purchases",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.PURCHASES_CREATE, HIERARCHY)],
        },
        controller.createPurchase
    );

    fastify.get(
        "/purchases/:id",
        {
            preHandler: [...moduleGuard, canViewPurchases],
        },
        controller.getPurchase
    );

    fastify.patch(
        "/purchases/:id",
        {
            preHandler: [
                ...moduleGuard,
                canViewPurchases,
                checkPermission(PERMISSIONS.PURCHASES_UPDATE, HIERARCHY),
            ],
        },
        controller.updatePurchase
    );

    fastify.delete(
        "/purchases/:id",
        {
            preHandler: [
                ...moduleGuard,
                canViewPurchases,
                checkPermission(PERMISSIONS.PURCHASES_DELETE, HIERARCHY),
            ],
        },
        controller.deletePurchase
    );

    fastify.post(
        "/purchases/:id/items",
        {
            preHandler: [
                ...moduleGuard,
                canViewPurchases,
                checkPermission(PERMISSIONS.PURCHASES_UPDATE, HIERARCHY),
            ],
        },
        controller.addPurchaseItem
    );

    fastify.patch(
        "/purchases/:id/items/:itemId",
        {
            preHandler: [
                ...moduleGuard,
                canViewPurchases,
                checkPermission(PERMISSIONS.PURCHASES_UPDATE, HIERARCHY),
            ],
        },
        controller.updatePurchaseItem
    );

    fastify.delete(
        "/purchases/:id/items/:itemId",
        {
            preHandler: [
                ...moduleGuard,
                canViewPurchases,
                checkPermission(PERMISSIONS.PURCHASES_UPDATE, HIERARCHY),
            ],
        },
        controller.deletePurchaseItem
    );

    fastify.post(
        "/purchases/:id/validate",
        {
            preHandler: [
                ...moduleGuard,
                canViewPurchases,
                checkPermission(PERMISSIONS.PURCHASES_VALIDATE, HIERARCHY),
            ],
        },
        controller.validatePurchase
    );

    fastify.post(
        "/purchases/:id/cancel",
        {
            preHandler: [
                ...moduleGuard,
                canViewPurchases,
                checkPermission(PERMISSIONS.PURCHASES_CANCEL, HIERARCHY),
            ],
        },
        controller.cancelPurchase
    );

    fastify.post(
        "/purchases/:id/mark-paid",
        {
            preHandler: [
                ...moduleGuard,
                canViewPurchases,
                checkPermission(PERMISSIONS.PURCHASES_MARK_PAID, HIERARCHY),
            ],
        },
        controller.markPurchasePaid
    );

    fastify.post(
        "/purchases/:id/change-owner",
        {
            preHandler: [
                ...moduleGuard,
                canViewPurchases,
                checkPermission(PERMISSIONS.PURCHASES_CHANGE_OWNER, HIERARCHY),
            ],
        },
        controller.changeOwner
    );

    fastify.delete(
        "/purchases/:id/canceled",
        {
            preHandler: [
                ...moduleGuard,
                canViewPurchases,
                checkPermission(PERMISSIONS.PURCHASES_DELETE_CANCELED, HIERARCHY),
            ],
        },
        controller.deleteCanceledPurchase
    );

    fastify.get(
        "/purchases/stats/by-employee",
        {
            preHandler: [
                ...moduleGuard,
                checkPermission(PERMISSIONS.PURCHASES_VIEW_ALL, HIERARCHY),
            ],
        },
        controller.getPurchaseStatsByEmployee
    );

    fastify.get(
        "/widgets/pawnshop_employee_ranking",
        {
            preHandler: [
                ...moduleGuard,
                checkPermission(PERMISSIONS.PURCHASES_VIEW_ALL, HIERARCHY),
            ],
        },
        controller.getWidgetData_PawnshopEmployeeRanking
    );

    // ---------------------------------------------------------------------------
    // Clients (lecture minimale pour le flow CREATE PURCHASE)
    // ---------------------------------------------------------------------------
    fastify.get(
        "/clients",
        {
            preHandler: [...moduleGuard, canReadPawnshopClients],
        },
        controller.listClients
    );

    fastify.get(
        "/clients/:id",
        {
            preHandler: [...moduleGuard, canReadPawnshopClients],
        },
        controller.getClient
    );

    fastify.post(
        "/clients",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.CLIENTS_CREATE, HIERARCHY)],
        },
        controller.createClient
    );

    fastify.patch(
        "/clients/:id",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.CLIENTS_UPDATE, HIERARCHY)],
        },
        controller.updateClient
    );

    fastify.post(
        "/clients/:id/cni",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.CLIENTS_UPLOAD_CNI, HIERARCHY)],
        },
        controller.uploadClientCni
    );

    fastify.delete(
        "/clients/:id/cni",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.CLIENTS_UPLOAD_CNI, HIERARCHY)],
        },
        controller.deleteClientCni
    );

    fastify.get(
        "/clients/:id/cni",
        {
            preHandler: [...moduleGuard, canReadPawnshopClients],
        },
        controller.serveClientCni
    );

    // ---------------------------------------------------------------------------
    // Estimations
    // ---------------------------------------------------------------------------
    fastify.get(
        "/estimations",
        {
            preHandler: [
                ...moduleGuard,
                canViewPurchases,
                checkPermission(PERMISSIONS.ESTIMATIONS_VIEW, HIERARCHY),
            ],
        },
        controller.listEstimations
    );

    fastify.post(
        "/estimations",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.ESTIMATIONS_CREATE, HIERARCHY)],
        },
        controller.createEstimation
    );

    fastify.get(
        "/estimations/:id",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.ESTIMATIONS_VIEW, HIERARCHY)],
        },
        controller.getEstimation
    );

    fastify.patch(
        "/estimations/:id",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.ESTIMATIONS_MANAGE, HIERARCHY)],
        },
        controller.updateEstimation
    );

    fastify.post(
        "/estimations/:id/items",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.ESTIMATIONS_MANAGE, HIERARCHY)],
        },
        controller.addEstimationItem
    );

    fastify.delete(
        "/estimations/:id/items/:itemId",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.ESTIMATIONS_MANAGE, HIERARCHY)],
        },
        controller.deleteEstimationItem
    );

    fastify.post(
        "/estimations/:id/reject",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.ESTIMATIONS_MANAGE, HIERARCHY)],
        },
        controller.rejectEstimation
    );

    fastify.post(
        "/estimations/:id/convert",
        {
            preHandler: [
                ...moduleGuard,
                canViewPurchases,
                checkPermission(PERMISSIONS.ESTIMATIONS_MANAGE, HIERARCHY),
                checkPermission(PERMISSIONS.PURCHASES_CREATE, HIERARCHY),
            ],
        },
        controller.convertEstimation
    );

    // ---------------------------------------------------------------------------
    // Products
    // ---------------------------------------------------------------------------
    fastify.get(
        "/products",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.PRODUCTS_VIEW, HIERARCHY)],
        },
        controller.listProducts
    );

    fastify.get(
        "/products/purchase-catalog",
        {
            preHandler: [...moduleGuard, canReadPurchaseCatalog],
        },
        controller.listPurchaseCatalog
    );

    fastify.post(
        "/products",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.PRODUCTS_MANAGE, HIERARCHY)],
        },
        controller.createProduct
    );

    fastify.patch(
        "/products/:id",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.PRODUCTS_MANAGE, HIERARCHY)],
        },
        controller.updateProduct
    );

    fastify.delete(
        "/products/:id",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.PRODUCTS_MANAGE, HIERARCHY)],
        },
        controller.deleteProduct
    );

    // ---------------------------------------------------------------------------
    // Partners
    // ---------------------------------------------------------------------------
    fastify.get(
        "/partners",
        {
            preHandler: [...moduleGuard, canReadPartnersForPurchase],
        },
        controller.listPartners
    );

    fastify.post(
        "/partners",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.PARTNERS_MANAGE, HIERARCHY)],
        },
        controller.createPartner
    );

    fastify.patch(
        "/partners/:id",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.PARTNERS_MANAGE, HIERARCHY)],
        },
        controller.updatePartner
    );

    fastify.delete(
        "/partners/:id",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.PARTNERS_MANAGE, HIERARCHY)],
        },
        controller.deletePartner
    );

    // ---------------------------------------------------------------------------
    // Partner buy prices
    // ---------------------------------------------------------------------------
    fastify.get(
        "/partners/:id/prices",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.PARTNER_PRICES_VIEW, HIERARCHY)],
        },
        controller.getPartnerPrices
    );

    fastify.put(
        "/partners/:id/prices",
        {
            preHandler: [...moduleGuard, checkPermission(PERMISSIONS.PARTNER_PRICES_MANAGE, HIERARCHY)],
        },
        controller.putPartnerPrices
    );
}

module.exports = {
    name: "pawnshop",
    isDefault: false,
    routes: pawnshopRoutes,

    payments: [
        {
            key: "pawnshopProductRemunerations",
            label: "Rémunération Pawnshop par produit",
            type: "matrix",
            description:
                "Configure la rémunération: montant fixe par unité + commission (%) sur le total revente (prix de revente * quantité).",
            source: { type: "api", url: "/pawnshop/products", labelField: "name", valueField: "id" },
            columns: [
                { key: "visible", label: "Visible", type: "boolean", default: true },
                { key: "fixed", label: "Montant fixe ($/unité)", type: "number", min: 0, max: 100000, step: 0.01, default: 0 },
                { key: "percent", label: "Commission (%) sur revente", type: "number", min: 0, max: 100, step: 0.001, default: 0 },
            ],
        },
    ],

    salaryCalculators: [
        {
            key: "pawnshopProductRemunerations",
            serviceFunction: "calculatePawnshopProductRemuneration",
            drawingDetails: {
                label: "Commissions Pawnshop (produits)",
                template: "{fixed} $/u + {percent}% (revente) = {calculatedValue} $",
            },
        },
    ],
};
