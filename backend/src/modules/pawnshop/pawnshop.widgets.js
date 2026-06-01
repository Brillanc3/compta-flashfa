// backend/src/modules/pawnshop/pawnshop.widgets.js

const widgets = [
    {
        type: 'PAWNSHOP_EMPLOYEE_RANKING',
        name: 'Classement Employés Pawnshop',
        description: 'Affiche le classement des employés par valeur d\'achat ou de revente.',
        requiredPermission: 'PAWNSHOP.PURCHASES.VIEW_ALL',
        serviceFunction: 'getWidgetData_PawnshopEmployeeRanking',
        method: 'GET',
    },
];

module.exports = widgets;
