// backend/src/plugins/sse-redis-adapter.js
'use strict';

// // backend/src/plugins/sse-redis-adapter.js
const fp = require('fastify-plugin');

// canaux
const CH = {
    user: (id) => `sse:user:${id}`,
    company: (id) => `sse:company:${id}`,
    broadcast: 'sse:all',
};

module.exports = fp(async function sseRedisAdapter(fastify) {
    const { subscriber } = fastify.redis;

    // set<channel> auxquels CE processus est abonné (pour éviter des subscribe inutiles)
    const subscribed = new Set();

    async function ensureSubscribed(channel) {
        if (!channel || subscribed.has(channel)) return;
        await subscriber.subscribe(channel);
        subscribed.add(channel);
        fastify.log.info({ channel }, 'SSE Redis subscribed');
    }
    async function maybeUnsubscribe(channel) {
        if (!channel) return;
        // ne se désabonne que si plus AUCUN client local n’en a besoin
        const stillNeeded =
            fastify.sseManager.hasLocalSubscribersForChannel?.(channel) ?? false;
        if (!stillNeeded && subscribed.has(channel)) {
            await subscriber.unsubscribe(channel);
            subscribed.delete(channel);
            fastify.log.info({ channel }, 'SSE Redis unsubscribed');
        }
    }

    // Quand un message arrive via Redis → pousser aux clients locaux concernés
    subscriber.on('message', (channel, payload) => {
        try {
            const evt = JSON.parse(payload);
            // Diffuser aux clients locaux concernés
            fastify.sseManager.emitLocal(channel, evt);
        } catch (e) {
            fastify.log.error({ e, channel, payload }, 'Bad SSE payload');
        }
    });

    // Étend sseManager pour qu’il sache mapper canaux <-> clients
    const origRegister = fastify.sseManager.registerClient;
    const origUnregister = fastify.sseManager.unregisterClient;

    // petites maps pour savoir qui écoute quoi
    const channelToClients = new Map(); // channel -> Set(client)

    function addClientChannel(channel, client) {
        if (!channel) return;
        if (!channelToClients.has(channel)) channelToClients.set(channel, new Set());
        channelToClients.get(channel).add(client);
    }
    function removeClientChannel(channel, client) {
        if (!channel) return;
        const set = channelToClients.get(channel);
        if (!set) return;
        set.delete(client);
        if (set.size === 0) channelToClients.delete(channel);
    }

    // méthodes utilitaires que l’adapter expose au manager
    fastify.sseManager.hasLocalSubscribersForChannel = (channel) => {
        const set = channelToClients.get(channel);
        return !!(set && set.size);
    };
    fastify.sseManager.emitLocal = (channel, evt) => {
        const set = channelToClients.get(channel);
        if (!set) return;
        for (const client of set) {
            // réutilise l’utilitaire d’écriture déjà en place dans sseManager
            client.res.write(`id: ${client.nextId()}\n`);
            client.res.write(`event: ${evt.event || evt.type || 'message'}\n`);
            client.res.write(`data: ${JSON.stringify(evt)}\n\n`);
        }
    };

    // on “wrap” l’enregistrement client pour gérer souscriptions Redis dynamiques
    fastify.sseManager.registerClient = (info) => {
        const client = origRegister(info);

        const userCh = CH.user(client.userId);
        const compCh = client.companyId ? CH.company(client.companyId) : null;

        addClientChannel(userCh, client);
        ensureSubscribed(userCh);

        if (compCh) {
            addClientChannel(compCh, client);
            ensureSubscribed(compCh);
        }

        // broadcast global (facultatif si tu veux recevoir tout)
        addClientChannel(CH.broadcast, client);
        ensureSubscribed(CH.broadcast);

        // quand le client ferme, nettoyer & désabonner si plus utile
        const oldClose = client.close;
        client.close = async () => {
            try { await oldClose(); } catch {}
            removeClientChannel(userCh, client);
            removeClientChannel(compCh, client);
            removeClientChannel(CH.broadcast, client);
            await maybeUnsubscribe(userCh);
            if (compCh) await maybeUnsubscribe(compCh);
            await maybeUnsubscribe(CH.broadcast);
        };

        return client;
    };

    fastify.sseManager.unregisterClient = (client) => {
        // juste déléguer, le close custom ci-dessus fera le ménage
        return origUnregister(client);
    };

    // expose les canaux pour l’usage côté bus
    fastify.decorate('sseChannels', CH);
});
