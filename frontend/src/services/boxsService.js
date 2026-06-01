// frontend/src/services/boxsService.js
import apiClient from "./api"; // ou ton client habituel

function buildQuery(params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "") return;
        q.set(k, String(v));
    });
    return q.toString();
}

/**
 * Filtres possibles (proposition) :
 * - from, to (ISO string ou yyyy-mm-dd)
 * - companyEmployeeId
 * - redistributionNumber
 * - minCartons, maxCartons
 * - page, pageSize (optionnel)
 */
export async function fetchCartonSales(filters = {}) {
    const qs = buildQuery(filters);
    const { data } = await apiClient.get(`/boxs/carton-sales${qs ? `?${qs}` : ""}`);

    // Backend => { data: [...], pagination: {...} }
    return {
        data: Array.isArray(data?.data) ? data.data : [],
        pagination: data?.pagination ?? {
            totalCount: 0,
            totalPages: 1,
            currentPage: 1,
            limit: filters?.limit ?? 25,
        },
    };
}

export async function fetchCartonSalesSummary(filters = {}) {
    const qs = buildQuery({
        // compat: accepte startDate/endDate et continue de supporter from/to
        startDate: filters.startDate ?? filters.from,
        endDate: filters.endDate ?? filters.to,
        companyEmployeeId: filters.companyEmployeeId,
    });

    const { data } = await apiClient.get(`/boxs/carton-sales/summary${qs ? `?${qs}` : ""}`);

    return {
        count: data?.count ?? 0,
        totalCartons: data?.totalCartons ?? 0,
        totalAmount: data?.totalAmount ?? 0,
    };
}

export async function updateCartonSale(cartonSaleId, patch = {}) {
    if (!cartonSaleId) throw new Error("cartonSaleId invalide.");

    const { data } = await apiClient.patch(`/boxs/carton-sales/${cartonSaleId}`, patch);

    return data;
}