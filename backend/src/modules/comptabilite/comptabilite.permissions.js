// /backend/src/modules/comptabilite/comptabilite.permissions.js

const PERMISSIONS = {
    // Permissions pour les factures (Bills)
    BILLS_VIEW_ALL: 'COMPTABILITE.{companyId}.BILLS.VIEW_ALL',
    BILLS_VIEW_SELF: 'COMPTABILITE.{companyId}.BILLS.VIEW_SELF',
    BILLS_SHARES: 'COMPTABILITE.BILLS.SHARES',
    BILLS_COMMENT_MANAGE: 'COMPTABILITE.BILLS.COMMENT.MANAGE',
    BILLS_COMMENTS_EDIT: 'COMPTABILITE.BILLS.COMMENTS.EDIT',
    BILLS_COMMENT_ADD: 'COMPTABILITE.BILLS.COMMENT.ADD',
    BILLS_COMMENT_REMOVE: 'COMPTABILITE.BILLS.COMMENT.REMOVE',
    BILLS_COMMENT_VIEW: 'COMPTABILITE.BILLS.COMMENT.VIEW',

    // Permissions pour les transactions
    TRANSACTIONS_VIEW: 'COMPTABILITE.{companyId}.TRANSACTIONS.VIEW',
    TRANSACTIONS_EDIT: 'COMPTABILITE.{companyId}.TRANSACTIONS.EDIT',

    VIEW_BALANCE: 'COMPTABILITE.COMPANY.BALANCE.VIEW',

    // Permission pour la page de déclaration
    DECLARATION_VIEW: 'COMPTABILITE.{companyId}.DECLARATION.VIEW',

    // Permissions pour les notes de frais
    EXPENSE_REPORTS_MANAGE: 'COMPTABILITE.{companyId}.EXPENSE_REPORTS.MANAGE',
    EXPENSE_CATEGORIES_MANAGE: 'COMPTABILITE.{companyId}.EXPENSE_CATEGORIES.MANAGE',

    EDIT_COMPANIES: 'COMPTABILITE.{companyId}.SETTINGS.EDIT',


    USERS_DUTY: 'SHOW_USER_DUTY',

    ALL_COMPANY_ACCESS: 'CHAT.ADMINISTRATOR'
};

const HIERARCHY = {
    [PERMISSIONS.BILLS_VIEW_ALL]: [
        PERMISSIONS.BILLS_VIEW_SELF,
    ],
    [PERMISSIONS.BILLS_SHARES]: [
        PERMISSIONS.BILLS_VIEW_ALL
    ]
};

const DESCRIPTIONS = {
    [PERMISSIONS.ALL_COMPANY_ACCESS]: "Accède à tout le système de tchat sans limitation",
    [PERMISSIONS.VIEW_BALANCE]: "Voit le solde de l'entreprise",
    [PERMISSIONS.USERS_DUTY]: "Accède au Widget du temps de service des employés + page des services",
    [PERMISSIONS.BILLS_VIEW_ALL]: "Accède à la page des factures et voit tout",
    [PERMISSIONS.BILLS_VIEW_SELF]: "Accède à la page des factures et voit ses factures",
    [PERMISSIONS.BILLS_SHARES]: "Permet de fractionner les factures avec plusieurs employés",
    [PERMISSIONS.BILLS_COMMENT_MANAGE]: "Peut gérer tous les commentaires des factures",
    [PERMISSIONS.BILLS_COMMENTS_EDIT]: "Peut éditer n'importe quel commentaire sur les factures",
    [PERMISSIONS.BILLS_COMMENT_ADD]: "Peut ajouter des commentaires sur les factures",
    [PERMISSIONS.BILLS_COMMENT_REMOVE]: "Peut supprimer n'importe quel commentaire sur les factures",
    [PERMISSIONS.BILLS_COMMENT_VIEW]: "Peut voir les commentaires sur les factures",
    [PERMISSIONS.DECLARATION_VIEW]: "Accède à la page de déclaration IRS",
    [PERMISSIONS.TRANSACTIONS_VIEW]: "Accède à la page des transactions",
    [PERMISSIONS.TRANSACTIONS_EDIT]: "Peut modifier le type de transaction",
    [PERMISSIONS.EDIT_COMPANIES]: "⚠️ Voit settings / API de l'entreprise",
    [PERMISSIONS.EXPENSE_REPORTS_MANAGE]: "Permet de valider des notes de frais + Widget Note de frais",
};

module.exports = {
    PERMISSIONS,
    HIERARCHY,
    DESCRIPTIONS
};