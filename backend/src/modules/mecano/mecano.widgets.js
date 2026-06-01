// backend/src/modules/mecano/mecano.widgets.js

const widgets = [
    {
        type: 'REPAIR_KIT',
        name: 'Kits de réparation',
        description: 'Recherche le kit de réparation à utiliser selon le véhicule.',
        requiredPermission: null,
        targetContext: 'COMPANY',
    },
];

module.exports = widgets;
