// /backend/src/modules/products/products.controller.js

const prisma = require('../../db');
const service = require('./products.service');
const { PERMISSIONS } = require('./products.permissions');

/* ------------ Utils ------------- */

function parseCompanyId(req) {
    const headerId = parseInt(req.headers['x-company-id'], 10);
    return Number.isInteger(headerId) && headerId > 0 ? headerId : null;
}

/**
 * Parse robuste de la quantité quelle que soit la forme du body.
 * - JSON object: { quantity } ou { qty }
 * - string JSON: '{"quantity": 2}'
 * - urlencoded string: 'quantity=2&...'
 * - fallback query: ?quantity=2
 */
function parseQuantity(req) {
    let source = req.body;

    // Fastify peut donner une string si content-type atypique
    if (typeof source === 'string') {
        // 1) Essaye JSON
        try {
            const j = JSON.parse(source);
            source = j;
        } catch {
            // 2) Essaye urlencoded
            const m = source.match(/(?:^|&)quantity=([^&]+)/);
            if (m) {
                const n = Number(decodeURIComponent(m[1]));
                return Number.isFinite(n) ? n : null;
            }
            const m2 = source.match(/(?:^|&)qty=([^&]+)/);
            if (m2) {
                const n = Number(decodeURIComponent(m2[1]));
                return Number.isFinite(n) ? n : null;
            }
            source = {}; // on poursuivra avec les fallbacks
        }
    }

    // 3) Objet classique
    if (source && typeof source === 'object') {
        const v = source.quantity ?? source.qty;
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }

    // 4) Fallback query (?quantity= / ?qty=)
    const q1 = Number(req.query?.quantity);
    if (Number.isFinite(q1)) return q1;
    const q2 = Number(req.query?.qty);
    if (Number.isFinite(q2)) return q2;

    return null;
}

/* ------------ Handlers ------------- */

async function createProductHandler(request, reply) {
    try {
        const companyId = parseCompanyId(request);
        const data = request.body;
        if (!data || !data.name || data.price === undefined) {
            return reply.code(400).send({ message: 'Missing product data' });
        }
        const product = await service.createProduct(companyId, data);
        return reply.code(201).send({ success: true, product });
    } catch (err) {
        request.log.error(err, 'createProductHandler');
        return reply.code(500).send({ message: err.message || 'Internal server error' });
    }
}

async function listProductsHandler(request, reply) {
    try {
        const companyId = parseCompanyId(request);
        const activeOnly = request.query?.activeOnly === 'true';
        const products = await service.listProducts(companyId, { activeOnly });
        return reply.send({ success: true, products });
    } catch (err) {
        request.log.error(err, 'listProductsHandler');
        return reply.code(500).send({ message: err.message || 'Internal server error' });
    }
}

async function updateProductHandler(request, reply) {
    try {
        const companyId = parseCompanyId(request);
        const productId = parseInt(request.params.productId, 10);
        const data = request.body;
        const updated = await service.updateProduct(companyId, productId, data);
        return reply.send({ success: true, product: updated });
    } catch (err) {
        request.log.error(err, 'updateProductHandler');
        return reply.code(400).send({ message: err.message || 'Bad request' });
    }
}

async function updateDeclarationHandler(request, reply) {
    try {
        const companyId = parseCompanyId(request);
        if (!companyId) return reply.code(400).send({ message: 'x-company-id manquant' });

        const declarationId = parseInt(request.params.declarationId, 10);
        if (!Number.isFinite(declarationId) || declarationId <= 0) {
            return reply.code(400).send({ message: 'Identifiant de déclaration invalide.' });
        }

        const qty = parseQuantity(request); // déjà présent :contentReference[oaicite:1]{index=1}
        if (!Number.isFinite(qty) || qty <= 0) {
            return reply.code(400).send({ message: 'Quantité manquante ou invalide.' });
        }

        const updated = await service.updateDeclarationQuantity({
            companyId,
            declarationId,
            quantity: qty,
            actorUserId: request.user?.userId,
        });

        return reply.send({ success: true, declaration: updated });
    } catch (err) {
        request.log.error(err, 'updateDeclarationHandler');
        const status = err?.status || 500;
        return reply.code(status).send({ message: err.message || 'Internal server error' });
    }
}

