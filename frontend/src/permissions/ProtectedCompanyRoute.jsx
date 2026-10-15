// frontend/src/permissions/ProtectedCompanyRoute.jsx
import React, { useMemo } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/contexts/PermissionsContext";

/**
 * ProtectedCompanyRoute
 *
 * Props :
 * - module?: string              → module requis (ex: "employees")
 * - permissions?: string[]       → AU MOINS UNE permission valide (OR logique)
 * - requireCompany?: boolean     → false pour les pages globales (ex: panel admin) accessibles
 *                                  sans entreprise active (défaut: true)
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
                                                  requireCompany = true,
                                                  children,
                                              }) {
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const { activeCompanyId, companies, loading: isCompanyLoading } = useCompany();
    const location = useLocation();
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

    // 0) Session en cours de restauration (F5) -> loading, sinon on redirigerait
    //    vers /login avant que le refresh token ait été échangé.
    if (isAuthLoading) {
        return (
            <div className="w-full h-[40vh] flex items-center justify-center text-slate-300">
                Chargement...
            </div>
        );
    }

    // 1) Auth obligatoire (on mémorise la page pour y revenir après connexion)
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 2) Page d'entreprise sans aucune entreprise : on l'explique au lieu de charger sans fin.
    if (requireCompany && !isCompanyLoading && (!companies || companies.length === 0)) {
        return (
            <div className="w-full h-[40vh] flex flex-col items-center justify-center gap-3 text-center text-slate-300 px-4">
                <p className="text-lg font-semibold text-white">Aucune entreprise</p>
                <p className="max-w-md text-slate-400">
                    Cette page est réservée aux membres d'une entreprise. Rejoignez une entreprise pour y accéder.
                </p>
                <Link
                    to="/dashboard"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                >
                    Retourner à l'accueil
                </Link>
            </div>
        );
    }

    // 2b) Tant que la company active n'est pas déterminée -> loading (pas de redirect).
    //    Pages globales : sans entreprise, on attend seulement que les permissions
    //    globales soient prêtes (isReady, étape 3).
    if (!companyId && requireCompany) {
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
