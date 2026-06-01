// backend/src/plugins/sse-streams.js
'use strict';

const fp = require('fastify-plugin');
const { CH } = require('../lib/sse/streams');
const { encodeCursor, decodeCursor, withDefaults } = require('../lib/sse/cursor');

const HEARTBEAT_MS = 15000;
const XREAD_BLOCK_MS = 30000; // long-poll 30s
const INITIAL_ID = '$';       // "$" => partir des nouveaux (pas de replay) si on n'a pas Last-Event-ID

function sseWrite(res, { id, event, data }) {
    if (id)   res.write(`id: ${id}\n`);
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data || {})}\n\n`);
}

module.exports = fp(async function sseStreamsPlugin(fastify) {
    const redis = fastify.redis;

    // Route SSE (auth requise)
    fastify.get('/chats/events', { preHandler: fastify.authenticate }, async (req, reply) => {
        // Préparer SSE
        reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('X-Accel-Buffering', 'no');
        reply.raw.write('\n');

        // Contexte utilisateur
        const userId = req.user?.id;        // adapte selon ton JWT
        const qCompanies = String(req.query.companyIds || '').trim();
        const companyIds = qCompanies ? qCompanies.split(',').map((s) => Number(s)).filter(Boolean) : [];
        // Optionnel : si tu veux auto-récupérer les companyIds de l'user ici, fais-le via Prisma.

        // On lit Last-Event-ID envoyé automatiquement par le navigateur lors d’une reconnexion SSE
        const lastEventId = req.headers['last-event-id'];

        // Streams à suivre pour CETTE connexion
        const streams = [CH.user(userId)];
        for (const cid of companyIds) streams.push(CH.company(cid));
        streams.push(CH.broadcast);

        // Curseur multi-streams : map streamKey -> lastId
        // Si on a un Last-Event-ID, on le décode, sinon on part de "$" (seulement nouveaux)
        let cursor = decodeCursor(lastEventId) || {};
        // Valeurs par défaut "$" pour tout stream si non présent
        cursor = withDefaults(cursor, Object.fromEntries(streams.map((k) => [k, INITIAL_ID])));

        // Premier event "ready" avec le curseur courant (le navigateur le renverra en Last-Event-ID si la connexion coupe)
        sseWrite(reply.raw, { event: 'ready', id: encodeCursor(cursor), data: { ts: Date.now(), streams } });

        // Heartbeat keepalive
        const hb = setInterval(() => reply.raw.write(': keepalive\n\n'), HEARTBEAT_MS);

        let closed = false;
        req.raw.on('close', () => { closed = true; clearInterval(hb); });

        // Boucle XREAD
        while (!closed) {
            try {
                // Prépare la liste IDs dans le même ordre que "streams"
                const ids = streams.map((k) => cursor[k] || INITIAL_ID);

                // XREAD BLOCK
                // Réponse de forme: [[stream, [[id, [field, value, field, value...]], ...]] , ...]
                const result = await redis.xread('BLOCK', XREAD_BLOCK_MS, 'STREAMS', ...streams, ...ids);

                if (!result) {
                    // Timeout : renvoie juste un ping léger (déjà fait via keepalive)
                    continue;
                }

                // Pour chaque stream retourné
                for (const [streamKey, entries] of result) {
                    for (const [entryId, fields] of entries) {
                        // fields = [ 'event', 'message:new', 'data', '{...json...}' ]
                        const obj = {};
                        for (let i = 0; i < fields.length; i += 2) obj[fields[i]] = fields[i + 1];
                        const eventName = obj.event || 'message';
                        let data = {};
                        try { data = JSON.parse(obj.data || '{}'); } catch {}

                        // Avancer le curseur pour CE stream
                        cursor[streamKey] = entryId;

                        // Émettre l’event SSE avec l’ID = curseur global encodé
                        sseWrite(reply.raw, {
                            id: encodeCursor(cursor),
                            event: eventName,
                            data,
                        });
                    }
                }
            } catch (e) {
                // erreurs transitoires Redis ou client
                fastify.log.error({ e }, 'SSE XREAD error');
                await new Promise((r) => setTimeout(r, 500)); // petit backoff
            }
        }

        return reply.hijack(); // garder la socket ouverte
    });
});
