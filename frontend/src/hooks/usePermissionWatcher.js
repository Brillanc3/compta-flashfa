// frontend/src/hooks/usePermissionWatcher.js

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

/**
 * Écoute SSE: /api/auth/events -> "permission-change"
 * - Invalide ['me'], ['permissions'], ['companies']
 * - Empêche les doubles connexions (strict mode / re-renders)
 * - Se connecte seulement si enabled === true ET si un token est présent
 *
 * @param {{ onForceReload?: (payload:any)=>void, enabled?: boolean }} [opts]
 */
export default function usePermissionWatcher(opts = {}) {
    const queryClient = useQueryClient();
    const enabled = opts.enabled !== false; // actif par défaut
    const cbRef = useRef(opts.onForceReload || null);    // évite de re-créer l’EventSource sur chaque render
    cbRef.current = opts.onForceReload || null;

    const esRef = useRef(null);

    useEffect(() => {
        // Pas actif → on ferme si besoin et on n’ouvre pas
        if (!enabled) {
            if (esRef.current) {
                try { esRef.current.close(); } catch { /* empty */ }
                esRef.current = null;
            }
            return;
        }
        // Déjà ouvert → on ne duplique pas (strict mode safe)
        if (esRef.current) return;

        const token = localStorage.getItem('accessToken') || '';
        if (!token) return; // évite la 1ʳᵉ requête rouge avec token vide

        const es = new EventSource(`/api/auth/events?token=${encodeURIComponent(token)}`);
        esRef.current = es;

        es.addEventListener('permission-change', async (e) => {
            let payload = {};
            try { payload = JSON.parse(e.data || '{}'); } catch { /* empty */ }

            await Promise.allSettled([
                queryClient.invalidateQueries({ queryKey: ['me'] }),
                queryClient.invalidateQueries({ queryKey: ['permissions'] }),
                queryClient.invalidateQueries({ queryKey: ['companies'] }),
            ]);

            if (cbRef.current) {
                try { cbRef.current(payload); } catch { /* empty */ }
            }

            const reason = String(payload?.reason || '').replace(/[-_]/g, ' ');
            toast.success(reason ? `Mise à jour: ${reason}` : 'Vos accès ont été mis à jour ✅');
        });

        es.addEventListener('ping', () => {});
        es.addEventListener('ready', () => {});

        es.onerror = () => {
            // Laisse EventSource gérer la reconnexion auto.
            // On peut logger silencieusement si besoin.
        };

        return () => {
            try { es.close(); } catch { /* empty */ }
            esRef.current = null;
        };
    }, [enabled, queryClient]);
}
