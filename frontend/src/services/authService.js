// src/services/authService.js
// Service d’authentification sécurisé, compatible avec refreshToken + deviceId
// Aligne parfaitement le frontend avec ton backend (login, refresh, me, logout)

import apiClient from "./api"; // ton axios configuré

//-------------------------------------------------------
// utilitaire pour deviceId persistant
//-------------------------------------------------------
function getOrCreateDeviceId() {
    let deviceId = localStorage.getItem("deviceId");
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("deviceId", deviceId);
    }
    return deviceId;
}

//-------------------------------------------------------
// LOGIN
//-------------------------------------------------------
export async function login({ username, password }) {
    const deviceId = getOrCreateDeviceId();

    const response = await apiClient.post("/auth/login", {
        username,
        password,
        deviceId,
    });

    return {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        deviceId: response.data.deviceId,
        user: response.data.user,
    };
}

//-------------------------------------------------------
// REFRESH (utilise refreshToken + deviceId)
//-------------------------------------------------------
export async function refresh(refreshToken) {
    const deviceId = getOrCreateDeviceId();

    const response = await apiClient.post("/auth/refresh", {
        refreshToken,
        deviceId,
    });

    return {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        deviceId: response.data.deviceId,
        user: response.data.user,
    };
}

//-------------------------------------------------------
// LOGOUT
//-------------------------------------------------------
export async function logout(refreshToken) {
    const deviceId = getOrCreateDeviceId();

    try {
        await apiClient.post("/auth/logout", {
            refreshToken,
            deviceId,
        });
    } catch {
        // silencieux → logout doit toujours fonctionner
    }
}

//-------------------------------------------------------
// PROFIL COMPLET
//-------------------------------------------------------
export async function getMe() {
    const response = await apiClient.get("/auth/me");
    return response.data;
}

//-------------------------------------------------------
// COMPAGNIES ACCESSIBLES (pour le switch ou la route sécurisée)
//-------------------------------------------------------
export async function getAccessibleCompanies() {
    const response = await apiClient.get("/auth/companies");
    return response.data;
}

//-------------------------------------------------------
// REGISTER (création de compte simple)
//-------------------------------------------------------
export async function register({ username, password, name, characterId }) {
    const payload = { username, password, name };
    if (characterId != null) payload.characterId = characterId;
    const response = await apiClient.post("/auth/register", payload);
    return response.data;
}


export async function getPermissions(companyId) {
    const res = await apiClient.get(`/auth/permissions`, {
        params: { companyId },
    });

    // ⬅️ ON RETOURNE L’OBJET COMPLET
    return {
        companyId: res.data.companyId,
        permissions: Array.isArray(res.data.permissions)
            ? res.data.permissions
            : [],
        companyModules: Array.isArray(res.data.companyModules)
            ? res.data.companyModules
            : [],
    };
}

//-------------------------------------------------------
// VERIFY RESET TOKEN
// Accepte :
//  - verifyResetToken(token)
//  - verifyResetToken({ username, token })
//-------------------------------------------------------
export async function verifyResetToken(input) {
    const payload =
        typeof input === "string"
            ? { token: input }
            : {
                token: input.token,
                username: input.username,
            };

    const response = await apiClient.post("/auth/reset/verify", payload);
    return response.data; // { valid: true, user }
}

//-------------------------------------------------------
// CONFIRM RESET PASSWORD
// Accepte :
//  - confirmResetPassword({ token, newPassword })
//  - confirmResetPassword({ username, token, newPassword })
//-------------------------------------------------------
export async function confirmResetPassword(input) {
    const payload = {
        token: input.token,
        newPassword: input.newPassword,
    };

    if (input.username) {
        payload.username = input.username;
    }

    const response = await apiClient.post("/auth/reset/confirm", payload);
    return response.data; // { success: true }
}
