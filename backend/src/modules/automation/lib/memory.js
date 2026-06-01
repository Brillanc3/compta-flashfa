// backend/src/modules/automation/lib/memory.js
'use strict';

/**
 * Mémoire d'exécution d'un workflow. Pure (aucune I/O).
 * `dirty` indique si une persistance est nécessaire.
 */
function createMemory(initial = {}) {
    const map = new Map(Object.entries(initial || {}));
    let dirty = false;

    return {
        get: (k) => map.get(k),
        set: (k, v) => { map.set(k, v); dirty = true; },
        add: (k, n) => {
            const total = Number(map.get(k) || 0) + Number(n || 0);
            map.set(k, total);
            dirty = true;
            return total;
        },
        clear: () => { map.clear(); dirty = true; },
        toObject: () => Object.fromEntries(map),
        get dirty() { return dirty; },
    };
}

module.exports = { createMemory };
