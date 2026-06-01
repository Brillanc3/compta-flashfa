import {
    getChannelRankOverrides, getChannelUserOverrides, setChannelRankOverride, deleteChannelRankOverride,
    setChannelUserOverride, deleteChannelUserOverride,
    getCategoryRankOverrides, getCategoryUserOverrides, setCategoryRankOverride, deleteCategoryRankOverride,
    setCategoryUserOverride, deleteCategoryUserOverride,
} from '@/services/chatService';

export function normalizeCatalog(raw) {
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : Object.values(raw);
    return list.map((p) => ({ key: p.key, bit: BigInt(p.bit), label: p.label, description: p.description }));
}

export function bitsToPermissionMap(allowBitsStr, denyBitsStr, catalog) {
    const allowBits = allowBitsStr ? BigInt(allowBitsStr) : 0n;
    const denyBits = denyBitsStr ? BigInt(denyBitsStr) : 0n;
    const map = {};
    for (const perm of catalog) {
        const bit = perm.bit;
        const hasAllow = (allowBits & bit) === bit;
        const hasDeny = (denyBits & bit) === bit;
        if (hasAllow && !hasDeny) map[perm.key] = 'allow';
        else if (hasDeny) map[perm.key] = 'deny';
        else map[perm.key] = null;
    }
    return map;
}

export function permissionMapToBits(permissionMap, catalog) {
    let allowBits = 0n;
    let denyBits = 0n;
    for (const perm of catalog) {
        const v = permissionMap[perm.key] ?? null;
        if (v === 'allow') allowBits |= perm.bit;
        else if (v === 'deny') denyBits |= perm.bit;
    }
    return { allowBits: allowBits.toString(), denyBits: denyBits.toString() };
}

export function buildDefaultPermissionMap(catalog) {
    const map = {};
    for (const perm of catalog) map[perm.key] = perm.key === 'VIEW_CHANNEL' ? 'allow' : null;
    return map;
}

export function buildApi(scope, scopeId) {
    if (scope === 'category') {
        return {
            getRanks: () => getCategoryRankOverrides(scopeId),
            setRank: (rankId, body) => setCategoryRankOverride(scopeId, rankId, body),
            deleteRank: (rankId) => deleteCategoryRankOverride(scopeId, rankId),
            getUsers: () => getCategoryUserOverrides(scopeId),
            setUser: (userId, body) => setCategoryUserOverride(scopeId, userId, body),
            deleteUser: (userId) => deleteCategoryUserOverride(scopeId, userId),
        };
    }
    return {
        getRanks: () => getChannelRankOverrides(scopeId),
        setRank: (rankId, body) => setChannelRankOverride(scopeId, rankId, body),
        deleteRank: (rankId) => deleteChannelRankOverride(scopeId, rankId),
        getUsers: () => getChannelUserOverrides(scopeId),
        setUser: (userId, body) => setChannelUserOverride(scopeId, userId, body),
        deleteUser: (userId) => deleteChannelUserOverride(scopeId, userId),
    };
}
