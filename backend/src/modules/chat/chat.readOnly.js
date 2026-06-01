'use strict';

/**
 * Middleware read-only pour le sunset V1.
 *
 * Quand CHAT_V1_READONLY=true (env), toutes les mutations V1 retournent 410 Gone.
 * Les GET restent accessibles pour la transition.
 *
 * Activation : définir CHAT_V1_READONLY=true dans l'environnement.
 * À planifier après 30 jours sans incident post-migration complète.
 */

const READONLY = process.env.CHAT_V1_READONLY === 'true';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

async function chatReadOnlyGuard(req, reply) {
    if (!READONLY) return;
    if (MUTATING_METHODS.has(req.method)) {
        return reply.code(410).send({
            code:    'V1_SUNSET',
            message: 'Le chat V1 est en lecture seule. Migrez vers TchatV2.',
        });
    }
}

module.exports = { chatReadOnlyGuard };
