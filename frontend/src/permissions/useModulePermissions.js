// frontend/src/permissions/useModulePermissions.js

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import apiClient from '@/services/api';

/**
 * Hook pour récupérer dynamiquement les permissions de routes exposées par le backend.
 *
 * Endpoint unique (côté backend auth.routes):
 *   GET /auth/permissions/routes
 *
 * Mise en cache:
 *   - Mémoire (window.__ROUTE_PERMS)
 *   - localStorage ('routePerms:v2') pour accélérer le boot
 *
 * Structure attendue (flexible):
 *   {
 *     chat: { routes: { CHAT_PAGE: ["COMPANY.{companyId}.CHAT.VIEW"] } },
 *     comptabilite: { routes: { JOURNAL: ["COMPANY.{companyId}.ACCOUNTING.JOURNAL.VIEW"] } },
 *     ...
 *   }
 */
const LS_KEY = 'routePerms:v4';

function normalizePayload(payload) {
    if (!payload || typeof payload !== 'object') return {};
    // Format attendu natif: { moduleSlug: { routes: {...} } }
    // On tolère aussi: { modules: [ { name|slug, routes }, ... ] }
    if (payload.modules && Array.isArray(payload.modules)) {
        const out = {};
        for (const m of payload.modules) {
            if (!m) continue;
            const key = String(m.slug || m.name || m.module || '').toLowerCase();
            if (!key) continue;
            out[key] = { routes: m.routes || {} };
        }
        return out;
    }
    return payload;
}

async function fetchRoutePermissions() {
    const { data } = await apiClient.get('/auth/permissions/routes');
    return normalizePayload(data);
}

export function useModulePermissions() {
    const cacheRef = useRef(typeof window !== 'undefined' ? window.__ROUTE_PERMS : null);
    const [state, setState] = useState(() => {
        // hydrate depuis mémoire ou localStorage
        if (cacheRef.current && typeof cacheRef.current === 'object') {
            return { loading: false, error: null, data: cacheRef.current };
        }
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return { loading: false, error: null, data: parsed || {} };
            }
        } catch {
            // ignore
        }
        return { loading: true, error: null, data: {} };
    });

    useEffect(() => {
        let cancelled = false;
        if (!state.loading) return;

        (async () => {
            try {
                const data = await fetchRoutePermissions();
                if (cancelled) return;

                // cache mémoire + LS
                if (typeof window !== 'undefined') {
                    window.__ROUTE_PERMS = data;
                }
                try {
                    localStorage.setItem(LS_KEY, JSON.stringify(data));
                } catch {
                    // ignore
                }

                setState({ loading: false, error: null, data });
            } catch (error) {
                if (!cancelled) {
                    setState({ loading: false, error: error, data: {} });
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [state.loading]);

    const getModule = useCallback(
        (moduleSlug) => {
            if (!moduleSlug) return null;
            const key = String(moduleSlug).toLowerCase();
            return state.data?.[key] || null;
        },
        [state.data]
    );

    /**
     * Récupère les permissions requises pour une "clé de route" d'un module.
     * Ex:
     *   requireOf('chat','CHAT_PAGE',['COMPANY.{companyId}.CHAT.VIEW'])
     */
    const requireOf = useCallback(
        (moduleSlug, routeKey, fallback = []) => {
            const mod = getModule(moduleSlug);
            if (!mod || !mod.routes) return Array.isArray(fallback) ? fallback : [fallback];

            let entry = mod.routes?.[routeKey];

            // Rien trouvé → fallback
            if (!entry) return Array.isArray(fallback) ? fallback : [fallback];

            // Cas string → tableau
            if (typeof entry === 'string') return [entry];

            // Cas tableau → OK
            if (Array.isArray(entry)) return entry.filter(Boolean).map(String);

            // Cas objet → normaliser toutes les valeurs
            if (typeof entry === 'object') {
                // Exemple : { READ: ["A"], WRITE:["B"] }
                const flatted = Object.values(entry)
                    .flat()
                    .filter(Boolean)
                    .map(String);

                if (flatted.length > 0) return flatted;
            }

            // Dans tous les autres cas → fallback propre
            return Array.isArray(fallback) ? fallback : [fallback];
        },
        [getModule]
    );

    /**
     * Renvoie un objet pratique pour App.jsx
     */
    const api = useMemo(
        () => ({
            loading: !!state.loading,
            error: state.error,
            raw: state.data,
            getModule,
            requireOf,
        }),
        [state, getModule, requireOf]
    );

    return api;
}

export default useModulePermissions;
