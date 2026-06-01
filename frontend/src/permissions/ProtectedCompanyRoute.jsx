// frontend/src/permissions/ProtectedCompanyRoute.jsx
import React, { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/contexts/PermissionsContext";

/**
 * ProtectedCompanyRoute
 *
 * Props :
 * - module?: string              → module requis (ex: "employees")
 * - permissions?: string[]       → AU MOINS UNE permission valide (OR logique)
 * - children
 *
 * Règles :
 * - ADMIN.* → accès total (géré côté has() via wildcards)
 * - COMPANY.{id}.* → accès total MAIS uniquement si le module est actif (si module fourni)
 * - permissions[] → OR logique
 *
 * IMPORTANT:
 * - Ne doit JAMAIS rediriger /forbidden tant que les permissions ne sont pas prêtes.
 */
export default function ProtectedCompanyRoute({
                                                  module: requiredModule,
                                                  permissions = [],
                                                  children,
                                              }) {
    const { isAuthenticated } = useAuth();
    const { activeCompanyId } = useCompany();
    const {
        isReady,
        isLoading,
        companyModules,
        has,
        lastError,
    } = usePermissions();

    const companyId = useMemo(() => {
        if (activeCompanyId === null || activeCompanyId === undefined) return null;
        const n = Number(activeCompanyId);
        return Number.isFinite(n) && n > 0 ? n : null;
    }, [activeCompanyId]);

    // 5) Vérification des permissions (OR logique)
    const hasAccess = useMemo(() => {
        if (!permissions || permissions.length === 0) return true;

        return permissions.some((perm) =>
            has(String(perm).replace("{companyId}", String(companyId)))
        );
    }, [permissions, has, companyId]);

    // 1) Auth obligatoire
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // 2) Tant que la company active n'est pas déterminée -> loading (pas de redirect)
    if (!companyId) {
        return (
            <div className="w-full h-[40vh] flex items-center justify-center text-slate-300">
                Chargement...
            </div>
        );
    }

    // 3) Tant que les permissions ne sont pas prêtes -> loading (évite le forbidden "à froid")
    if (!isReady || isLoading) {
        return (
            <div className="w-full h-[40vh] flex items-center justify-center text-slate-300">
                Chargement des permissions...
            </div>
        );
    }

    // Optionnel: si erreur de chargement, tu peux soit afficher un message, soit refuser.
    // Ici: on refuse (forbidden) car sans permissions fiables, on ne peut pas autoriser.
    if (lastError) {
        return <Navigate to="/forbidden" replace />;
    }

    // 4) Vérification du module (si défini) - seulement quand isReady === true
    if (
        requiredModule &&
        Array.isArray(companyModules) &&
        !companyModules.includes(requiredModule)
    ) {
        return <Navigate to="/forbidden" replace />;
    }

    if (!hasAccess) {
        return <Navigate to="/forbidden" replace />;
    }

    return <>{children}</>;
}
