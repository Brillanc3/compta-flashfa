// backend/src/config/secrets.js
// Secrets applicatifs lus depuis l'environnement, sans valeur par défaut :
// un secret absent (ou resté à une ancienne valeur d'exemple) bloque le démarrage
// plutôt que de signer des tokens avec une clé connue de tous.

require('dotenv').config({ quiet: true });

// Anciennes valeurs par défaut codées en dur : publiques, donc refusées.
const KNOWN_DEFAULTS = new Set([
    'votre_secret_par_defaut',
    'replace_with_strong_secret',
    'refresh_salt_default',
]);

const MIN_LENGTH = 32;

function readSecret(name) {
    const value = process.env[name];
    if (!value || !value.trim()) {
        throw new Error(`[config] La variable d'environnement ${name} est manquante. Générez-la avec : node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`);
    }
    if (KNOWN_DEFAULTS.has(value)) {
        throw new Error(`[config] ${name} utilise une valeur par défaut publique. Remplacez-la par un secret aléatoire.`);
    }
    if (value.length < MIN_LENGTH) {
        console.warn(`[config] ${name} fait moins de ${MIN_LENGTH} caractères : utilisez un secret plus long.`);
    }
    return value;
}

module.exports = {
    get jwtSecret() { return readSecret('JWT_SECRET'); },
    get sessionSecret() { return readSecret('SESSION_SECRET'); },
    get refreshTokenSalt() { return readSecret('REFRESH_TOKEN_SALT'); },
};
