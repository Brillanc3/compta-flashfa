const redis = require('../../redis');

/**
 * Invalide TOUTES les permissions en cache pour une company.
 *
 * À appeler après :
 * - changement de rang
 * - changement de permission
 * - ajout/suppression employé
 *
 * @param {number} companyId
 */
async function invalidateCompanyPermissions(companyId) {
    if (!companyId) return;

    const pattern = `perm:${companyId}:*`;

    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
        await redis.del(keys);
    }
}

module.exports = {
    invalidateCompanyPermissions,
};
