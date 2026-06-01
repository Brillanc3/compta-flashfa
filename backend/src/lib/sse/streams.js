// backend/src/lib/sse/streams.js
'use strict';

// Clés de streams Redis
const CH = {
    user: (id) => `sse:user:${id}`,
    company: (id) => `sse:company:${id}`,
    broadcast: 'sse:all',
};

// Options de rétention (éviter que les streams ne grossissent sans fin)
const STREAM_MAXLEN = Number(process.env.SSE_STREAM_MAXLEN || 10000); // ~10k événements par stream
const TRIM_STRATEGY = 'MAXLEN'; // ou 'MINID' si tu veux horizon temporelle

async function xadd(redis, key, eventName, payload) {
    // payload = objet → on stocke dans champ "data"
    const entryId = await redis.xadd(
        key,
        TRIM_STRATEGY,
        '~',                // approximation OK pour perf
        STREAM_MAXLEN,
        '*',                // id auto
        'event', eventName,
        'data', JSON.stringify(payload),
    );
    return entryId; // ex "1730374100000-0"
}

module.exports = { CH, xadd, STREAM_MAXLEN };
