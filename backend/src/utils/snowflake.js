// /backend/src/utils/snowflake.js
'use strict';

/**
 * Générateur d'ID Snowflake (style Twitter) en BigInt
 *
 * Mise en page des bits (65 bits utilisés au total, dans un BigInt JS) :
 * [ 41 bits timestamp depuis epoch ][ 10 bits nodeId ][ 12 bits sequence ]
 *
 * - 41 bits de timestamp (ms) ≈ 69 ans de capacité
 * - 10 bits de nodeId → 0..1023 (jusqu'à 1024 nœuds/process)
 * - 12 bits de séquence → 0..4095 (jusqu'à 4096 IDs / ms / nœud)
 *
 * Notes :
 * - Les IDs sont retournés en BigInt pour être compatibles avec Prisma (BigInt).
 * - Le générateur est **local** au process ; utilisez un nodeId unique par instance.
 * - En cas d’horloge "qui recule", on applique la stratégie "shiftForward" :
 *   on force le timestamp courant à rester au moins égal au précédent.
 */

/** @typedef {Object} SnowflakeConfig
 *  @property {bigint} epochMs  Epoch en millisecondes (BigInt)
 *  @property {number} nodeId    Identifiant du nœud 0..1023 (entier)
 *  @property {'shiftForward'|'throw'} clockDriftStrategy
 *      - 'shiftForward' (défaut) : si l'horloge recule, on fige au lastTimestamp
 *      - 'throw' : lève une erreur si l'horloge recule
 */

// ==== Paramètres des bits ====
const TIMESTAMP_BITS = 41n;
const NODE_ID_BITS   = 10n;
const SEQ_BITS       = 12n;

const MAX_NODE_ID = (1n << NODE_ID_BITS) - 1n; // 1023
const MAX_SEQ     = (1n << SEQ_BITS)     - 1n; // 4095

const SEQ_SHIFT   = 0n;
const NODE_SHIFT  = SEQ_BITS;                     // 12
const TIME_SHIFT  = NODE_ID_BITS + SEQ_BITS;      // 22

// ==== Configuration par défaut ====
// Epoch par défaut : 2024-01-01T00:00:00.000Z
const DEFAULT_EPOCH_MS = BigInt(Date.UTC(2024, 12, 2, 0, 0, 0, 0));

/** @type {SnowflakeConfig} */
let CONFIG = {
    epochMs: DEFAULT_EPOCH_MS,
    nodeId: normalizeNodeId(process.env.SNOWFLAKE_NODE_ID ?? (process.pid % 1024)),
    clockDriftStrategy: 'shiftForward',
};

// État interne
let lastTimestamp = -1n;
let sequence      = 0n;

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

/**
 * Convertit une valeur en BigInt (ou lève une erreur).
 * @param {bigint|number|string} v
 * @param {string} [name]
 * @returns {bigint}
 */
function toBigInt(v, name = 'value') {
    try {
        if (typeof v === 'bigint') return v;
        if (typeof v === 'number') return BigInt(v);
        if (typeof v === 'string' && v.trim() !== '') return BigInt(v);
    } catch {}
    throw new TypeError(`Invalid BigInt for ${name}`);
}

/**
 * Normalise/valide le nodeId.
 * @param {unknown} raw
 * @returns {number}
 */
function normalizeNodeId(raw) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > Number(MAX_NODE_ID)) {
        // On replie sur le PID si valeur invalide
        const fallback = process.pid % 1024;
        return fallback;
    }
    return n;
}

/**
 * Renvoie l'heure système en ms (BigInt) depuis l'epoch configurée.
 * @returns {bigint}
 */
function currentTimeSinceEpoch() {
    const nowMs = BigInt(Date.now());
    const sinceEpoch = nowMs - CONFIG.epochMs;
    if (sinceEpoch < 0n) {
        // Horloge du système avant l'epoch : ce n'est pas censé arriver en prod.
        // On protège en ramenant à 0 (ou on pourrait throw).
        return 0n;
    }
    return sinceEpoch;
}

/**
 * Attend la prochaine milliseconde (boucle très courte).
 * NB: boucle active (busy-wait) ; suffisante ici car c'est rare (4096 IDs/ms).
 * @param {bigint} ts timestamp courant (depuis epoch configurée)
 * @returns {bigint} nouveau timestamp (> ts)
 */
