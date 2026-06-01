/* eslint-disable react-refresh/only-export-components */
// frontend/src/contexts/PermissionsContext.jsx
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { useCompany } from "./CompanyContext";
import * as authService from "../services/authService";
import useWebSocketListener from "../hooks/useWebSocketListener";

const PermissionsContext = createContext(null);

export function usePermissions() {
    const ctx = useContext(PermissionsContext);
    if (!ctx) {
        throw new Error("usePermissions must be used within <PermissionsProvider>");
    }
    return ctx;
}

function toSet(list) {
    return new Set(Array.isArray(list) ? list : []);
}

// Helper permission (UI-level, jamais sécurité)
function hasPermission(permsSet, action) {
    if (!action) return true;

    const act = String(action);

    // Super-admin : ADMIN.* couvre tout
    if (permsSet.has('ADMIN.*')) return true;

    // Exact
    if (permsSet.has(act)) return true;

    // Wildcards : COMPANY.1.* / COMPTABILITE.1.* etc.
    for (const p of permsSet) {
        if (typeof p !== "string") continue;
        if (!p.endsWith(".*")) continue;
        const base = p.slice(0, -1); // enlève seulement le "*"
        if (act.startsWith(base)) return true;
    }

    return false;
}

export function PermissionsProvider({ children }) {
    const { isAuthenticated } = useAuth();
    const { activeCompanyId } = useCompany();

    // IMPORTANT: ne jamais faire Number(null) => 0 (0 est falsy et casse la logique)
    const companyId = useMemo(() => {
        if (activeCompanyId === null || activeCompanyId === undefined) return null;
        const n = Number(activeCompanyId);
        return Number.isFinite(n) && n > 0 ? n : null;
    }, [activeCompanyId]);

    const [byCompany, setByCompany] = useState(() => new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [loadingCompanyId, setLoadingCompanyId] = useState(null);
    const [lastError, setLastError] = useState(null);

    // Reset complet quand l'utilisateur se déconnecte (évite un état incohérent au relog)
    useEffect(() => {
        if (isAuthenticated) return;
        setByCompany(new Map());
        setIsLoading(false);
        setLoadingCompanyId(null);
        setLastError(null);
    }, [isAuthenticated]);

    const loadPermissions = useCallback(
        async (cid, { force = false } = {}) => {
            if (!cid || !isAuthenticated) return;

            const cached = byCompany.get(cid);
            if (cached && !force) return;

            setIsLoading(true);
            setLoadingCompanyId(cid);
            setLastError(null);

            try {
                const data = await authService.getPermissions(cid);

                setByCompany((prev) => {
                    const next = new Map(prev);
                    next.set(cid, {
                        permissions: Array.isArray(data.permissions) ? data.permissions : [],
                        companyModules: Array.isArray(data.companyModules) ? data.companyModules : [],
                        fetchedAt: Date.now(),
                    });
                    return next;
                });
            } catch (err) {
                console.error("[Permissions] load failed:", err);
                setLastError(err);
            } finally {
                setIsLoading(false);
                setLoadingCompanyId(null);
            }
        },
        [isAuthenticated, byCompany]
    );

    // Initial load + switch company
    useEffect(() => {
        if (!companyId || !isAuthenticated) return;
        loadPermissions(companyId);
    }, [companyId, isAuthenticated, loadPermissions]);

    // WebSocket invalidation
    useWebSocketListener("PERMISSIONS_UPDATED", useCallback((payload) => {
        const cid = Number(payload?.companyId);
        // Si l'event n'a pas de cid => on refresh la company active
        // Si cid == active => refresh
        if (!companyId || !isAuthenticated) return;
        if (!cid || cid === companyId) {
            loadPermissions(companyId, { force: true });
        }
    }, [companyId, isAuthenticated, loadPermissions]));

    const active = useMemo(() => {
        if (!companyId) return null;
        return byCompany.get(companyId) ?? null;
    }, [byCompany, companyId]);

    const isReady = Boolean(companyId && active);

    const permsSet = useMemo(() => {
        return active ? toSet(active.permissions) : new Set();
    }, [active]);

    const value = useMemo(
        () => ({
            // 🔐 état
            isReady,
            isLoading,
            loadingCompanyId,
            lastError,

            // 📦 données
            permissions: active?.permissions ?? [],
            companyModules: active?.companyModules ?? [],
            permsSet,

            // 🔁 actions
            reload: () => companyId && loadPermissions(companyId, { force: true }),

            has: (perm) => {
                // Tant que pas prêt => on refuse (et on laisse le route guard gérer le loading)
                if (!isReady) return false;
                return hasPermission(permsSet, perm);
            },
        }),
        [
            isReady,
            isLoading,
            loadingCompanyId,
            lastError,
            active,
            permsSet,
            companyId,
            loadPermissions,
        ]
    );

    return (
        <PermissionsContext.Provider value={value}>
            {children}
        </PermissionsContext.Provider>
    );
}
