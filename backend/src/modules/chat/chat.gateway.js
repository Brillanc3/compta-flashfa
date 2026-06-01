'use strict';

/**
 * Chat WS module registration (Gateway process)
 *
 * Usage attendu côté gateway server (après createGatewayApi):
 *   const registerChatGateway = require('../modules/chat/chat.gateway');
 *   registerChatGateway(gatewayApi);
 *
 * Ce module enregistre les events CLIENT -> SERVER transportés via :
 *   op = DISPATCH (0), t = <EVENT_NAME>, d = <payload>
 *
 * IMPORTANT:
 * - Ce fichier DOIT être exécuté dans le process Gateway WS (pas dans l'API HTTP).
 * - Ce fichier NE DOIT PAS importer la factory `gateway.api.js`.
 * - Il reçoit l'instance `gatewayApi` déjà initialisée.
 */

const events = require('./chat.events');

module.exports = function registerChatGateway(gatewayApi) {
    // Défense : si le module est appelé trop tôt ou avec le mauvais objet
    if (!gatewayApi || typeof gatewayApi.onClientEvent !== 'function') {
        throw new TypeError(
            '[CHAT][GATEWAY] registerChatGateway(): gatewayApi invalide (onClientEvent manquant). ' +
            "Assure-toi de passer l’instance retournée par createGatewayApi(), pas la factory."
        );
    }

    /**
     * ROOM_SUBSCRIBE
     *
     * Payload attendu :
     * {
     *   room: "<string>",            // ex: "channel:1266..." ou "1266..."
     *   action: "join" | "leave"
     * }
     *
     * Convention:
     * - On utilise EXACTEMENT le nom de room fourni par le client.
     * - Donc le backend qui émet (emitGatewayEvent targets) DOIT utiliser la même convention.
     */
    gatewayApi.onClientEvent('ROOM_SUBSCRIBE', async (ctx, payload) => {
        try {
            if (!payload || typeof payload !== 'object') return;

            const { room, action } = payload;

            if (typeof room !== 'string' || room.length === 0) return;
            if (action !== 'join' && action !== 'leave') return;

            // Sécurité minimale : ne pas traiter avant auth/session
            if (!ctx || !ctx.userId) return;

            if (action === 'join') {
                ctx.joinRoom(room);
            } else {
                ctx.leaveRoom(room);
            }

            // Optionnel : ACK debug côté client (à activer si besoin)
            // ctx.sendDispatchToUser(ctx.userId, 'ROOM_SUBSCRIBE_ACK', { room, action });

        } catch (err) {
            // Ne pas fermer la socket pour un subscribe foireux
        }
    });

    /**
     * TYPING_START
     *
     * Payload attendu : { channelId: "<string>" }
     * Diffuse un événement "en train d'écrire" à tous les membres du canal.
     */
    gatewayApi.onClientEvent('TYPING_START', (ctx, payload) => {
        const { channelId } = payload ?? {};
        if (!channelId) return;
        if (!ctx || !ctx.userId) return;
        const userId = ctx.userId;
        const userName = ctx.userName ?? ctx.user?.username ?? ctx.user?.name ?? `Utilisateur ${userId}`;
        events.emitTypingStart(channelId, { userId, userName });
    });

    /**
     * TYPING_STOP
     *
     * Payload attendu : { channelId: "<string>" }
     * Signale que l'utilisateur a arrêté d'écrire.
     */
    gatewayApi.onClientEvent('TYPING_STOP', (ctx, payload) => {
        const { channelId } = payload ?? {};
        if (!channelId) return;
        if (!ctx || !ctx.userId) return;
        events.emitTypingStop(channelId, ctx.userId);
    });
};
