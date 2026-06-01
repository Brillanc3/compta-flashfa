// /frontend/src/services/garageService.js

import apiClient from './api';

/* -----------------------------
   VEHICLES (CRUD)
------------------------------ */

export async function getVehicles() {
    try {
        const res = await apiClient.get(`/garage/vehicles`);
        return res.data.vehicles;
    } catch (err) {
        throw err.response?.data || err;
    }
}

export async function createVehicle(payload) {
    try {
        const res = await apiClient.post(`/garage/vehicles`, payload);
        return res.data;
    } catch (err) {
        throw err.response?.data || err;
    }
}

export async function updateVehicle(id, payload) {
    try {
        const res = await apiClient.patch(`/garage/vehicles/${id}`, payload);
        return res.data;
    } catch (err) {
        throw err.response?.data || err;
    }
}

export async function deleteVehicle(id) {
    try {
        const res = await apiClient.delete(`/garage/vehicles/${id}`);
        return res.data;
    } catch (err) {
        throw err.response?.data || err;
    }
}

/* -----------------------------
   MOVEMENTS (Entrée/Sortie)
------------------------------ */

export async function getGarageMovements(params = {}) {
    try {
        const res = await apiClient.get(`/garage/movements`, { params });
        return res.data.movements;
    } catch (err) {
        throw err.response?.data || err;
    }
}
