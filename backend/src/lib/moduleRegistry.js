// /backend/src/lib/moduleRegistry.js

const modules = new Map();

/**
 * Registre centralisé pour stocker les configurations des modules (ex: isDefault)
 * chargées lors du démarrage des shards.
 */
module.exports = {
    /**
     * Enregistre un module et sa configuration.
     * @param {string} name - Nom du module.
     * @param {object} config - Configuration du module (ex: { isDefault: true }).
     */
    register: (name, config) => {
        if (!name) return;
        modules.set(name.toLowerCase(), {
            isDefault: !!config?.isDefault,
            ...config
        });
    },

    /**
     * Récupère la configuration d'un module.
     * @param {string} name - Nom du module.
     * @returns {object|undefined}
     */
    get: (name) => {
        if (!name) return undefined;
        return modules.get(name.toLowerCase());
    },

    /**
     * Vérifie si un module est défini comme par défaut.
     * @param {string} name - Nom du module.
     * @returns {boolean}
     */
    isDefault: (name) => {
        if (!name) return false;
        const config = modules.get(name.toLowerCase());
        return config ? !!config.isDefault : false;
    },

    /**
     * Récupère la liste des noms de tous les modules par défaut.
     * @returns {string[]}
     */
    getAllDefault: () => {
        const defaults = [];
        for (const [name, config] of modules.entries()) {
            if (config.isDefault) {
                defaults.push(name);
            }
        }
        return defaults;
    }
};
