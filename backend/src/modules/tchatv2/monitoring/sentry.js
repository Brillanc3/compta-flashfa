'use strict';

// Sentry backend — activé uniquement si SENTRY_DSN est défini.
// Pour activer : npm install @sentry/node && set SENTRY_DSN=https://xxx@sentry.io/yyy
let Sentry = null;

function init() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) return;
    try {
        Sentry = require('@sentry/node');
        Sentry.init({
            dsn,
            environment:  process.env.NODE_ENV || 'production',
            tracesSampleRate: 0.1,
            integrations: [],
        });
    } catch {
        // @sentry/node non installé — pas d'erreur fatale
        Sentry = null;
    }
}

function captureException(err, ctx) {
    if (!Sentry) return;
    Sentry.withScope((scope) => {
        if (ctx) scope.setContext('context', ctx);
        Sentry.captureException(err);
    });
}

function captureMessage(msg, level = 'info') {
    if (!Sentry) return;
    Sentry.captureMessage(msg, level);
}

module.exports = { init, captureException, captureMessage };
