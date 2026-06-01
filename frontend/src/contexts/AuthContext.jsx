/* eslint-disable react-refresh/only-export-components */
// frontend/src/contexts/AuthContext.jsx

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
} from "react";

import * as authService from "../services/authService";
import apiClient from "../services/api";
import {
    registerAccessTokenGetter,
    registerAuthHooks,
} from "../services/api";

const AuthContext = createContext(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
    return ctx;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [accessToken, setAccessToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    /* -------------------- helpers storage -------------------- */

    const getStoredRefreshToken = () => {
        try {
            return localStorage.getItem("refreshToken");
        } catch {
            return null;
        }
    };

    const setStoredRefreshToken = (token) => {
        try {
            if (token) localStorage.setItem("refreshToken", token);
            else localStorage.removeItem("refreshToken");
        } catch { /* empty */ }
    };

    const clearPersistentSession = () => {
        try {
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("deviceId");
        } catch { /* empty */ }
    };

    /* -------------------- sync axios header -------------------- */

    useEffect(() => {
        if (accessToken) {
            apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        } else {
            delete apiClient.defaults.headers.common.Authorization;
        }
    }, [accessToken]);

    useEffect(() => {
        registerAccessTokenGetter(() => accessToken);
    }, [accessToken]);

    /* -------------------- LOGOUT -------------------- */

    const logout = useCallback(async () => {
        const rt = getStoredRefreshToken();

        if (rt) {
            try {
                await authService.logout(rt);
            } catch { /* empty */ }
        }

        setUser(null);
        setCompanies([]);
        setAccessToken(null);
        clearPersistentSession();

        delete apiClient.defaults.headers.common.Authorization;
    }, []);

    /* -------------------- LOGIN -------------------- */

    const login = useCallback(async ({ username, password }) => {
        const { accessToken, refreshToken } =
            await authService.login({ username, password });

        setStoredRefreshToken(refreshToken);
        setAccessToken(accessToken);

        const me = await authService.getMe();
        setUser(me);
        setCompanies(me.companies || []);

        return me;
    }, []);

    /* -------------------- REFRESH SESSION (CRITIQUE) -------------------- */
    /* 🔥 RETOURNE DIRECTEMENT LE NOUVEAU TOKEN */

    const refreshSession = useCallback(async () => {
        const rt = getStoredRefreshToken();
        if (!rt) {
            await logout();
            return null;
        }

        try {
            const { accessToken: newAT, refreshToken: newRT } =
                await authService.refresh(rt);

            setStoredRefreshToken(newRT);
            setAccessToken(newAT);

            apiClient.defaults.headers.common.Authorization = `Bearer ${newAT}`;
            registerAccessTokenGetter(() => newAT);

            // getMe facultatif pour l'interceptor, mais utile pour l'app
            try {
                const me = await authService.getMe();
                setUser(me);
                setCompanies(me.companies || []);
            } catch {
                // permissions/me peuvent échouer sans invalider le refresh
            }

            return newAT; // 🔥 POINT CLÉ
        } catch {
            await logout();
            return null;
        }
    }, [logout]);

    /* -------------------- bootstrap initial -------------------- */

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            setIsLoading(true);
            try {
                await refreshSession();
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        init();
        return () => {
            mounted = false;
        };
    }, [refreshSession]);

    /* -------------------- proactive token refresh -------------------- */
    /* Refresh toutes les 10 min pour éviter l'expiry en AFK (TTL = 15 min) */

    useEffect(() => {
        if (!accessToken) return;

        const interval = setInterval(() => {
            refreshSession();
        }, 10 * 60 * 1000);

        return () => clearInterval(interval);
    }, [accessToken, refreshSession]);

    /* -------------------- expose hooks to axios -------------------- */

    useEffect(() => {
        registerAuthHooks({
            refreshSession,
            logout,
        });
    }, [refreshSession, logout]);

    /* -------------------- context value -------------------- */

    const value = {
        user,
        companies,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,

        login,
        logout,
        refreshSession,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
