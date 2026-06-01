// backend/src/modules/employees-hr/employees-hr.permissions.js
'use strict';

const PERMISSIONS = {
    HR_VIEW:   'EMPLOYEES.RH.VIEW',
    HR_MANAGE: 'EMPLOYEES.RH.MANAGE',
};

const HIERARCHY = {
    [PERMISSIONS.HR_MANAGE]: [PERMISSIONS.HR_VIEW],
};

const DESCRIPTIONS = {
    [PERMISSIONS.HR_VIEW]:   'Voir le dossier RH des employés',
    [PERMISSIONS.HR_MANAGE]: 'Gérer le dossier RH des employés',
};

module.exports = { PERMISSIONS, HIERARCHY, DESCRIPTIONS };
