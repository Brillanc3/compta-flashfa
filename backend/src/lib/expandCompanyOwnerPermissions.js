function expandCompanyOwnerPermissions({
                                           permissions,
                                           companyId,
                                           companyModules,
                                           modulePermissionsMap,
                                       }) {
    if (!permissions.has(`COMPANY.${companyId}.*`)) {
        return permissions;
    }

    for (const moduleName of companyModules) {
        const perms = modulePermissionsMap[moduleName];
        if (!Array.isArray(perms)) continue;

        for (const perm of perms) {
            permissions.add(
                perm.replace('{companyId}', String(companyId))
            );
        }
    }

    return permissions;
}

module.exports = expandCompanyOwnerPermissions;
