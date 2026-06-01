// /backend/src/modules/employees/employees.permissions.js

const PERMISSIONS = {
    // Permissions pour la gestion des rangs
    RANKS_VIEW: 'EMPLOYEES.{companyId}.RANKS.VIEW',
    RANKS_MANAGE: 'EMPLOYEES.{companyId}.RANKS.MANAGE',

    // Permissions pour la gestion des employés
    EMPLOYEES_VIEW: 'EMPLOYEES.{companyId}.EMPLOYEES.VIEW',
    EMPLOYEES_MANAGE: 'EMPLOYEES.{companyId}.EMPLOYEES.MANAGE',

    // Permission indépendante pour le reset de compte
    // RESET > MANAGE (donc quelqu’un qui a RESET a aussi MANAGE,
    // mais l’inverse n’est pas vrai)
    EMPLOYEES_RESET_ACCOUNT: 'EMPLOYEES.{companyId}.EMPLOYEES.RESET_ACCOUNT',
};

const HIERARCHY = {
    // Rangs
    [PERMISSIONS.RANKS_MANAGE]: [
        PERMISSIONS.RANKS_VIEW,
    ],

    // Employés : MANAGE inclut VIEW
    [PERMISSIONS.EMPLOYEES_MANAGE]: [
        PERMISSIONS.EMPLOYEES_VIEW,
    ],

    // RESET_ACCOUNT inclut EMPLOYEES_MANAGE (→ donc implicitement EMPLOYEES_VIEW aussi)
    [PERMISSIONS.EMPLOYEES_RESET_ACCOUNT]: [
        PERMISSIONS.EMPLOYEES_MANAGE,
    ],
};

const DESCRIPTIONS = {
    [PERMISSIONS.RANKS_VIEW]: "Voir les rangs",
    [PERMISSIONS.RANKS_MANAGE]: "Gérer les rangs",
    [PERMISSIONS.EMPLOYEES_VIEW]: "Voir les employés",
    [PERMISSIONS.EMPLOYEES_MANAGE]: "Gérer les employés",
    [PERMISSIONS.EMPLOYEES_RESET_ACCOUNT]: "Réinitialiser le compte d’un employé",
};

module.exports = {
    PERMISSIONS,
    HIERARCHY,
    DESCRIPTIONS
};
