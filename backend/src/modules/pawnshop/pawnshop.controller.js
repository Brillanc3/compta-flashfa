// backend/src/modules/pawnshop/pawnshop.controller.js

const path = require("path");
const fs = require("fs");
const prisma = require("../../db");
const service = require("./pawnshop.service");
const { PERMISSIONS } = require("./pawnshop.permissions");

const UPLOADS_DIR = path.join(__dirname, "..", "..", "..", "uploads", "images");

function wildcardMatch(permsSet, target) {
    if (!target) return true;
    if (permsSet.has(target)) return true;
    for (const p of permsSet) {
        if (typeof p !== "string") continue;
        if (!p.endsWith(".*")) continue;
        const base = p.slice(0, -1);
        if (String(target).startsWith(base)) return true;
    }
    return false;
}

function getUserPerms(req) {
    const a = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    const b = Array.isArray(req.permissions) ? req.permissions : [];
    const c = Array.isArray(req.user?.perms) ? req.user.perms : [];
    return [...a, ...b, ...c].filter((x) => typeof x === "string");
}

function hasPermission(req, perm) {
    const set = new Set(getUserPerms(req));
    return wildcardMatch(set, perm);
}

function getCompanyId(req) {
    const candidates = [
        req.params?.companyId,
        req.params?.company_id,
        req.companyId,
        req.company?.id,
        req.user?.companyId,
        req.user?.company?.id,
        req.headers?.["x-company-id"],
    ];
    const v = candidates.find((x) => x !== undefined && x !== null && String(x).trim() !== "");
    const n = v != null ? Number.parseInt(String(v), 10) : NaN;
    if (!Number.isFinite(n) || n <= 0) {
        const err = new Error("Company introuvable dans la requête (companyId manquant).");
        err.statusCode = 400;
        err.code = "COMPANY_ID_REQUIRED";
        throw err;
    }
    return n;
}

async function getActorCompanyEmployeeId(req, companyId, { required = true } = {}) {
    const userId = Number(req?.user?.userId);

    if (!Number.isFinite(companyId) || companyId <= 0) {
        const err = new Error("companyId manquant ou invalide.");
        err.statusCode = 400;
        err.code = "COMPANY_ID_REQUIRED";
        throw err;
    }

    if (!Number.isFinite(userId) || userId <= 0) {
        const err = new Error("userId manquant ou invalide dans le token.");
        err.statusCode = 401;
        err.code = "USER_ID_REQUIRED";
        throw err;
    }

    const ce = await prisma.companyEmployee.findFirst({
        where: {
            companyId,
            userId,
            status: "ACTIVE",
        },
        select: { id: true },
    });

    if (!ce?.id) {
        if (!required) return null;
        const err = new Error(`Aucun employé actif trouvé pour userId=${userId} dans companyId=${companyId}.`);
        err.statusCode = 403;
        err.code = "COMPANY_EMPLOYEE_NOT_FOUND";
        throw err;
    }

    return ce.id;
}

function asInt(v, name, { nullable = false, min = 1 } = {}) {
    if (v === undefined || v === null || v === "") {
        if (nullable) return null;
        const err = new Error(`Champ '${name}' requis.`);
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        err.details = { field: name };
        throw err;
    }
    const n = Number.parseInt(String(v), 10);
    if (!Number.isFinite(n) || n < min) {
        const err = new Error(`Champ '${name}' invalide.`);
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        err.details = { field: name, value: v };
        throw err;
    }
    return n;
}

function asBool(v, def = false) {
    if (v === undefined || v === null || v === "") return def;
    if (typeof v === "boolean") return v;
    const s = String(v).toLowerCase().trim();
    if (["1", "true", "yes", "y", "on"].includes(s)) return true;
    if (["0", "false", "no", "n", "off"].includes(s)) return false;
    return def;
}

