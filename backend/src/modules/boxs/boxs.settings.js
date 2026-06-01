// /backend/src/modules/boxs/boxs.settings.js

const key = "boxs";

/**
 * Paramètres attendus dans CompanySettings.settings :
 * {
 *   "boxs": {
 *     "redistribution": {
 *       "numbers": ["12", "14"],
 *       "reasonPrefix": "Redistribution N°"
 *     }
 *   }
 * }
 */

const defaults = {
    redistribution: {
        numbers: [],
        reasonPrefix: "Redistribution N°",
        boxPrice: 100,
    },
};

function sanitize(raw) {
    // Toujours retourner un objet propre (compat + defaults)
    const out = {
        redistribution: {
            numbers: [],
            reasonPrefix: defaults.redistribution.reasonPrefix,
            boxPrice: defaults.redistribution.boxPrice,
        },
    };

    if (!raw || typeof raw !== "object") return out;

    const redistribution = raw.redistribution;
    if (!redistribution || typeof redistribution !== "object") return out;

    // numbers: tableau de strings non vides (trim)
    if (Array.isArray(redistribution.numbers)) {
        out.redistribution.numbers = redistribution.numbers
            .filter((x) => typeof x === "string")
            .map((x) => x.trim())
            .filter((x) => x.length > 0);
    }

    // reasonPrefix: string non vide, tronquée
    if (typeof redistribution.reasonPrefix === "string") {
        const s = redistribution.reasonPrefix.trim();
        if (s) out.redistribution.reasonPrefix = s.slice(0, 80);
    }

    return out;
}

/**
 * Fields UI (format identique à rank-form-settings)
 * Le panel Settings construira un formulaire à partir de cette structure.
 */
const fields = {
    redistribution: {
        type: "object",
        required: false,
        label: "Redistribution",
        schema: {
            numbers: {
                type: "string_array",
                required: true,
                label: "Numéros de redistribution",
                description:
                    'Liste des numéros utilisés pour filtrer Transaction.reason. Exemple: "Redistribution N°12".',
                maxItems: 50,
            },
            reasonPrefix: {
                type: "string",
                required: true,
                label: "Préfixe de la raison",
                description:
                    'Texte fixe avant le numéro dans Transaction.reason (par défaut "Redistribution N°").',
                maxLength: 80,
            },
            boxPrice: {
                type: "number",
                required: true,
                label: "Prix de revente du carton",
                description:
                    'Prix que touche l\'entreprise lorsqu\'un carton est vendu.',
                maxAmount: 200
            }
        },
    },
};

module.exports = {
    key,
    fields,
    defaults,
    sanitize,
    version: 1,
};
