/* eslint-disable react-refresh/only-export-components */
// frontend/src/contexts/CompanyContext.jsx
import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useMemo,
    useCallback,
} from "react";
import { useAuth } from "./AuthContext";

const CompanyContext = createContext(null);

export function useCompany() {
    const ctx = useContext(CompanyContext);
    if (!ctx) throw new Error("useCompany must be used inside <CompanyProvider>");
    return ctx;
}

function safeGetLS(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetLS(key, value) {
    try {
        if (value === null || value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
    } catch { /* empty */ }
}

export function CompanyProvider({ children }) {
    // AuthContext expose déjà isLoading : on le remappe en isAuthLoading pour compat
    const { companies, isAuthenticated, isLoading: isAuthLoading } = useAuth();

    const [activeCompanyId, setActiveCompanyId] = useState(null);
    const [loading, setLoading] = useState(true); // “company loading” (compat ancienne API)

    const [useCompanyTheme, setUseCompanyTheme] = useState(() => {
        return localStorage.getItem("useCompanyTheme") !== "false";
    });

    const toggleCompanyTheme = useCallback(() => {
        setUseCompanyTheme(prev => {
            const next = !prev;
            localStorage.setItem("useCompanyTheme", String(next));
            return next;
        });
    }, []);

    // Résolution initiale de la company active
    useEffect(() => {
        if (isAuthLoading) return;

        // Fin de chargement par défaut
        setLoading(true);

        if (!isAuthenticated) {
            setActiveCompanyId(null);
            safeSetLS("lastCompanyId", null);
            setLoading(false);
            return;
        }

        if (!companies || companies.length === 0) {
            setActiveCompanyId(null);
            safeSetLS("lastCompanyId", null);
            setLoading(false);
            return;
        }

        const stored = safeGetLS("lastCompanyId");
        const storedNum = stored ? Number(stored) : null;

        if (storedNum && Number.isFinite(storedNum) && companies.some((c) => c.id === storedNum)) {
            setActiveCompanyId(storedNum);
            setLoading(false);
            return;
        }

        const firstCompanyId = companies[0].id;
        setActiveCompanyId(firstCompanyId);
        safeSetLS("lastCompanyId", firstCompanyId);
        setLoading(false);
    }, [companies, isAuthenticated, isAuthLoading]);

    const activeCompany = useMemo(() => {
        if (!companies || !activeCompanyId) return null;
        return companies.find((c) => c.id === activeCompanyId) || null;
    }, [companies, activeCompanyId]);

    /**
     * IMPORTANT:
     * - Normalise companyId (string -> number)
     * - Evite un “état transitoire” cassant des hooks en forçant un remount du subtree via resetKey
     * - Optionnel : reload hard si tu veux vraiment (désactivé par défaut)
     */
    const switchCompany = useCallback(
        (companyId, options = { hardReload: false }) => {
            if (!companies || companies.length === 0) return;

            const nextId = Number(companyId);
            if (!Number.isFinite(nextId)) {
                console.warn("[Company] switchCompany: companyId invalide :", companyId);
                return;
            }

            const valid = companies.some((c) => c.id === nextId);
            if (!valid) {
                console.warn("[Company] Tentative de switch vers une company invalide :", nextId);
                return;
            }

            if (nextId === activeCompanyId) return;

            // On persiste d’abord (utile même si hard reload)
            safeSetLS("lastCompanyId", nextId);

            // Soft loading (compat)
            setLoading(true);
            setActiveCompanyId(nextId);

            // Si tu veux forcer un reload navigateur (pas recommandé sauf cas extrême)
            if (options?.hardReload === true) {
                window.location.reload();
                return;
            }

            // Relâche le loading rapidement (le remount fait le “reset” réel)
            // (microtask => après propagation state)
            queueMicrotask(() => setLoading(false));
        },
        [companies, activeCompanyId]
    );

    // Reset boundary: remount toute l’app dépendante de la company
    // => corrige classiquement les #300 au switch (hooks qui changent de chemin de rendu)
    const resetKey = useMemo(() => {
        return activeCompanyId ? `company-${activeCompanyId}` : "company-none";
    }, [activeCompanyId]);


    // Valeur NEW + aliases OLD (pour éviter incohérences si certaines pages utilisent encore l’ancien contexte)
    const value = useMemo(() => {
        return {
            // NEW API
            companies,
            activeCompany,
            activeCompanyId,
            switchCompany,
            
            useCompanyTheme,
            toggleCompanyTheme,

            // OLD API compatibility
            userCompanies: companies || [],
            selectedCompany: activeCompany,
            companyCount: (companies || []).length,
            loading,
            isAuthLoading,
        };
    }, [companies, activeCompany, activeCompanyId, switchCompany, loading, isAuthLoading, useCompanyTheme, toggleCompanyTheme]);

    return (
        <CompanyContext.Provider value={value}>
            <React.Fragment key={resetKey}>
                {children}
            </React.Fragment>
        </CompanyContext.Provider>
    );
}