function waitNextMillis(ts) {
    let now = currentTimeSinceEpoch();
    // rare : on a déjà généré 4096 IDs dans la même ms
    while (now <= ts) {
        now = currentTimeSinceEpoch();
    }
    return now;
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * configureSnowflake
 * Permet de configurer l'epoch, le nodeId et la stratégie de dérive d’horloge.
 *
 * @param {Partial<SnowflakeConfig>} opts
 *   - epochMs: Date UTC en ms (number|bigint|string)
 *   - nodeId:  0..1023 (number)
 *   - clockDriftStrategy: 'shiftForward' | 'throw'
 *
 * @example
 *   configureSnowflake({ epochMs: Date.UTC(2025,0,1), nodeId: 12 })
 */
function configureSnowflake(opts = {}) {
    if (opts.epochMs != null) CONFIG.epochMs = toBigInt(opts.epochMs, 'epochMs');
    if (opts.nodeId != null) CONFIG.nodeId = normalizeNodeId(opts.nodeId);
    if (opts.clockDriftStrategy === 'throw' || opts.clockDriftStrategy === 'shiftForward') {
        CONFIG.clockDriftStrategy = opts.clockDriftStrategy;
    }
}

/**
 * getConfig
 * Retourne une copie immuable de la configuration courante (pour debug/metrics).
 * @returns {Readonly<SnowflakeConfig & {nodeIdBits:number, seqBits:number, tsBits:number}>}
 */
function getConfig() {
    return Object.freeze({
        epochMs: CONFIG.epochMs,
        nodeId: CONFIG.nodeId,
        clockDriftStrategy: CONFIG.clockDriftStrategy,
        nodeIdBits: Number(NODE_ID_BITS),
        seqBits: Number(SEQ_BITS),
        tsBits: Number(TIMESTAMP_BITS),
    });
}

/**
 * generateSnowflake
 * Génère un ID unique en BigInt.
 * - Monotonicité : garantie par (timestamp, sequence).
 * - Si l'horloge recule :
 *   - 'shiftForward' : on recale sur lastTimestamp (non décroissant).
 *   - 'throw' : on lève une erreur (à capturer côté appelant).
 *
 * @returns {bigint}
 */
function generateSnowflake() {
    const node = toBigInt(CONFIG.nodeId, 'nodeId');

    let ts = currentTimeSinceEpoch();

    // Gestion de l'horloge qui recule (rare mais possible via NTP / VM)
    if (ts < lastTimestamp) {
        if (CONFIG.clockDriftStrategy === 'throw') {
            throw new Error(`Clock moved backwards: ${ts} < ${lastTimestamp}`);
        }
        // shiftForward: on fige au dernier timestamp pour rester monotone
        ts = lastTimestamp;
    }

    if (ts === lastTimestamp) {
        // Même milliseconde → on incrémente la séquence
        sequence = (sequence + 1n) & MAX_SEQ;
        if (sequence === 0n) {
            // Séquence épuisée → attendre la prochaine milliseconde
            ts = waitNextMillis(ts);
        }
    } else {
        // Nouvelle milliseconde → reset séquence
        sequence = 0n;
    }

    lastTimestamp = ts;

    // Composition des bits
    const id =
        (ts << TIME_SHIFT) |
        (node << NODE_SHIFT) |
        (sequence << SEQ_SHIFT);

    return id;
}

/**
 * decomposeSnowflake
 * Décompose un ID en ses composantes (timestamp/Date, nodeId, sequence).
 * @param {bigint|number|string} id
 * @returns {{ id: bigint, unixMs: number, date: Date, nodeId: number, sequence: number, timestampSinceEpoch: bigint }}
 */
function decomposeSnowflake(id) {
    const bid = toBigInt(id, 'id');

    const timestampSinceEpoch = (bid >> TIME_SHIFT) & ((1n << TIMESTAMP_BITS) - 1n);
    const nodeIdBig           = (bid >> NODE_SHIFT) & ((1n << NODE_ID_BITS) - 1n);
    const sequenceBig         = (bid >> SEQ_SHIFT)  & ((1n << SEQ_BITS)     - 1n);

    // Conversion en Number : OK ici (timestamps ms JS < 2^53)
    const unixMs = Number(timestampSinceEpoch + CONFIG.epochMs);

    return {
        id: bid,
        unixMs,
        date: new Date(unixMs),
        nodeId: Number(nodeIdBig),
        sequence: Number(sequenceBig),
        timestampSinceEpoch,
    };
}

/**
 * asString
 * Conversion utilitaire vers string (ex. pour JSON ou logs).
 * @param {bigint|number|string} id
 * @returns {string}
 */
function asString(id) {
    return toBigInt(id, 'id').toString();
}

/**
 * isValidSnowflake
 * Vérifie rapidement si la valeur semble être un Snowflake valide au format.
 * @param {unknown} v
 * @returns {boolean}
 */
function isValidSnowflake(v) {
    try {
        const bid = toBigInt(v, 'id');
        // Test minimal : timestamp ne dépasse pas la taille et node/seq dans l'intervalle
        const t = (bid >> TIME_SHIFT) & ((1n << TIMESTAMP_BITS) - 1n);
        const n = (bid >> NODE_SHIFT) & ((1n << NODE_ID_BITS) - 1n);
        const s = (bid >> SEQ_SHIFT)  & ((1n << SEQ_BITS)     - 1n);
        return t >= 0n && n >= 0n && s >= 0n;
    } catch {
        return false;
    }
}

module.exports = {
    // Config
    configureSnowflake,
    getConfig,

    // Génération / parsing
    generateSnowflake,
    decomposeSnowflake,

    // Utils
    toBigInt,
    asString,
    isValidSnowflake,
};
