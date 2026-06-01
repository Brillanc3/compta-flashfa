// Sentry frontend — activé uniquement si VITE_SENTRY_DSN est défini.
// Pour activer : npm install @sentry/react && set VITE_SENTRY_DSN=https://xxx@sentry.io/yyy

let Sentry = null;

export function initSentry() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) return;
    try {
        import('@sentry/react').then((mod) => {
            Sentry = mod;
            Sentry.init({
                dsn,
                environment: import.meta.env.MODE || 'production',
                tracesSampleRate: 0.1,
                integrations: [],
            });
        }).catch(() => {});
    } catch {
        // @sentry/react non installé — pas d'erreur fatale
    }
}

export function captureException(err, ctx) {
    if (!Sentry) return;
    Sentry.withScope?.((scope) => {
        if (ctx) scope.setContext('context', ctx);
        Sentry.captureException(err);
    });
}

export function captureMessage(msg, level = 'info') {
    if (!Sentry) return;
    Sentry.captureMessage?.(msg, level);
}
