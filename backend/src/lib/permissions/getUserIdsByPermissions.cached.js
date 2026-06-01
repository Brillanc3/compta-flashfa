// backend/src/lib/permissions/getUserIdsByPermissions.cached.js

const { redis } = require('../../shards/redisClient');
const { getUserIdsByPermissions } = require('./getUserIdsByPermissions');

const CACHE_PREFIX = 'perm:v2'; // ✅ bump de version => plus de collision avec l'ancien cache

/**
 * Version cachée Redis de la résolution de permissions.
 *
 * Clé Redis :
 *   perm:v2:{companyId}:{permission}
 *
 * Valeur :
 *   SET(userId)
 *
 * HIT si la clé existe (même set vide). Pour un set vide, on crée une clé vide via placeholder.
 */
async function getUserIdsByPermissionsCached(permissions, companyId) {
    const permissionTemplates = Array.isArray(permissions) ? permissions : [permissions];

    const cacheKeys = permissionTemplates.map(
        (p) => `${CACHE_PREFIX}:${companyId}:${p}`
    );

    // HIT si toutes les clés existent
    const existsArr = await Promise.all(cacheKeys.map((k) => redis.exists(k)));
    const isFullHit = existsArr.every((x) => Number(x) === 1);

    if (isFullHit) {
        const cachedResults = await Promise.all(cacheKeys.map((key) => redis.smembers(key)));
        const userIds = new Set();
        cachedResults.flat().forEach((id) => userIds.add(Number(id)));
        return Array.from(userIds);
    }

    // MISS => SQL
    const userIds = await getUserIdsByPermissions(permissionTemplates, companyId);

    // Cache
    await Promise.all(
        cacheKeys.map(async (key) => {
            await redis.del(key);

            if (userIds.length > 0) {
                await redis.sadd(key, ...userIds.map(String));
            } else {
                // Créer une clé “vide” qui existe quand même (sinon exists=0 => MISS infini)
                await redis.sadd(key, '__empty__');
                await redis.srem(key, '__empty__');
            }

            await redis.expire(key, 300);
        })
    );

    return userIds;
}

module.exports = {
    getUserIdsByPermissionsCached,
};
