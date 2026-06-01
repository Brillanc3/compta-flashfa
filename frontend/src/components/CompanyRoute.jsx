// frontend/src/components/CompanyRoute.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import { useHasPermission } from '../hooks/useHasPermission';
import * as authService from '../services/authService';

// Cache mémoire simple pour les modules afin d'éviter des fetchs multiples
const MOD_CACHE_KEY = '__COMPANY_MODULES_CACHE__';
if (typeof window !== 'undefined' && !window[MOD_CACHE_KEY]) {
    window[MOD_CACHE_KEY] = new Map(); // Map<number, string[]>
}

export default function CompanyRoute({
                                         required,
                                         module,
                                         redirectTo = '/forbidden',
                                         children,
                                     }) {
    const location = useLocation();
    const { isLoading: isAuthLoading } = useAuth();
    const { selectedCompanyId, selectedCompany, isAuthLoading: isCompanyLoading } = useCompany();

    const [modOk, setModOk] = useState(null);

    const safeRequired = useMemo(() => {
        if (!required) return [];
        return Array.isArray(required) ? required : [required];
    }, [required]);

    const hasRequired = useHasPermission(safeRequired);

    const moduleListWanted = useMemo(
        () => (!module ? [] : Array.isArray(module) ? module : [module]),
        [module]
    );

    useEffect(() => {
        let cancelled = false;

        const decideWithList = (list) => {
            const set = new Set((list || []).map((x) => String(x).trim().toLowerCase()));
            const ok = moduleListWanted.every((m) => set.has(String(m).toLowerCase()));
            if (!cancelled) setModOk(ok);
        };

        const run = async () => {

            // Tant que l'auth / company charge, on attend (évite "forbidden" après refresh)
            if (isAuthLoading || isCompanyLoading) { if (!cancelled) setModOk(null); return; }

            // Pas d’entreprise sélectionnée → interdit si la route exige un module/company
            if (!selectedCompanyId) {

                // Si ça charge encore → ATTENDRE
                if (isAuthLoading || isCompanyLoading) {
                    if (!cancelled) setModOk(null);
                }
                // Si ça ne charge plus → vrai interdit
                else {
                    if (!cancelled) setModOk(false);
                }

                return;
            }

            // Si aucun module requis → OK de suite
            if (moduleListWanted.length === 0) { if (!cancelled) setModOk(true); return; }

            // 1) Sources locales d’abord
            const local1 = Array.isArray(selectedCompany?.modules) ? selectedCompany.modules : null;
            if (local1) { decideWithList(local1); return; }

            // 2) Cache mémoire ?
            const cache = typeof window !== 'undefined' ? window[MOD_CACHE_KEY] : null;
            if (cache && cache.has(Number(selectedCompanyId))) {
                decideWithList(cache.get(Number(selectedCompanyId)));
                return;
            }

            // 3) Fallback réseau unique : /auth/companies
            try {
                const res = await authService.getAccessibleCompanies(); // { items: [...] }
                const items = Array.isArray(res?.items) ? res.items : [];
                const current = items.find((c) => Number(c.id) === Number(selectedCompanyId));
                const list = current?.modules || [];
                if (cache) cache.set(Number(selectedCompanyId), list);
                decideWithList(list);
            } catch {
                if (!cancelled) setModOk(false); // par sécurité
            }
        };

        setModOk(null);
        run();
        return () => { cancelled = true; };
    }, [isAuthLoading, isCompanyLoading, moduleListWanted, selectedCompanyId, selectedCompany]);

    // Guards finaux
    if (modOk === null) {
        return (
            <div className="min-h-screen bg-slate-900 flex justify-center items-center">
                <div className="text-slate-300 animate-pulse">Chargement...</div>
            </div>
        );
    }
    if (modOk === false) {
        return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }
    if (required && !hasRequired) {
        return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