async function deactivateProductHandler(request, reply) {
    try {
        const companyId = parseCompanyId(request);
        const productId = parseInt(request.params.productId, 10);
        await service.deactivateProduct(companyId, productId);
        return reply.send({ success: true });
    } catch (err) {
        request.log.error(err, 'deactivateProductHandler');
        return reply.code(400).send({ message: err.message || 'Bad request' });
    }
}

async function declareProductHandler(request, reply) {
    try {
        const companyId = parseCompanyId(request);
        const productId = parseInt(request.params.productId, 10);
        const userId = request.user?.userId;
        if (!userId) return reply.code(401).send({ message: 'Unauthorized' });
        if (!companyId) return reply.code(400).send({ message: 'x-company-id manquant' });

        const employee = await prisma.companyEmployee.findFirst({ where: { userId, companyId } });
        if (!employee) return reply.code(403).send({ message: 'Not a company employee' });

        // 🔎 quantité robuste
        const qty = parseQuantity(request);
        request.log.info({ qty, ctype: request.headers['content-type'] }, 'declareProduct: parsed quantity');
        if (!Number.isFinite(qty) || qty <= 0) {
            return reply.code(400).send({ message: 'Quantité manquante ou invalide.' });
        }

        // ⬅️ FIX: on passe bien "quantity", pas "qty"
        const result = await service.createDeclaration({
            companyId,
            productId,
            employeeId: employee.id,
            quantity: qty,
        });

        return reply
            .code(201)
            .send({ success: true, declaration: result.declaration, amount: result.amount, percent: result.percent });
    } catch (err) {
        request.log.error(err, 'declareProductHandler');
        const msg = String(err.message || '');
        if (msg.includes('No remuneration') || msg.includes('deactivated') || msg.includes('No remuneration config')) {
            return reply.code(403).send({ message: msg });
        }
        return reply.code(500).send({ message: 'Internal server error' });
    }
}

async function listDeclarationsHandler(request, reply) {
    try {
        const companyId = parseCompanyId(request);
        if (!companyId) return reply.code(400).send({ message: 'x-company-id manquant' });

        const page = parseInt(request.query.page || '1', 10);
        const pageSize = Math.min(100, parseInt(request.query.pageSize || '15', 10));
        const startDate = request.query.startDate || null;
        const endDate = request.query.endDate || null;

        const mode = request.declarationViewMode || 'SELF';

        // employé courant
        const userId = request.user?.userId;
        let selfEmployee = null;
        if (userId) {
            selfEmployee = await prisma.companyEmployee.findFirst({
                where: { userId, companyId },
                select: { id: true },
            });
        }

        let employeeId = null;

        if (mode === 'SELF') {
            if (!selfEmployee?.id) return reply.code(403).send({ message: 'Not a company employee' });
            employeeId = selfEmployee.id;
        } else {
            // mode ALL: employeeId optionnel
            const requestedEmployeeId = request.query.employeeId ? parseInt(request.query.employeeId, 10) : null;
            employeeId = Number.isFinite(requestedEmployeeId) ? requestedEmployeeId : null;
        }

        const productId = request.query.productId ? parseInt(request.query.productId, 10) : null;
        const productStatus = String(request.query.productStatus || 'ALL').toUpperCase(); // ALL|ACTIVE|INACTIVE

        const quantityMin = request.query.quantityMin !== undefined ? Number(request.query.quantityMin) : null;
        const quantityMax = request.query.quantityMax !== undefined ? Number(request.query.quantityMax) : null;

        const data = await service.listDeclarations({
            companyId,
            employeeId,
            page,
            pageSize,
            startDate,
            endDate,
            productId: Number.isFinite(productId) ? productId : null,
            productStatus,
            quantityMin: Number.isFinite(quantityMin) ? quantityMin : null,
            quantityMax: Number.isFinite(quantityMax) ? quantityMax : null,
        });

        return reply.send({ success: true, mode, ...data });
    } catch (err) {
        request.log.error(err, 'listDeclarationsHandler');
        return reply.code(500).send({ message: err.message || 'Internal server error' });
    }
}

