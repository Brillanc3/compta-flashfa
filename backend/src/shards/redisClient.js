// -----------------------------------------------------------------------------
// 🔌 redisClient.js
// -----------------------------------------------------------------------------

require('dotenv').config();  // ✅ charge automatiquement ton .env
const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const redis = new Redis(REDIS_URL, {
    keyPrefix: process.env.ENV === 'dev' ? 'dev:' : 'prod:',
    retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        console.warn(`🔁 Tentative de reconnexion à Redis (${times})...`);
        return delay;
    },
    maxRetriesPerRequest: null,
    connectTimeout: 10000,
});

// redis.on("connect", () => console.log("✅ [Redis] Connecté :", REDIS_URL));
redis.on("error", (err) => console.error("❌ [Redis] Erreur :", err.message));
redis.on("close", () => console.warn("⚠️ [Redis] Connexion fermée"));

async function checkRedisConnection() {
    try {
        const pong = await redis.ping();
        if (pong === "PONG") {
            console.log("🧠 [Redis] Ping OK");
            return true;
        }
    } catch (err) {
        console.error("❌ [Redis] Ping échoué :", err.message);
    }
    return false;
}

module.exports = {
    redis,
    checkRedisConnection
};
