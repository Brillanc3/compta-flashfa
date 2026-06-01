// /backend/src/modules/comptabilite/comptabilite.widgets.js

const widgets = [
    // Widgets liés aux factures et transactions
    {
        type: 'USER_BILLS_BY_STATUS',
        name: 'Mes Factures par Statut',
        description: "Affiche un résumé des factures de l'utilisateur par statut.",
        requiredPermission: null, // Accessible à tous les employés
    },
    {
        type: 'USER_DUTY_COUNTER',
        name: 'Temps de service',
        description: "Affiche depuis combien de temps vous êtes en service.",
        requiredPermission: null,
    },
    {
        type: 'USERS_DUTY_COUNTER',
        name: 'Liste temps de service',
        description: "Affiche depuis combien de temps les employés sont en service.",
        requiredPermission: 'SHOW_USER_DUTY',
    },
    {
        type: 'TRANSACTION_LOG',
        name: 'Journal de Transaction',
        description: "Affiche les transactions récentes de l'entreprise.",
        requiredPermission: 'COMPTABILITE.{companyId}.TRANSACTIONS.VIEW',
        serviceFunction: 'getWidgetData_TransactionLog',
    },
    {
        type: 'COMPANY_BALANCE',
        name: 'Solde de l\'Entreprise',
        description: "Affiche le solde actuel du compte de l'entreprise.",
        requiredPermission: 'COMPTABILITE.COMPANY.BALANCE.VIEW',
    },
    {
        type: 'BILL_JOURNAL',
        name: 'Journal des Factures',
        description: 'Affiche et filtre les factures récentes de l\'entreprise.',
        requiredPermission: 'COMPTABILITE.{companyId}.BILLS.VIEW_ALL',
    },

    // Widgets liés aux notes de frais
    {
        type: 'CREATE_EXPENSE_REPORT',
        name: 'Créer une Note de Frais',
        description: 'Formulaire rapide pour créer une nouvelle note de frais.',
        requiredPermission: null, // Accessible à tous les employés
    },
    {
        type: 'MY_RECENT_EXPENSE_REPORTS',
        name: 'Mes Notes de Frais Récentes',
        description: 'Affiche les 5 dernières notes de frais soumises par l\'utilisateur.',
        requiredPermission: null, // Accessible à tous les employés
    },
    {
        type: 'EXPENSE_REPORT_STATS',
        name: 'Statistiques des Notes de Frais',
        description: 'Affiche le nombre de notes de frais par statut pour toute l\'entreprise.',
        requiredPermission: 'COMPTABILITE.{companyId}.EXPENSE_REPORTS.MANAGE',
    },
    {
        type: 'EXPENSE_REPORT_APPROVAL',
        name: 'Approbation des Notes de Frais',
        description: 'Liste les notes de frais en attente d\'approbation.',
        requiredPermission: 'COMPTABILITE.{companyId}.EXPENSE_REPORTS.MANAGE',
    },
];

module.exports = widgets;