async function listDeclarationEmployeesHandler(request, reply) {
    try {
        const companyId = parseCompanyId(request);
        if (!companyId) return reply.code(400).send({ message: 'x-company-id manquant' });

        const mode = request.declarationViewMode || 'SELF';
        const userId = request.user?.userId;
        if (!userId) return reply.code(401).send({ message: 'Unauthorized' });

        if (mode === 'SELF') {
            const employee = await prisma.companyEmployee.findFirst({
                where: { userId, companyId },
                select: { id: true, status: true, user: { select: { id: true, name: true } } },
            });
            if (!employee) return reply.code(403).send({ message: 'Not a company employee' });

            return reply.send({
                success: true,
                mode,
                employees: [{ id: employee.id, status: employee.status, userId: employee.user?.id || null, name: employee.user?.name || 'Utilisateur' }],
            });
        }

        const employees = await service.listDeclarationEmployees(companyId);
        return reply.send({ success: true, mode, employees });
    } catch (err) {
        request.log.error(err, 'listDeclarationEmployeesHandler');
        return reply.code(500).send({ message: err.message || 'Internal server error' });
    }
}

function parseWeekParam(weekStr) {
    const m = String(weekStr || '').match(/^(\d{4})-W(\d{2})$/);
    if (!m) return null;
    const isoYear = Number(m[1]);
    const isoWeek = Number(m[2]);
    if (!Number.isFinite(isoYear) || !Number.isFinite(isoWeek) || isoWeek < 1 || isoWeek > 53) return null;
    return { isoYear, isoWeek };
}

function isoWeekToMondayYMD(isoYear, isoWeek) {
    // ISO week 1 contains Jan 4th
    const jan4 = new Date(Date.UTC(isoYear, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7; // 1..7
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

    const monday = new Date(mondayWeek1);
    monday.setUTCDate(mondayWeek1.getUTCDate() + (isoWeek - 1) * 7);

    const y = monday.getUTCFullYear();
    const m = monday.getUTCMonth() + 1;
    const d = monday.getUTCDate();
    return { y, m, d };
}

// Offset TZ via Intl (sans dépendance)
function getTimeZoneOffsetMs(timeZone, date) {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const parts = Object.fromEntries(
        dtf.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
    );
    const asUTC = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
    );
    return asUTC - date.getTime();
}

function zonedMidnightToUtc(timeZone, y, m, d) {
    // itération courte pour gérer DST
    let guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    let offset = getTimeZoneOffsetMs(timeZone, guess);
    let utc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offset);

    const offset2 = getTimeZoneOffsetMs(timeZone, utc);
    if (offset2 !== offset) {
        utc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offset2);
    }
    return utc;
}

function parseYMD(ymd) {
    const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    return { y, m: mo, d };
}

