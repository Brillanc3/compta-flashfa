/* Discord-style permission bitfield, mirrors backend tchatv2.constants.js */

export const Permission = Object.freeze({
    CREATE_INSTANT_INVITE:      1n << 0n,
    KICK_MEMBERS:               1n << 1n,
    BAN_MEMBERS:                1n << 2n,
    ADMINISTRATOR:              1n << 3n,
    MANAGE_CHANNELS:            1n << 4n,
    MANAGE_GUILD:               1n << 5n,
    ADD_REACTIONS:              1n << 6n,
    VIEW_AUDIT_LOG:             1n << 7n,
    VIEW_CHANNEL:               1n << 10n,
    SEND_MESSAGES:              1n << 11n,
    MANAGE_MESSAGES:            1n << 13n,
    EMBED_LINKS:                1n << 14n,
    ATTACH_FILES:               1n << 15n,
    READ_MESSAGE_HISTORY:       1n << 16n,
    MENTION_EVERYONE:           1n << 17n,
    USE_EXTERNAL_EMOJIS:        1n << 18n,
    CHANGE_NICKNAME:            1n << 26n,
    MANAGE_NICKNAMES:           1n << 27n,
    MANAGE_ROLES:               1n << 28n,
    MANAGE_WEBHOOKS:            1n << 29n,
    MANAGE_THREADS:             1n << 34n,
    CREATE_PUBLIC_THREADS:      1n << 35n,
    CREATE_PRIVATE_THREADS:     1n << 36n,
    SEND_MESSAGES_IN_THREADS:   1n << 38n,
    MODERATE_MEMBERS:           1n << 40n,
});

export const PERMISSION_GROUPS = [
    {
        label: 'Général',
        items: [
            { flag: 'ADMINISTRATOR',     name: 'Administrateur', desc: 'Tous droits, contourne overwrites.' },
            { flag: 'MANAGE_GUILD',      name: 'Gérer la guilde', desc: 'Nom, icône, paramètres.' },
            { flag: 'MANAGE_ROLES',      name: 'Gérer les rôles', desc: 'Créer/modifier rôles ≤ position.' },
            { flag: 'MANAGE_CHANNELS',   name: 'Gérer les salons', desc: 'CRUD salons + overwrites.' },
            { flag: 'VIEW_AUDIT_LOG',    name: 'Voir le journal d\'audit', desc: '' },
        ],
    },
    {
        label: 'Membres',
        items: [
            { flag: 'KICK_MEMBERS',      name: 'Expulser', desc: '' },
            { flag: 'BAN_MEMBERS',       name: 'Bannir', desc: '' },
            { flag: 'MODERATE_MEMBERS',  name: 'Mettre en sourdine', desc: 'Timeout.' },
            { flag: 'MANAGE_NICKNAMES',  name: 'Gérer les pseudos', desc: '' },
            { flag: 'CHANGE_NICKNAME',   name: 'Modifier son pseudo', desc: '' },
            { flag: 'CREATE_INSTANT_INVITE', name: 'Créer des invitations', desc: '' },
        ],
    },
    {
        label: 'Salon texte',
        items: [
            { flag: 'VIEW_CHANNEL',         name: 'Voir le salon', desc: '' },
            { flag: 'SEND_MESSAGES',        name: 'Envoyer des messages', desc: '' },
            { flag: 'READ_MESSAGE_HISTORY', name: 'Lire l\'historique', desc: '' },
            { flag: 'MANAGE_MESSAGES',      name: 'Gérer les messages', desc: 'Épingler, supprimer.' },
            { flag: 'ATTACH_FILES',         name: 'Joindre des fichiers', desc: '' },
            { flag: 'EMBED_LINKS',          name: 'Liens enrichis', desc: '' },
            { flag: 'ADD_REACTIONS',        name: 'Ajouter des réactions', desc: '' },
            { flag: 'USE_EXTERNAL_EMOJIS',  name: 'Émojis externes', desc: '' },
            { flag: 'MENTION_EVERYONE',     name: 'Mentionner @everyone', desc: '' },
        ],
    },
    {
        label: 'Threads',
        items: [
            { flag: 'CREATE_PUBLIC_THREADS',  name: 'Créer threads publics', desc: '' },
            { flag: 'CREATE_PRIVATE_THREADS', name: 'Créer threads privés', desc: '' },
            { flag: 'SEND_MESSAGES_IN_THREADS', name: 'Écrire dans les threads', desc: '' },
            { flag: 'MANAGE_THREADS',         name: 'Gérer les threads', desc: '' },
        ],
    },
];

export function bitOf(name) { return Permission[name] ?? 0n; }

