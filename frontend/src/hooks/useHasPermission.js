// frontend/src/hooks/useHasPermission.js

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useCompany } from '@/contexts/CompanyContext.jsx';

function normalizeRequired(requiredActions, companyId) {
    if (!requiredActions) return [];
    const arr = Array.isArray(requiredActions) ? requiredActions : [requiredActions];
    return arr
        .filter(Boolean)
        .map((r) => String(r).replace('{companyId}', companyId ?? ''));
}

function hasWithWildcards(permsSet, action, companyId) {
    if (!action) return true;
    const perms = permsSet instanceof Set ? permsSet : new Set(permsSet || []);

    // Super-admin
    if (perms.has('ADMIN.*')) return true;

    // Gérant d'entreprise (Bypass global pour l'entreprise sélectionnée)
    if (companyId && perms.has(`COMPANY.${companyId}.*`)) return true;

    // Exact
    if (perms.has(action)) return true;

    // COMPANY.{id}.* (cas spécifique où l'action elle-même mentionne COMPANY)
    const m = String(action).match(/^COMPANY\.(\d+)\./i);
    if (m && perms.has(`COMPANY.${m[1]}.*`)) return true;

    // Autres jokers se terminant par .*
    for (const p of perms) {
        if (typeof p !== 'string') continue;
        if (!p.endsWith('.*')) continue;
        const base = p.slice(0, -1);
        if (action.startsWith(base)) return true;
    }
    return false;
}

export function useHasPermission(requiredActions) {
    const { user } = useAuth();
    const { selectedCompanyId, activeCompanyId } = useCompany();
    const companyId = selectedCompanyId || activeCompanyId;

    const userPerms = useMemo(() => new Set(user?.permissions || []), [user]);
    const needed = useMemo(
        () => normalizeRequired(requiredActions, companyId),
        [requiredActions, companyId]
    );

    if (needed.length === 0) return true;
    return needed.some((a) => hasWithWildcards(userPerms, a, companyId));
}