async function weeklyDeclarationsSummaryHandler(request, reply) {
    try {
        const companyId = parseCompanyId(request);
        if (!companyId) return reply.code(400).send({ message: 'x-company-id manquant' });

        const timeZone = 'Europe/Paris';

        // Range
        let startAtUtc = null;
        let endAtUtc = null;
        let startDate = null;
        let endDate = null;

        if (request.query?.week) {
            const parsed = parseWeekParam(request.query.week);
            if (!parsed) return reply.code(400).send({ message: 'Paramètre week invalide (attendu: YYYY-Www).' });

            const mon = isoWeekToMondayYMD(parsed.isoYear, parsed.isoWeek);
            const sun = new Date(Date.UTC(mon.y, mon.m - 1, mon.d));
            sun.setUTCDate(sun.getUTCDate() + 6);

            startDate = `${mon.y}-${String(mon.m).padStart(2, '0')}-${String(mon.d).padStart(2, '0')}`;
            endDate = `${sun.getUTCFullYear()}-${String(sun.getUTCMonth() + 1).padStart(2, '0')}-${String(sun.getUTCDate()).padStart(2, '0')}`;

            const startYMD = { y: mon.y, m: mon.m, d: mon.d };
            const endYMD = { y: sun.getUTCFullYear(), m: sun.getUTCMonth() + 1, d: sun.getUTCDate() };

            startAtUtc = zonedMidnightToUtc(timeZone, startYMD.y, startYMD.m, startYMD.d);
            const nextDay = new Date(Date.UTC(endYMD.y, endYMD.m - 1, endYMD.d));
            nextDay.setUTCDate(nextDay.getUTCDate() + 1);
            const nextY = nextDay.getUTCFullYear(), nextM = nextDay.getUTCMonth() + 1, nextD = nextDay.getUTCDate();
            const endNextMidnightUtc = zonedMidnightToUtc(timeZone, nextY, nextM, nextD);
            endAtUtc = new Date(endNextMidnightUtc.getTime() - 1);
        } else {
            const s = parseYMD(request.query?.startDate);
            const e = parseYMD(request.query?.endDate);
            if (!s || !e) {
                return reply.code(400).send({ message: 'startDate/endDate requis (YYYY-MM-DD) ou week=YYYY-Www.' });
            }

            startDate = request.query.startDate;
            endDate = request.query.endDate;

            startAtUtc = zonedMidnightToUtc(timeZone, s.y, s.m, s.d);

            const endPlus = new Date(Date.UTC(e.y, e.m - 1, e.d));
            endPlus.setUTCDate(endPlus.getUTCDate() + 1);
            const endNextMidnightUtc = zonedMidnightToUtc(timeZone, endPlus.getUTCFullYear(), endPlus.getUTCMonth() + 1, endPlus.getUTCDate());
            endAtUtc = new Date(endNextMidnightUtc.getTime() - 1);
        }

        // Mode (SELF/ALL) déterminé par canViewDeclarations
        /**
         * @TODO Fix le SELF
         *
         * @type {string|*}
         */
        const mode = request.declarationViewMode || 'SELF';

        let employeeId = null;

        if (mode === 'SELF') {
            const userId = request.user?.userId;
            if (!userId) return reply.code(401).send({ message: 'Unauthorized' });

            const selfEmployee = await prisma.companyEmployee.findFirst({
                where: { userId, companyId },
                select: { id: true },
            });
            if (!selfEmployee) return reply.code(403).send({ message: 'Not a company employee' });

            employeeId = selfEmployee.id;
        } else {
            // ALL: filtre optionnel
            const q = request.query?.employeeId;
            const parsedEmp = q !== undefined && q !== null && q !== '' ? parseInt(String(q), 10) : null;
            employeeId = Number.isFinite(parsedEmp) ? parsedEmp : null;
        }

        const items = await service.getDeclarationsWeeklySummary({
            companyId,
            employeeId,
            startAt: startAtUtc,
            endAt: endAtUtc,
        });

        return reply.send({
            success: true,
            mode,
            range: { startDate, endDate },
            items,
        });
    } catch (err) {
        request.log.error(err, 'weeklyDeclarationsSummaryHandler');
        return reply.code(500).send({ message: err.message || 'Internal server error' });
    }
}

/* Widget data provider endpoint wrapper */
async function getWidgetData_DeclareProductWidget(request, reply) {
    try {
        const userId = request.user?.userId;
        const companyId = parseCompanyId(request);
        const config = request.query.config ? JSON.parse(request.query.config) : {};
        const data = await service.getWidgetData_DeclareProductWidget(userId, companyId, config);
        return reply.send(data);
    } catch (err) {
        request.log.error(err, 'getWidgetData_DeclareProductWidget');
        return reply.code(500).send({ message: err.message || 'Internal server error' });
    }
}

module.exports = {
    createProductHandler,
    listProductsHandler,
    updateDeclarationHandler,
    updateProductHandler,
    deactivateProductHandler,
    declareProductHandler,
    listDeclarationsHandler,
    listDeclarationEmployeesHandler,
    weeklyDeclarationsSummaryHandler,
    getWidgetData_DeclareProductWidget,
};
