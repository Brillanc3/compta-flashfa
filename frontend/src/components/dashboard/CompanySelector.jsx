// frontend/src/components/dashboard/CompanySelector.jsx
import React, { useMemo } from "react";
import Select from "react-select";
import { useCompany } from "../../contexts/CompanyContext";

const selectStyles = {
    control: (styles, state) => ({
        ...styles,
        backgroundColor: "rgba(127,127,127,0.05)",
        borderColor: state.isFocused ? "#6366f1" : "rgba(127,127,127,0.2)",
        borderRadius: 14,
        minHeight: 48,
        boxShadow: state.isFocused ? "0 0 0 1px rgba(99,102,241,0.2)" : "none",
        backdropFilter: "blur(10px)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        "&:hover": {
            borderColor: "rgba(99,102,241,0.5)",
            backgroundColor: "rgba(127,127,127,0.1)",
        },
    }),
    menu: (styles) => ({
        ...styles,
        backgroundColor: "var(--cca-surface-bg, rgba(15,23,42,0.9))",
        backdropFilter: "blur(20px)",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(127,127,127,0.2)",
        boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        zIndex: 100,
        padding: 6,
    }),
    option: (styles, { isFocused, isSelected }) => ({
        ...styles,
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 10,
        marginBottom: 2,
        padding: "10px 14px",
        backgroundColor: isSelected
            ? "#6366f1"
            : isFocused
            ? "rgba(99,102,241,0.15)"
            : "transparent",
        color: isSelected ? "#ffffff" : "var(--cca-text-primary)",
        cursor: "pointer",
        transition: "all 0.1s ease",
        ":active": {
            backgroundColor: "rgba(99,102,241,0.3)",
        },
    }),
    singleValue: (styles) => ({
        ...styles,
        color: "var(--cca-text-primary)",
        fontSize: 13,
        fontWeight: 700,
    }),
    placeholder: (styles) => ({
        ...styles,
        color: "var(--cca-text-secondary)",
        opacity: 0.5,
        fontSize: 12,
    }),
    input: (styles) => ({
        ...styles,
        color: "var(--cca-text-primary)",
    }),
    dropdownIndicator: (styles, state) => ({
        ...styles,
        color: state.isFocused ? "#6366f1" : "var(--cca-text-secondary)",
        paddingInline: 8,
        ":hover": {
            color: "#6366f1",
        },
    }),
    indicatorSeparator: () => ({ display: "none" }),
};

const CompanySelector = () => {
    const { companies, activeCompany, switchCompany } = useCompany();

    const companyOptions = useMemo(
        () => (companies || []).map((company) => ({
            value: company.id,
            label: company.name,
        })),
        [companies]
    );

    const selectedOption = useMemo(
        () => companyOptions.find(opt => String(opt.value) === String(activeCompany?.id)) || null,
        [companyOptions, activeCompany]
    );

    return (
        <div className="relative group">
            <div className="relative space-y-4">
                <div className="flex items-center gap-4 transition-transform duration-300 group-hover:translate-x-1">
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-brand-primary to-indigo-500 p-[1px] shadow-lg shadow-brand-primary/10">
                        <div className="w-full h-full rounded-[15px] bg-cca-base flex items-center justify-center text-xs font-black text-brand-primary">
                            {activeCompany?.name
                                ? activeCompany.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
                                : "CO"}
                        </div>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/50 leading-none mb-1">
                            Entreprise principale
                        </p>
                        <p className="text-sm font-black text-cca-textPrimary truncate tracking-tight">
                            {activeCompany?.name || "Non identifiée"}
                        </p>
                    </div>
                </div>

                <Select
                    inputId="company-selector"
                    options={companyOptions}
                    value={selectedOption}
                    onChange={(opt) => opt && switchCompany(opt.value)}
                    styles={selectStyles}
                    placeholder="Changer d'entité..."
                    isSearchable={false}
                    menuPlacement="auto"
                />
            </div>
        </div>
    );
};

export default CompanySelector;
