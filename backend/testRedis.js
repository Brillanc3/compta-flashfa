import { redis, checkRedisConnection } from "./src/shards/redisClient.js";

await checkRedisConnection();
await redis.set("test:redis", "ok");
const val = await redis.get("test:redis");
console.log("Valeur récupérée :", val);

redis.quit();
