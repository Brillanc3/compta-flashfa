// /backend/src/modules/mycalendar/mycalendar.permissions.js

const PERMISSIONS = {
    EVENTS_MANAGE: 'mycalendar.events.manage',
    EVENTS_ADD: 'mycalendar.events.add',
    EVENTS_EDIT: 'mycalendar.events.edit',
    EVENTS_VIEW: 'mycalendar.events.view',
    EVENTS_SHARE: 'mycalendar.events.share',
};

const HIERARCHY = {
    [PERMISSIONS.EVENTS_MANAGE]: [
        PERMISSIONS.EVENTS_ADD,
        PERMISSIONS.EVENTS_EDIT,
        PERMISSIONS.EVENTS_VIEW,
        PERMISSIONS.EVENTS_SHARE,
    ],
    [PERMISSIONS.EVENTS_EDIT]: [
        PERMISSIONS.EVENTS_VIEW,
    ],
    [PERMISSIONS.EVENTS_ADD]: [
        PERMISSIONS.EVENTS_VIEW,
    ],
    [PERMISSIONS.EVENTS_SHARE]: [
        PERMISSIONS.EVENTS_VIEW,
    ],
};

const DESCRIPTIONS = {
    [PERMISSIONS.EVENTS_MANAGE]: "Gérer tous les événements de l'entreprise",
    [PERMISSIONS.EVENTS_ADD]: "Ajouter un événement d'entreprise",
    [PERMISSIONS.EVENTS_EDIT]: "Modifier les événements d'entreprise",
    [PERMISSIONS.EVENTS_VIEW]: "Voir les événements d'entreprise",
    [PERMISSIONS.EVENTS_SHARE]: "Partager les événements d'entreprise",
};

module.exports = {
    PERMISSIONS,
    HIERARCHY,
    DESCRIPTIONS
};
