// /backend/src/modules/mycalendar/mycalendar.widgets.js

const WIDGETS = [
    {
        type: 'MY_CALENDAR_INVITATIONS',
        name: 'Invitations Calendrier',
        description: 'Affiche les invitations à des événements en attente',
        defaultSize: { w: 4, h: 2 },
        minSize: { w: 2, h: 2 },
        requiredPermission: null, // Public
        targetContext: 'GLOBAL'
    }
];

module.exports = WIDGETS;
