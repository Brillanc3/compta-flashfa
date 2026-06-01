// /backend/src/modules/employees/employees.widgets.js

const widgets = [
    {
        type: 'MY_SALARY',
        name: 'Mon Salaire',
        description: "Affiche le détail du salaire de l'utilisateur pour la semaine en cours.",
        requiredPermission: null,
        serviceFunction: 'getWidgetData_MySalary',
        context: 'COMPANY'
    },
    {
        type: 'MY_TURNOVER',
        name: "Mon Chiffre d'affaire",
        description: "Affiche le chiffre d'affaire personnel (jour/semaine).",
        requiredPermission: null,
        serviceFunction: 'getWidgetData_MyTurnover',
        context: 'COMPANY'
    },
];

module.exports = widgets;