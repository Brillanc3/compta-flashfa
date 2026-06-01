import apiClient from './api';

/**
 * Service frontend pour le module Products.
 * Endpoints calqués sur /backend/src/modules/products/products.routes.js
 */

/**
 * Récupère la liste des produits d'une entreprise.
 * @param {number|string} companyId
 * @param {object} options
 * @returns {Promise<{products: Array}>}
 */
export async function fetchProducts(companyId, { activeOnly = true } = {}) {
    const { data } = await apiClient.get(
        `/products`,
        { params: { activeOnly } }
    );
    return data; // { products: [...] }
}

/**
 * Crée un produit.
 * POST /products/:companyId/products
 */
export async function createProduct(companyId, payload) {
    const { data } = await apiClient.post(
        `/products`,
        payload
    );
    return data;
}


/**
 * Met à jour un produit.
 * PUT /products/:companyId/products/:productId
 */
export async function updateProduct(companyId, productId, updates) {
    const { data } = await apiClient.put(
        `/products/${productId}`,
        updates
    );
    return data;
}

/**
 * Désactive (soft-delete) un produit.
 * POST /products/:companyId/products/:productId/deactivate
 */
export async function deactivateProduct(companyId, productId) {
    const { data } = await apiClient.post(
        `/products/${productId}/deactivate`
    );
    return data;
}


/**
 * Déclare une production pour un produit donné.
 * @param {number|string} companyId
 * @param {number|string} productId
 * @param {{ quantity: number }} body
 * @returns {Promise<any>}
 */
export async function declareProduct(companyId, productId, body) {
    if (!body?.quantity || isNaN(body.quantity)) {
        throw new Error('Quantité invalide.');
    }

    const { data } = await apiClient.post(
        `/products/${productId}/declare`,
        {
            quantity: parseFloat(body.quantity),
        }
    );
    return data;
}

export async function fetchDeclareWidget(_companyId) {
    const { data } = await apiClient.get(
        `/products/widgets/declare_product_widget`
    );
    return data; // { products: [...] }
}

/**
 * Version étendue utilisée par certains widgets (même endpoint).
 */
export async function fetchWidgetDataDeclareProduct(companyId) {
    return fetchDeclareWidget(companyId);
}

/**
 * Récupère les déclarations de production (paginées + filtres).
 * GET /products/declarations
 *
 * @param {number|string} companyId (compat, non utilisé)
 * @param {{
 *   page?: number,
 *   pageSize?: number,
 *   employeeId?: number|string|null,
 *   productId?: number|string|null,
 *   productStatus?: 'ALL'|'ACTIVE'|'INACTIVE',
 *   quantityMin?: number|string|null,
 *   quantityMax?: number|string|null,
 *   startDate?: string|null,
 *   endDate?: string|null
 * }} options
 */
export async function fetchDeclarations(
    companyId,
    {
        page = 1,
        pageSize = 10,
        employeeId = null,
        productId = null,
        productStatus = 'ALL',
        quantityMin = null,
        quantityMax = null,
        startDate = null,
        endDate = null,
    } = {}
) {
    const params = {
        page,
        pageSize,
        productStatus,
    };

    if (employeeId !== null && employeeId !== undefined && employeeId !== '') params.employeeId = employeeId;
    if (productId !== null && productId !== undefined && productId !== '') params.productId = productId;

    if (quantityMin !== null && quantityMin !== undefined && quantityMin !== '') params.quantityMin = quantityMin;
    if (quantityMax !== null && quantityMax !== undefined && quantityMax !== '') params.quantityMax = quantityMax;

    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const { data } = await apiClient.get(`/products/declarations`, { params });
    return data; // { success, mode, items, pagination } (selon controller)
}

/**
 * Récupère la liste des employés (pour filtre).
 * GET /products/declarations/employees
 *
 * @param {number|string} companyId (compat, non utilisé)
 * @returns {Promise<{success: boolean, mode: string, employees: Array}>}
 */
export async function fetchDeclarationEmployees(_companyId) {
    const { data } = await apiClient.get(`/products/declarations/employees`);
    return data; // { employees: [{id, name, userId, status}, ...], mode }
}

/**
 * Met à jour une déclaration (quantité).
 * PATCH /products/declarations/:declarationId
 *
 * @param {number|string} companyId (compat, non utilisé)
 * @param {number|string} declarationId
 * @param {{ quantity: number|string }} payload
 */
export async function updateProductDeclaration(companyId, declarationId, payload) {
    const qty = Number(payload?.quantity);
    if (!Number.isFinite(qty) || qty < 0) {
        throw new Error('Quantité invalide.');
    }

    const { data } = await apiClient.patch(
        `/products/declarations/${declarationId}`,
        { quantity: qty }
    );

    return data; // { success: true, declaration: {...} }
}

/**
 * Récapitulatif hebdomadaire (agrégé côté backend).
 * GET /products/declarations/weekly-summary?week=YYYY-Www
 *
 * @param {number|string} companyId (compat, pas utilisé dans l’URL)
 * @param {{ week?: string, startDate?: string, endDate?: string, employeeId?: number|string }} params
 * @returns {Promise<{success: boolean, mode: string, range: {startDate: string, endDate: string}, items: Array}>}
 */
export async function fetchWeeklyDeclarationsSummary(companyId, params = {}) {
    const { data } = await apiClient.get(`/products/declarations/weekly-summary`, {
        params: {
            ...(params?.week ? { week: params.week } : {}),
            ...(params?.startDate ? { startDate: params.startDate } : {}),
            ...(params?.endDate ? { endDate: params.endDate } : {}),
            ...(params?.employeeId ? { employeeId: params.employeeId } : {}),
        },
    });

    return data;
}
