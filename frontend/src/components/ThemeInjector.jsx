import React, { useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/contexts/PermissionsContext";

export default function ThemeInjector() {
    const { activeCompanyId, useCompanyTheme } = useCompany();
    const { companyModules, isReady } = usePermissions();

    useEffect(() => {
        const linkId = "company-custom-theme-style";
        let linkElement = document.getElementById(linkId);

        // Si le contexte de permission n'est pas encore prêt, ou si l'entreprise n'a pas le module, on enlève/ne met pas le style.
        const hasCustomization = isReady && companyModules && companyModules.includes("customization");

        if (!activeCompanyId || !useCompanyTheme || !hasCustomization) {
            if (linkElement) linkElement.remove();
            return;
        }

        const timestamp = Date.now();
        const url = `/api/customization/${activeCompanyId}/theme.css?t=${timestamp}`;

        if (!linkElement) {
            linkElement = document.createElement("link");
            linkElement.id = linkId;
            linkElement.rel = "stylesheet";
            document.head.appendChild(linkElement);
        }
        linkElement.href = url;

    }, [activeCompanyId, useCompanyTheme, companyModules, isReady]);

    return null;
}
