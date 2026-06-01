// /backend/src/modules/calendar/calendar.permissions.js
const PERMISSIONS = {
    VIEW_ALL: 'CALENDAR.VIEW_ALL',
    VIEW_SELF: 'CALENDAR.VIEW_SELF',
    MANAGE_ALL: 'CALENDAR.MANAGE_ALL',
    MANAGE_CATEGORIES: 'CALENDAR.MANAGE_CATEGORIES',
};

const HIERARCHY = {
    [PERMISSIONS.MANAGE_ALL]: [PERMISSIONS.VIEW_ALL, PERMISSIONS.MANAGE_CATEGORIES],
    [PERMISSIONS.VIEW_ALL]: [
        PERMISSIONS.VIEW_SELF
    ]
};

const DESCRIPTIONS = {
    [PERMISSIONS.VIEW_ALL]: 'Voir tout les services sur un panel',
    [PERMISSIONS.VIEW_SELF]: 'Voir ses propres services',
    [PERMISSIONS.MANAGE_ALL]: 'Gérer tout les services',
    [PERMISSIONS.MANAGE_CATEGORIES]: 'Gérer les catégories',
};

module.exports = { PERMISSIONS, HIERARCHY, DESCRIPTIONS };