function asNumber(v, name, { nullable = false, min = 0 } = {}) {
    if (v === undefined || v === null || v === "") {
        if (nullable) return null;
        const err = new Error(`Champ '${name}' requis.`);
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        err.details = { field: name };
        throw err;
    }
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n) || n < min) {
        const err = new Error(`Champ '${name}' invalide.`);
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        err.details = { field: name, value: v };
        throw err;
    }
    return n;
}

function asString(v, { nullable = true } = {}) {
    if (v === undefined) return undefined;
    if (v === null) return nullable ? null : "";
    const s = String(v).trim();
    if (!s) return nullable ? null : "";
    return s;
}

function sendError(reply, e) {
    const statusCode = e?.statusCode || 500;
    const code = e?.code || "INTERNAL_ERROR";
    const message = statusCode === 500 ? "Erreur interne." : e?.message || "Erreur.";

    const payload = { error: code, message };
    if (e?.details) payload.details = e.details;

    reply.code(statusCode).send(payload);
}

async function listPurchases(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const canViewAll = req.purchaseViewMode === "ALL";
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId, { required: !canViewAll });

        const query = {
            status: req.query?.status,
            clientId: req.query?.clientId != null ? asInt(req.query.clientId, "clientId", { nullable: true }) : null,
            partnerId: req.query?.partnerId != null ? asInt(req.query.partnerId, "partnerId", { nullable: true }) : null,
            employeeId: req.query?.employeeId != null ? asInt(req.query.employeeId, "employeeId", { nullable: true }) : null,
            includeItems: asBool(req.query?.includeItems, false),
            page: req.query?.page != null ? asInt(req.query.page, "page", { nullable: true, min: 1 }) : null,
            pageSize: req.query?.pageSize != null ? asInt(req.query.pageSize, "pageSize", { nullable: true, min: 1 }) : null,
            cursor: req.query?.cursor ?? null,
            search: asString(req.query?.search) || null,
            dateStart: asString(req.query?.dateStart) || null,
            dateEnd: asString(req.query?.dateEnd) || null,
        };

        const data = await service.listPurchases({ companyId, actorEmployeeId, canViewAll, query });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function createPurchase(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId);

        const clientId = asInt(req.body?.clientId, "clientId");
        const partnerId = req.body?.partnerId != null ? asInt(req.body.partnerId, "partnerId", { nullable: true }) : null;
        const notes = asString(req.body?.notes) || null;

        const data = await service.createPurchase({ companyId, actorEmployeeId, clientId, partnerId, notes });
        reply.code(201).send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function getPurchase(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const canViewAll = req.purchaseViewMode === "ALL";
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId, { required: !canViewAll });
        const id = asInt(req.params?.id, "id");

        const data = await service.getPurchase({ companyId, actorEmployeeId, canViewAll, id });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function updatePurchase(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const canViewAll = req.purchaseViewMode === "ALL";
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId, { required: !canViewAll });
        const id = asInt(req.params?.id, "id");

        const patch = {
            clientId: req.body?.clientId != null ? asInt(req.body.clientId, "clientId", { nullable: true }) : undefined,
            partnerId: req.body?.partnerId != null ? asInt(req.body.partnerId, "partnerId", { nullable: true }) : undefined,
            notes: req.body?.notes != null ? asString(req.body.notes) : undefined,
        };

        const data = await service.updatePurchase({ companyId, actorEmployeeId, canViewAll, id, patch });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function deletePurchase(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const canViewAll = req.purchaseViewMode === "ALL";
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId, { required: !canViewAll });
        const id = asInt(req.params?.id, "id");

        const data = await service.deletePurchase({ companyId, actorEmployeeId, canViewAll, id });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function addPurchaseItem(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const canViewAll = req.purchaseViewMode === "ALL";
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId, { required: !canViewAll });

        const purchaseId = asInt(req.params?.id, "id");
        const productId = asInt(req.body?.productId, "productId");
        const quantity = asNumber(req.body?.quantity, "quantity", { min: 0.000001 });
        const unitBuyPrice = req.body?.unitBuyPrice != null ? asNumber(req.body.unitBuyPrice, "unitBuyPrice", { min: 0 }) : null;
        const unitResalePrice = req.body?.unitResalePrice != null ? asNumber(req.body.unitResalePrice, "unitResalePrice", { min: 0 }) : null;

        const data = await service.addPurchaseItem({
            companyId,
            actorEmployeeId,
            canViewAll,
            purchaseId,
            productId,
            quantity,
            unitBuyPrice,
            unitResalePrice,
        });

        reply.code(201).send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function updatePurchaseItem(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const canViewAll = req.purchaseViewMode === "ALL";
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId, { required: !canViewAll });

        const purchaseId = asInt(req.params?.id, "id");
        const itemId = asInt(req.params?.itemId, "itemId");

        const patch = {
            quantity: req.body?.quantity != null ? asNumber(req.body.quantity, "quantity", { min: 0.000001 }) : undefined,
            unitBuyPrice: req.body?.unitBuyPrice != null ? asNumber(req.body.unitBuyPrice, "unitBuyPrice", { min: 0 }) : undefined,
            unitResalePrice: req.body?.unitResalePrice != null ? asNumber(req.body.unitResalePrice, "unitResalePrice", { min: 0 }) : undefined,
        };

        const data = await service.updatePurchaseItem({
            companyId,
            actorEmployeeId,
            canViewAll,
            purchaseId,
            itemId,
            patch,
        });

        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function deletePurchaseItem(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const canViewAll = req.purchaseViewMode === "ALL";
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId, { required: !canViewAll });

        const purchaseId = asInt(req.params?.id, "id");
        const itemId = asInt(req.params?.itemId, "itemId");

        const data = await service.deletePurchaseItem({ companyId, actorEmployeeId, canViewAll, purchaseId, itemId });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function validatePurchase(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const canViewAll = req.purchaseViewMode === "ALL";
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId, { required: !canViewAll });
        const id = asInt(req.params?.id, "id");

        const data = await service.validatePurchase({ companyId, actorEmployeeId, canViewAll, id });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function cancelPurchase(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const canViewAll = req.purchaseViewMode === "ALL";
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId, { required: !canViewAll });
        const id = asInt(req.params?.id, "id");
        const reason = req.body?.reason != null ? asString(req.body.reason) : null;

        const data = await service.cancelPurchase({ companyId, actorEmployeeId, canViewAll, id, reason });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function markPurchasePaid(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const canViewAll = req.purchaseViewMode === "ALL";
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId, { required: !canViewAll });
        const id = asInt(req.params?.id, "id");

        const data = await service.markPurchasePaid({ companyId, actorEmployeeId, canViewAll, id });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function changeOwner(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const canViewAll = req.purchaseViewMode === "ALL";
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId, { required: !canViewAll });
        const id = asInt(req.params?.id, "id");
        const newEmployeeId = asInt(req.body?.employeeId, "employeeId");

        const data = await service.changeOwner({ companyId, actorEmployeeId, canViewAll, id, newEmployeeId });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function deleteCanceledPurchase(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const canViewAll = req.purchaseViewMode === "ALL";
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId, { required: !canViewAll });
        const id = asInt(req.params?.id, "id");

        const data = await service.deleteCanceledPurchase({ companyId, actorEmployeeId, canViewAll, id });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function getPurchaseStatsByEmployee(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const dateStart = asString(req.query?.dateStart) || null;
        const dateEnd = asString(req.query?.dateEnd) || null;

        const data = await service.getPurchaseStatsByEmployee({ companyId, dateStart, dateEnd });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function listClients(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const query = {
            page: req.query?.page != null ? asInt(req.query.page, "page", { nullable: true, min: 1 }) : 1,
            limit: req.query?.limit != null
                ? asInt(req.query.limit, "limit", { nullable: true, min: 1 })
                : req.query?.pageSize != null
                    ? asInt(req.query.pageSize, "pageSize", { nullable: true, min: 1 })
                    : 15,
            search: asString(req.query?.search) || "",
        };

        const data = await service.listClients({ companyId, query });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function getClient(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const id = asInt(req.params?.id, "id");
        const data = await service.getClient({ companyId, id });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function createClient(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const name = asString(req.body?.name, { nullable: false });

        if (!name) {
            const err = new Error("Champ 'name' requis.");
            err.statusCode = 400;
            err.code = "VALIDATION_ERROR";
            err.details = { field: "name" };
            throw err;
        }

        const payload = {
            name,
            phoneNumber: asString(req.body?.phoneNumber),
            address: asString(req.body?.address),
            iban: asString(req.body?.iban),
            cni: asString(req.body?.cni),
        };

        const data = await service.createClient({ companyId, payload });
        reply.code(201).send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function updateClient(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const id = asInt(req.params?.id, "id");

        const patch = {
            name: req.body?.name !== undefined ? asString(req.body.name) : undefined,
            phoneNumber: req.body?.phoneNumber !== undefined ? asString(req.body.phoneNumber) : undefined,
            address: req.body?.address !== undefined ? asString(req.body.address) : undefined,
            iban: req.body?.iban !== undefined ? asString(req.body.iban) : undefined,
            cni: req.body?.cni !== undefined ? asString(req.body.cni) : undefined,
        };

        const data = await service.updateClient({ companyId, id, patch });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function uploadClientCni(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const clientId = asInt(req.params?.id, "id");

        const data = await req.file();
        if (!data) {
            return reply.code(400).send({ error: "VALIDATION_ERROR", message: "Aucun fichier fourni." });
        }

        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(data.mimetype)) {
            return reply.code(400).send({ error: "VALIDATION_ERROR", message: "Format non supporté (jpg/png/webp)." });
        }

        const buffer = await data.toBuffer();
        const result = await service.uploadClientCni({ companyId, clientId, fileBuffer: buffer, mimetype: data.mimetype });
        reply.send(result);
    } catch (e) {
        sendError(reply, e);
    }
}

async function deleteClientCni(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const clientId = asInt(req.params?.id, "id");
        const result = await service.deleteClientCni({ companyId, clientId });
        reply.send(result);
    } catch (e) {
        sendError(reply, e);
    }
}

async function serveClientCni(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const clientId = asInt(req.params?.id, "id");

        const client = await prisma.client.findFirst({ where: { id: clientId, companyId } });
        if (!client?.cniImagePublicId) {
            return reply.code(404).send({ error: "NOT_FOUND", message: "Aucune CNI pour ce client." });
        }

        const image = await prisma.image.findUnique({ where: { publicId: client.cniImagePublicId } });
        if (!image) return reply.code(404).send({ error: "NOT_FOUND", message: "Image introuvable." });

        const filePath = path.join(UPLOADS_DIR, image.filename);
        if (!fs.existsSync(filePath)) return reply.code(404).send({ error: "NOT_FOUND", message: "Fichier introuvable." });

        reply.header("Content-Type", image.mimetype);
        reply.header("Cache-Control", "private, max-age=86400");
        const stream = fs.createReadStream(filePath);
        reply.send(stream);
    } catch (e) {
        sendError(reply, e);
    }
}

/* ---------- Estimations ---------- */

async function listEstimations(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const canViewAll = req.purchaseViewMode === "ALL";
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId, { required: !canViewAll });
        const query = {
            status: asString(req.query?.status) || null,
            page: req.query?.page ? asInt(req.query.page, "page", { min: 1 }) : 1,
            pageSize: req.query?.pageSize ? asInt(req.query.pageSize, "pageSize", { min: 1 }) : 20,
        };
        const data = await service.listEstimations({ companyId, actorEmployeeId, canViewAll, query });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function createEstimation(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId);
        const clientId = req.body?.clientId ? asInt(req.body.clientId, "clientId", { nullable: true }) : null;
        const notes = asString(req.body?.notes) || null;
        const data = await service.createEstimation({ companyId, actorEmployeeId, clientId, notes });
        reply.code(201).send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function getEstimation(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const id = asInt(req.params?.id, "id");
        const data = await service.getEstimation({ companyId, id });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function updateEstimation(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const id = asInt(req.params?.id, "id");
        const patch = {
            clientId: req.body?.clientId !== undefined ? (req.body.clientId ? asInt(req.body.clientId, "clientId", { nullable: true }) : null) : undefined,
            notes: req.body?.notes !== undefined ? asString(req.body.notes) : undefined,
        };
        const data = await service.updateEstimation({ companyId, id, patch });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function addEstimationItem(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const estimationId = asInt(req.params?.id, "id");
        const productId = asInt(req.body?.productId, "productId");
        const quantity = asNumber(req.body?.quantity, "quantity", { min: 0.001 });
        const estimatedBuyPrice = req.body?.estimatedBuyPrice != null ? asNumber(req.body.estimatedBuyPrice, "estimatedBuyPrice", { min: 0 }) : null;
        const data = await service.addEstimationItem({ companyId, estimationId, productId, quantity, estimatedBuyPrice });
        reply.code(201).send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function deleteEstimationItem(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const estimationId = asInt(req.params?.id, "id");
        const itemId = asInt(req.params?.itemId, "itemId");
        const data = await service.deleteEstimationItem({ companyId, estimationId, itemId });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function rejectEstimation(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const id = asInt(req.params?.id, "id");
        const data = await service.rejectEstimation({ companyId, id });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function convertEstimation(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const actorEmployeeId = await getActorCompanyEmployeeId(req, companyId);
        const id = asInt(req.params?.id, "id");
        const data = await service.convertEstimationToPurchase({ companyId, actorEmployeeId, id });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function listProducts(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const query = {
            includeInactive: asBool(req.query?.includeInactive, false),
            search: asString(req.query?.search) || null,
        };
        const data = await service.listProducts({ companyId, query });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function listPurchaseCatalog(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const query = {
            includeInactive: asBool(req.query?.includeInactive, false),
            search: asString(req.query?.search) || null,
        };
        const data = await service.listPurchaseCatalog({ companyId, query });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function createProduct(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const name = (req.body?.name || "").toString().trim();
        if (!name) {
            const err = new Error("Champ 'name' requis.");
            err.statusCode = 400;
            err.code = "VALIDATION_ERROR";
            err.details = { field: "name" };
            throw err;
        }

        const sku = req.body?.sku != null ? String(req.body.sku).trim() : null;
        const buyPrice = asNumber(req.body?.buyPrice, "buyPrice", { min: 0 });
        const resalePrice = asNumber(req.body?.resalePrice, "resalePrice", { min: 0 });
        const isActive = asBool(req.body?.isActive, true);
        const inventoryOwner = req.body?.inventoryOwner != null ? String(req.body.inventoryOwner).trim() || null : null;

        const data = await service.createProduct({ companyId, name, sku, buyPrice, resalePrice, isActive, inventoryOwner });
        reply.code(201).send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function updateProduct(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const id = asInt(req.params?.id, "id");

        const patch = {
            name: req.body?.name != null ? String(req.body.name).trim() : undefined,
            sku: req.body?.sku != null ? String(req.body.sku).trim() : undefined,
            buyPrice: req.body?.buyPrice != null ? asNumber(req.body.buyPrice, "buyPrice", { min: 0 }) : undefined,
            resalePrice: req.body?.resalePrice != null ? asNumber(req.body.resalePrice, "resalePrice", { min: 0 }) : undefined,
            isActive: req.body?.isActive != null ? asBool(req.body.isActive, true) : undefined,
            inventoryOwner: req.body?.inventoryOwner !== undefined ? (req.body.inventoryOwner ? String(req.body.inventoryOwner).trim() : null) : undefined,
        };

        const data = await service.updateProduct({ companyId, id, patch });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function deleteProduct(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const id = asInt(req.params?.id, "id");

        const data = await service.deleteProduct({ companyId, id });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function listPartners(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const query = {
            includeInactive: asBool(req.query?.includeInactive, false),
            search: asString(req.query?.search) || null,
        };
        const data = await service.listPartners({ companyId, query });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function createPartner(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const name = (req.body?.name || "").toString().trim();
        if (!name) {
            const err = new Error("Champ 'name' requis.");
            err.statusCode = 400;
            err.code = "VALIDATION_ERROR";
            err.details = { field: "name" };
            throw err;
        }

        const notes = req.body?.notes != null ? String(req.body.notes).trim() : null;
        const isActive = asBool(req.body?.isActive, true);

        const data = await service.createPartner({ companyId, name, notes, isActive });
        reply.code(201).send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function updatePartner(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const id = asInt(req.params?.id, "id");

        const patch = {
            name: req.body?.name != null ? String(req.body.name).trim() : undefined,
            notes: req.body?.notes != null ? String(req.body.notes).trim() : undefined,
            isActive: req.body?.isActive != null ? asBool(req.body.isActive, true) : undefined,
        };

        const data = await service.updatePartner({ companyId, id, patch });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function deletePartner(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const id = asInt(req.params?.id, "id");

        const data = await service.deletePartner({ companyId, id });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function getPartnerPrices(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const partnerId = asInt(req.params?.id, "id");
        const data = await service.getPartnerPrices({ companyId, partnerId });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

async function putPartnerPrices(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const partnerId = asInt(req.params?.id, "id");

        const rawItems = Array.isArray(req.body) ? req.body : req.body?.items || [];
        if (!Array.isArray(rawItems)) {
            const err = new Error("Payload invalide: attendu un tableau de prix.");
            err.statusCode = 400;
            err.code = "VALIDATION_ERROR";
            throw err;
        }

        const items = rawItems.map((it, idx) => {
            const productId = asInt(it?.productId, `items[${idx}].productId`);
            const buyPrice = asNumber(it?.buyPrice ?? it?.unitBuyPrice, `items[${idx}].buyPrice`, { min: 0 });
            return { productId, buyPrice };
        });

        const data = await service.putPartnerPrices({ companyId, partnerId, items });
        reply.send(data);
    } catch (e) {
        sendError(reply, e);
    }
}

// ---------------------------------------------------------------------------
// Public page
// ---------------------------------------------------------------------------

async function getPublicConfig(req, reply) {
    try {
        const slug = req.params.slug;
        const config = await prisma.pawnshopPublicPageConfig.findUnique({
            where: { publicSlug: slug },
            include: { company: { select: { id: true, name: true } } },
        });
        if (!config || !config.isEnabled) return reply.code(404).send({ message: "Page non disponible." });

        const products = await prisma.pawnshopProduct.findMany({
            where: { companyId: config.companyId, isActive: true },
            select: { id: true, name: true, buyPrice: true },
            orderBy: { name: "asc" },
        });

        let theme = null;
        try { if (config.theme) theme = JSON.parse(config.theme); } catch {}

        return reply.send({
            shopName: config.shopName || config.company.name,
            logoUrl: config.logoUrl || null,
            welcomeText: config.welcomeText || null,
            theme,
            products,
            companyId: config.companyId,
        });
    } catch (e) { return sendError(reply, e); }
}

async function submitPublicEstimation(req, reply) {
    try {
        const slug = req.params.slug;
        const { firstName, lastName, phoneNumber, iban, cniNumber, items, justificatif } = req.body || {};

        if (!firstName || !lastName) {
            const e = new Error("Nom et prénom requis."); e.statusCode = 400; throw e;
        }
        if (!Array.isArray(items) || items.length === 0) {
            const e = new Error("Au moins un article requis."); e.statusCode = 400; throw e;
        }

        const config = await prisma.pawnshopPublicPageConfig.findUnique({ where: { publicSlug: slug } });
        if (!config || !config.isEnabled) {
            const e = new Error("Page non disponible."); e.statusCode = 404; throw e;
        }
        const companyId = config.companyId;

        const systemEmployee = await prisma.companyEmployee.findFirst({
            where: { companyId, status: "ACTIVE" },
            orderBy: { id: "asc" },
        });
        if (!systemEmployee) {
            const e = new Error("Aucun employé actif pour cette société."); e.statusCode = 400; throw e;
        }

        let client = null;
        if (phoneNumber) {
            client = await prisma.client.findFirst({ where: { companyId, phoneNumber } });
        }
        if (!client) {
            const baseName = `${String(firstName).trim()} ${String(lastName).trim()}`;
            const existing = await prisma.client.findFirst({ where: { companyId, name: baseName } });
            const finalName = existing ? `${baseName} (${phoneNumber || Date.now()})` : baseName;
            client = await prisma.client.create({
                data: { companyId, name: finalName, phoneNumber: phoneNumber || null, iban: iban || null, cni: cniNumber || null },
            });
        } else {
            const updates = {};
            if (iban) updates.iban = iban;
            if (cniNumber) updates.cni = cniNumber;
            if (Object.keys(updates).length > 0) await prisma.client.update({ where: { id: client.id }, data: updates });
        }

        const productIds = items.map((i) => Number(i.productId)).filter(Boolean);
        const products = await prisma.pawnshopProduct.findMany({ where: { id: { in: productIds }, companyId, isActive: true } });
        const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

        const estimationItems = items
            .map((i) => {
                const productId = Number(i.productId);
                const p = productMap[productId];
                if (!p) return null;
                return { productId, quantity: Math.max(0.001, Number(i.quantity) || 1), estimatedBuyPrice: p.buyPrice };
            })
            .filter(Boolean);

        if (estimationItems.length === 0) {
            const e = new Error("Aucun produit valide."); e.statusCode = 400; throw e;
        }

        const estimation = await prisma.pawnshopEstimation.create({
            data: {
                companyId,
                clientId: client.id,
                createdByEmployeeId: systemEmployee.id,
                notes: `Soumission publique — ${String(firstName).trim()} ${String(lastName).trim()}`,
                justificatif: justificatif || null,
                isPublicSubmission: true,
                items: { create: estimationItems },
            },
        });

        return reply.code(201).send({ id: estimation.id, clientId: client.id, message: "Estimation soumise avec succès." });
    } catch (e) { return sendError(reply, e); }
}

async function uploadPublicClientCni(req, reply) {
    try {
        const slug = req.params.slug;
        const clientId = asInt(req.params.clientId, "clientId");

        const config = await prisma.pawnshopPublicPageConfig.findUnique({ where: { publicSlug: slug } });
        if (!config || !config.isEnabled) {
            const e = new Error("Page non disponible."); e.statusCode = 404; throw e;
        }

        // Verify client belongs to this company
        const client = await prisma.client.findFirst({ where: { id: clientId, companyId: config.companyId } });
        if (!client) {
            const e = new Error("Client introuvable."); e.statusCode = 404; throw e;
        }

        const data = await req.file();
        if (!data) {
            return reply.code(400).send({ error: "VALIDATION_ERROR", message: "Aucun fichier fourni." });
        }

        const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowed.includes(data.mimetype)) {
            return reply.code(400).send({ error: "VALIDATION_ERROR", message: "Format non supporté (jpg/png/webp)." });
        }

        const buffer = await data.toBuffer();
        const result = await service.uploadClientCni({ companyId: config.companyId, clientId, fileBuffer: buffer, mimetype: data.mimetype });
        reply.send(result);
    } catch (e) { return sendError(reply, e); }
}

async function getPublicPageConfig(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const config = await prisma.pawnshopPublicPageConfig.findUnique({ where: { companyId } });
        return reply.send(config || { companyId, isEnabled: false, publicSlug: null, shopName: null, logoUrl: null, welcomeText: null, theme: null });
    } catch (e) { return sendError(reply, e); }
}

function generateHexSlug() {
    const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
    return `${hex()}-${hex()}-${hex()}`;
}

async function updatePublicPageConfig(req, reply) {
    try {
        const companyId = getCompanyId(req);
        const { regenerateSlug, isEnabled, shopName, logoUrl, welcomeText, theme } = req.body || {};

        // Determine slug: regenerate if requested or no existing config
        const existing = await prisma.pawnshopPublicPageConfig.findUnique({ where: { companyId } });

        let publicSlug;
        if (regenerateSlug || !existing?.publicSlug) {
            // Generate unique slug
            let candidate;
            let attempts = 0;
            do {
                candidate = generateHexSlug();
                const conflict = await prisma.pawnshopPublicPageConfig.findUnique({ where: { publicSlug: candidate } });
                if (!conflict || conflict.companyId === companyId) { publicSlug = candidate; break; }
                attempts++;
            } while (attempts < 10);
            if (!publicSlug) {
                const e = new Error("Impossible de générer un slug unique."); e.statusCode = 500; throw e;
            }
        } else {
            publicSlug = existing.publicSlug;
        }

        const data = {
            publicSlug,
            isEnabled: isEnabled !== false,
            shopName: shopName || null,
            logoUrl: logoUrl || null,
            welcomeText: welcomeText || null,
            theme: theme ? JSON.stringify(theme) : null,
        };

        const config = await prisma.pawnshopPublicPageConfig.upsert({
            where: { companyId },
            create: { companyId, ...data },
            update: data,
        });

        return reply.send(config);
    } catch (e) {
        if (e.code === "P2002") return reply.code(409).send({ message: "Collision de slug, réessayez." });
        return sendError(reply, e);
    }
}

async function getWidgetData_PawnshopEmployeeRanking(req, reply) {
    try {
        const companyId = parseInt(req.query.contextId, 10);
        if (!companyId || isNaN(companyId)) {
            return reply.code(400).send({ message: "Le 'contextId' est manquant ou invalide." });
        }
        const config = JSON.parse(req.query.config || '{}');
        const dateStart = config.dateStart || null;
        const dateEnd = config.dateEnd || null;

        const rows = await service.getPurchaseStatsByEmployee({ companyId, dateStart, dateEnd });
        reply.send({ rows });
    } catch (e) {
        sendError(reply, e);
    }
}

module.exports = {
    listPurchases,
    createPurchase,
    getPurchase,
    updatePurchase,
    deletePurchase,
    addPurchaseItem,
    updatePurchaseItem,
    deletePurchaseItem,
    validatePurchase,
    cancelPurchase,
    markPurchasePaid,
    changeOwner,
    deleteCanceledPurchase,
    getPurchaseStatsByEmployee,
    listClients,
    getClient,
    createClient,
    updateClient,
    uploadClientCni,
    deleteClientCni,
    serveClientCni,
    listEstimations,
    createEstimation,
    getEstimation,
    updateEstimation,
    addEstimationItem,
    deleteEstimationItem,
    rejectEstimation,
    convertEstimation,
    listProducts,
    listPurchaseCatalog,
    createProduct,
    updateProduct,
    deleteProduct,
    listPartners,
    createPartner,
    updatePartner,
    deletePartner,
    getPartnerPrices,
    putPartnerPrices,
    getPublicConfig,
    submitPublicEstimation,
    uploadPublicClientCni,
    getPublicPageConfig,
    updatePublicPageConfig,
    getWidgetData_PawnshopEmployeeRanking,
};
