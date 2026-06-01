// Fichier de définition des widgets pour le module "notifications"
const {PERMISSIONS} = require("./notifications.permissions");

const widgets = [
    {
        type: 'SEND_COMPANY_NOTIFICATION',
        name: 'Envoyer des notifications',
        description: "Permet d'envoyer une notification à un ou plusieurs employés / rangs",
        requiredPermission: PERMISSIONS.SEND,
    },
];

module.exports = widgets;