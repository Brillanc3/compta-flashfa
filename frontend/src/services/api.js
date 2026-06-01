// frontend/src/services/api.js
import axios from "axios";

const apiClient = axios.create({
    baseURL: "/api",
    withCredentials: true,
});

/* -------------------- token getter -------------------- */

let accessTokenGetter = () => null;

export function registerAccessTokenGetter(fn) {
    accessTokenGetter = fn;
}

/* -------------------- auth hooks -------------------- */

export function registerAuthHooks({ refreshSession, logout }) {
    window.__refreshSession = refreshSession;
    window.__logout = logout;
}

/* -------------------- helpers -------------------- */

function safeRedirect(path) {
    try {
        if (window.location.pathname !== path) {
            window.location.assign(path);
        }
    } catch { /* empty */ }
}

/* -------------------- refresh mutex -------------------- */

let isRefreshing = false;
let pendingRequests = [];

function resolvePendingRequests(error, token = null) {
    pendingRequests.forEach(({ resolve, reject, config }) => {
        if (error) {
            reject(error);
            return;
        }

        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
        resolve(apiClient(config));
    });

    pendingRequests = [];
}

/* -------------------- REQUEST -------------------- */

apiClient.interceptors.request.use(
    (config) => {
        config.headers = config.headers || {};

        const token = accessTokenGetter?.();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        } else {
            delete config.headers.Authorization;
        }

        if (!config.headers["x-company-id"]) {
            const companyId = localStorage.getItem("lastCompanyId");
            if (companyId) {
                config.headers["x-company-id"] = companyId;
            }
        }

        return config;
    },
    (error) => Promise.reject(error)
);

/* -------------------- RESPONSE -------------------- */

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (!error?.response || !error?.config) {
            return Promise.reject(error);
        }

        const { status } = error.response;
        const originalRequest = error.config;
        const url = String(originalRequest.url || "");

        const isAuthCall =
            url.includes("/auth/refresh") ||
            url.includes("/auth/logout") ||
            url.includes("/auth/login");

        if (status === 401) {
            // 🔥 jamais de refresh sur auth
            if (isAuthCall) {
                if (typeof window.__logout === "function") {
                    window.__logout();
                } else {
                    safeRedirect("/login");
                }
                return Promise.reject(error);
            }

            if (originalRequest._retry) {
                safeRedirect("/login");
                return Promise.reject(error);
            }
            originalRequest._retry = true;

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    pendingRequests.push({ resolve, reject, config: originalRequest });
                });
            }

            isRefreshing = true;

            try {
                if (typeof window.__refreshSession !== "function") {
                    throw new Error("refreshSession indisponible");
                }

                const newToken = await window.__refreshSession();
                if (!newToken) {
                    throw new Error("Refresh échoué");
                }

                resolvePendingRequests(null, newToken);

                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return apiClient(originalRequest);
            } catch (err) {
                resolvePendingRequests(err, null);

                if (typeof window.__logout === "function") {
                    window.__logout();
                } else {
                    safeRedirect("/login");
                }

                return Promise.reject(err);
            } finally {
                isRefreshing = false;
            }
        }

        if (status === 403) {
            //safeRedirect("/forbidden");
        }

        return Promise.reject(error);
    }
);

export default apiClient;
export const api = apiClient;
