/* global __APP_VERSION__ */
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

// Version compilée dans le bundle courant (injectée par vite — voir vite.config.js)
const CURRENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

const POLL_INTERVAL_MS = 60_000;     // vérif toutes les 60s
const TOAST_ID = 'app-update-available';

/**
 * Détecte le déploiement d'une nouvelle version du frontend et propose
 * un rechargement, sans forcer CTRL+SHIFT+R.
 *
 * Principe : le bundle courant connaît sa propre version (CURRENT_VERSION).
 * On compare régulièrement avec /version.json (servi non-caché). Dès qu'elle
 * diffère, on affiche un toast persistant « Recharger ».
 */
export default function UpdateChecker() {
    const notifiedRef = useRef(false);

    useEffect(() => {
        if (CURRENT_VERSION === 'dev') return; // pas de check en développement
        let stopped = false;

        const check = async () => {
            if (stopped || notifiedRef.current || document.hidden) return;
            try {
                const res = await fetch(`/version.json?_=${Date.now()}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' },
                });
                if (!res.ok) return;
                const { version } = await res.json();
                if (version && String(version) !== String(CURRENT_VERSION)) {
                    notifiedRef.current = true;
                    toast(
                        (t) => (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span>Nouvelle version disponible</span>
                                <button
                                    onClick={() => { toast.dismiss(t.id); window.location.reload(); }}
                                    style={{
                                        background: '#5474A0', color: '#fff', border: 'none',
                                        borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                                        fontWeight: 600, whiteSpace: 'nowrap',
                                    }}
                                >
                                    Recharger
                                </button>
                            </span>
                        ),
                        { id: TOAST_ID, duration: Infinity, position: 'top-center' },
                    );
                }
            } catch { /* réseau indisponible — on réessaiera */ }
        };

        const interval = setInterval(check, POLL_INTERVAL_MS);
        const onVisible = () => { if (!document.hidden) check(); };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', check);
        check(); // check initial

        return () => {
            stopped = true;
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', check);
        };
    }, []);

    return null;
}
