/**
 * backend/src/lib/eventBusRedis.js
 * ------------------------------------------------------
 * Event Bus distribué basé sur Redis.
 *
 * ❗ Correctif majeur :
 *   - Un événement NE DOIT PAS être émis localement dans emit()
 *     sinon on obtient un double-event (local + redis).
 *
 * Fonctionnement final :
 *   eventBus.emit() → publie Redis uniquement
 *   Redis subscriber → relaye sur localBus (1 seule fois)
 *
 * SSE écoute uniquement localBus.on(...)
 * donc chaque événement est reçu UNE seule fois.
 * ------------------------------------------------------
 */

const Redis = require("ioredis");
const EventEmitter = require("events");
const { toSafeJson } = require("./toSafeJson");

// Bus interne local
const localBus = new EventEmitter();

// Connexions Redis
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const pub = new Redis(REDIS_URL, { keyPrefix: process.env.ENV === 'dev' ? 'dev:' : 'prod:' });
const sub = new Redis(REDIS_URL, { keyPrefix: process.env.ENV === 'dev' ? 'dev:' : 'prod:' });

// Nom du channel Redis utilisé pour broadcast global
const CHANNEL = "app-events";

// ---------------------------------------------
// 1) Souscription Redis → relai sur localBus
// ---------------------------------------------
sub.subscribe(CHANNEL, (err, count) => {
    if (err) {
        console.error("Redis subscribe error", err);
    } else {
        console.log(`Subscribed to Redis channel "${CHANNEL}" (${count})`);
    }
});

sub.on("message", (channel, message) => {
    if (channel !== CHANNEL) return;

    try {
        const payload = JSON.parse(message);

        if (payload && payload.target) {
            // ❗ IMPORTANT : relai unique local
            localBus.emit(payload.target, payload.data);
        }
    } catch (err) {
        console.error("Invalid Redis event payload:", err);
    }
});

// ---------------------------------------------
// 2) Émission d’un événement (Redis ONLY)
// ---------------------------------------------
function emit(target, data = {}) {
    try {
        // Convertit BigInt → String
        const safe = toSafeJson({ target, data });

        // ❗ Correctif : PAS d’émission locale directe ici
        // localBus.emit(target, data);  <-- supprimé

        // Publication Redis
        pub.publish(CHANNEL, JSON.stringify(safe)).catch((err) =>
            console.error("Redis publish error:", err)
        );
    } catch (err) {
        console.error("eventBus emit error:", err);
    }
}

// ---------------------------------------------
// 3) Export API publique
// ---------------------------------------------
module.exports = {
    emit,
    on: (evt, fn) => localBus.on(evt, fn),
    off: (evt, fn) => localBus.off(evt, fn),
};