export function hasPerm(bits, name) {
    const b = typeof bits === 'bigint' ? bits : BigInt(bits ?? 0);
    const f = bitOf(name);
    if ((b & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR) return true;
    return (b & f) === f;
}

export function togglePerm(bits, name) {
    const b = typeof bits === 'bigint' ? bits : BigInt(bits ?? 0);
    const f = bitOf(name);
    return (b & f) === f ? (b & ~f) : (b | f);
}

export function bitsToString(b) { return (typeof b === 'bigint' ? b : BigInt(b ?? 0)).toString(); }

export const CHANNEL_TYPE_TEXT  = 0;
export const CHANNEL_TYPE_FORUM = 15;

const CHANNEL_PERM_GROUPS_TEXT = [
    {
        label: 'Permissions générales de salon',
        items: [
            { flag: 'VIEW_CHANNEL',    name: 'Voir le salon',        desc: '' },
            { flag: 'MANAGE_CHANNELS', name: 'Gérer le salon',       desc: 'Nom, sujet, paramètres.' },
            { flag: 'MANAGE_WEBHOOKS', name: 'Gérer les webhooks',   desc: '' },
        ],
    },
    {
        label: 'Permissions des membres',
        items: [
            { flag: 'CREATE_INSTANT_INVITE', name: 'Créer une invitation', desc: '' },
        ],
    },
    {
        label: 'Permissions de salon textuel',
        items: [
            { flag: 'SEND_MESSAGES',        name: 'Envoyer des messages',   desc: '' },
            { flag: 'READ_MESSAGE_HISTORY', name: 'Lire l\'historique',     desc: '' },
            { flag: 'MANAGE_MESSAGES',      name: 'Gérer les messages',     desc: 'Épingler, supprimer.' },
            { flag: 'ATTACH_FILES',         name: 'Joindre des fichiers',   desc: '' },
            { flag: 'EMBED_LINKS',          name: 'Liens enrichis',         desc: '' },
            { flag: 'ADD_REACTIONS',        name: 'Ajouter des réactions',  desc: '' },
            { flag: 'USE_EXTERNAL_EMOJIS',  name: 'Émojis externes',        desc: '' },
            { flag: 'MENTION_EVERYONE',     name: 'Mentionner @everyone',   desc: '' },
        ],
    },
    {
        label: 'Permissions des fils',
        items: [
            { flag: 'CREATE_PUBLIC_THREADS',      name: 'Créer des fils publics',  desc: '' },
            { flag: 'CREATE_PRIVATE_THREADS',     name: 'Créer des fils privés',   desc: '' },
            { flag: 'SEND_MESSAGES_IN_THREADS',   name: 'Écrire dans les fils',    desc: '' },
            { flag: 'MANAGE_THREADS',             name: 'Gérer les fils',          desc: '' },
        ],
    },
];

const CHANNEL_PERM_GROUPS_FORUM = [
    {
        label: 'Permissions générales de salon',
        items: [
            { flag: 'VIEW_CHANNEL',    name: 'Voir le forum',        desc: '' },
            { flag: 'MANAGE_CHANNELS', name: 'Gérer le forum',       desc: 'Nom, sujet, paramètres.' },
            { flag: 'MANAGE_WEBHOOKS', name: 'Gérer les webhooks',   desc: '' },
        ],
    },
    {
        label: 'Permissions des membres',
        items: [
            { flag: 'CREATE_INSTANT_INVITE', name: 'Créer une invitation', desc: '' },
        ],
    },
    {
        label: 'Permissions du forum',
        items: [
            { flag: 'CREATE_PUBLIC_THREADS',    name: 'Créer un post',              desc: '' },
            { flag: 'SEND_MESSAGES_IN_THREADS', name: 'Répondre dans un post',      desc: '' },
            { flag: 'MANAGE_THREADS',           name: 'Gérer les posts',            desc: '' },
            { flag: 'MANAGE_MESSAGES',          name: 'Gérer les messages',         desc: 'Épingler, supprimer.' },
            { flag: 'ATTACH_FILES',             name: 'Joindre des fichiers',       desc: '' },
            { flag: 'EMBED_LINKS',              name: 'Liens enrichis',             desc: '' },
            { flag: 'ADD_REACTIONS',            name: 'Ajouter des réactions',      desc: '' },
            { flag: 'USE_EXTERNAL_EMOJIS',      name: 'Émojis externes',            desc: '' },
            { flag: 'MENTION_EVERYONE',         name: 'Mentionner @everyone',       desc: '' },
        ],
    },
];

export function getChannelPermGroups(channelType) {
    if (channelType === CHANNEL_TYPE_FORUM) return CHANNEL_PERM_GROUPS_FORUM;
    return CHANNEL_PERM_GROUPS_TEXT;
}
