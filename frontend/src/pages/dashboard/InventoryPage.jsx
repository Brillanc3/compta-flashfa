// /frontend/src/pages/dashboard/InventoryPage.jsx

import React, { useEffect, useMemo, useState } from "react";
import { WithContext as ReactTags } from "react-tag-input";
import { useInventory } from "@/hooks/useInventory";
import { useCompany } from "@/contexts/CompanyContext";
import InventoryTable from "@/components/inventory/InventoryTable";
import Spinner from "@/components/ui/Spinner";
import Select from "react-select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import InventoryManagementModal from "@/components/inventory/InventoryManagementModal";
import { getCompanyEmployees } from "@/services/employeesService";




const KeyCodes = {
    enter: 13,
    comma: 188,
};
const delimiters = [KeyCodes.enter, KeyCodes.comma];

export default function InventoryPage() {
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;

    const {
        filters,
        updateFilter,
        resetAllFilters,
        query,
    } = useInventory(companyId);

    const data = query.data?.results ?? [];
    const total = query.data?.total ?? 0;
    const mode = query.data?.mode ?? "SELF";

    const page = filters.page;
    const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [employees, setEmployees] = useState([]);

    useEffect(() => {
        if (companyId) {
            getCompanyEmployees(companyId, { status: 'ACTIVE' })
                .then(setEmployees)
                .catch(err => console.error("Error fetching employees:", err));
        }
    }, [companyId]);

    /* --------------------------------------------
       Helpers
    -------------------------------------------- */
    const setFilterAndResetPage = (key, value) => {
        updateFilter(key, value);
        if (filters.page !== 1) updateFilter("page", 1);
    };

    const parseCommaList = (value) => {
        if (!value) return [];
        return String(value)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 25);
    };

    /* --------------------------------------------
       Mobile: Search + quick filters (debounced)
    -------------------------------------------- */
    const [mobileSearch, setMobileSearch] = useState(() => (filters.tags || []).join(", "));
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => {
            setFilterAndResetPage("tags", parseCommaList(mobileSearch));
        }, 250);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mobileSearch]);

    const typeOptions = useMemo(
        () => [
            { value: "ALL", label: "Tous" },
            { value: "ADD", label: "Ajout" },
            { value: "REMOVE", label: "Retrait" },
        ],
        []
    );

    const mobileType = useMemo(() => {
        if (!filters.types?.length) return "ALL";
        return filters.types[0];
    }, [filters.types]);

    const setMobileType = (value) => {
        if (!value || value === "ALL") setFilterAndResetPage("types", []);
        else setFilterAndResetPage("types", [value]);
    };

    /* --------------------------------------------
       Helpers tags react-tag-input
    -------------------------------------------- */
    const tagProps = (key) => {
        const values = Array.isArray(filters[key]) ? filters[key] : [];

        return {
            tags: values.map((t) => ({ id: t, text: t })),
            handleAddition: (tag) => updateFilter(key, [...values, tag.text.trim()]),
            handleDelete: (idx) => {
                const updated = [...values];
                updated.splice(idx, 1);
                updateFilter(key, updated);
            },
            inputFieldPosition: "bottom",
            delimiters,
            placeholder: "Ajouter…",
            classNames: {
                tags: "flex flex-wrap gap-1.5 mb-1",
                tag:
                    "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 " +
                    "bg-brand-primary/10 text-brand-primary border border-brand-primary/20 backdrop-blur-md",
                remove: "cursor-pointer hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity",
                tagInputField:
                    "w-full bg-transparent text-cca-textPrimary placeholder:text-cca-textSecondary/40 border-none outline-none py-1 text-xs font-medium",
            },
        };
    };

    const TagField = ({ label, icon, field }) => (
        <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 block ml-1">
                {icon} {label}
            </label>

            <div className="
                relative overflow-hidden rounded-xl
                bg-cca-base/40 border border-cca-border backdrop-blur-sm p-2.5 shadow-sm
                focus-within:border-brand-primary/40 transition-colors
            ">
                <ReactTags {...tagProps(field)} />
            </div>
        </div>
    );

    const typeSelectStyles = {
        control: (styles, state) => ({
            ...styles,
            backgroundColor: "rgba(var(--bg-base-rgb, 15,23,42), 0.4)",
            borderColor: state.isFocused ? "var(--brand-primary)" : "var(--border-color)",
            borderRadius: 12,
            minHeight: 42,
            boxShadow: state.isFocused ? "0 0 0 1px var(--brand-primary)" : "none",
            backdropFilter: "blur(8px)",
            color: "var(--text-primary)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            "&:hover": { borderColor: "var(--brand-primary)" },
        }),
        menu: (styles) => ({
            ...styles,
            backgroundColor: "var(--bg-surface)",
            backdropFilter: "blur(20px)",
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid var(--border-color)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            zIndex: 40,
        }),
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        option: (styles, { isFocused, isSelected }) => ({
            ...styles,
            fontSize: 13,
            fontWeight: isSelected ? "700" : "500",
            padding: "10px 16px",
            background: isSelected
                ? "var(--brand-primary)"
                : isFocused
                    ? "rgba(var(--brand-primary-rgb), 0.1)"
                    : "transparent",
            color: isSelected ? "white" : "var(--text-primary)",
            cursor: "pointer",
            ":active": { backgroundColor: "var(--brand-primary)" },
        }),
        singleValue: (styles) => ({
            ...styles,
            color: "var(--text-primary)",
            fontSize: 13,
            fontWeight: 600,
        }),
        multiValue: (styles) => ({
            ...styles,
            backgroundColor: "rgba(var(--brand-primary-rgb), 0.1)",
            borderRadius: 8,
            padding: "2px 4px",
            border: "1px solid rgba(var(--brand-primary-rgb), 0.2)",
        }),
        multiValueLabel: (styles) => ({
            ...styles,
            color: "var(--brand-primary)",
            fontSize: 11,
            fontWeight: 700,
        }),
        multiValueRemove: (styles) => ({
            ...styles,
            color: "var(--brand-primary)",
            ":hover": {
                backgroundColor: "var(--brand-primary)",
                color: "white",
            },
            borderRadius: 6,
            marginLeft: 4,
            transition: "all 0.2s ease",
        }),
        placeholder: (styles) => ({
            ...styles,
            color: "rgba(var(--text-secondary-rgb), 0.4)",
            fontSize: 12,
        }),
        dropdownIndicator: (styles, state) => ({
            ...styles,
            color: state.isFocused ? "var(--brand-primary)" : "var(--text-secondary)",
            paddingInline: 8,
        }),
        indicatorSeparator: () => ({ display: "none" }),
    };

    const SelectType = () => {
        const options = [
            { value: "ALL", label: "Tous les types" },
            { value: "ADD", label: "Ajouts (+)" },
            { value: "REMOVE", label: "Retraits (-)" },
        ];

        const selected =
            filters.types.length === 0
                ? options[0] 
                : options.find((o) => o.value === filters.types[0]) || options[0];

        const handleChange = (option) => {
            if (!option || option.value === "ALL") {
                updateFilter("types", []); 
            } else {
                updateFilter("types", [option.value]);
            }
        };

        return (
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 block ml-1">
                    Flux
                </label>

                <Select
                    value={selected}
                    onChange={handleChange}
                    options={options}
                    styles={typeSelectStyles}
                    isSearchable={false}
                    placeholder="Flux…"
                    menuPortalTarget={document.body}
                />
            </div>
        );
    };

    const SelectOperator = () => {
        const options = employees.map(emp => ({
            value: emp.user.name,
            label: emp.user.name
        }));

        const selectedValues = filters.users.map(u => ({ value: u, label: u }));

        const handleChange = (selected) => {
            const values = selected ? selected.map(s => s.value) : [];
            setFilterAndResetPage("users", values);
        };

        return (
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 block ml-1">
                    Opérateur
                </label>

                <Select
                    isMulti
                    value={selectedValues}
                    onChange={handleChange}
                    options={options}
                    styles={typeSelectStyles}
                    placeholder="Sélectionner…"
                    noOptionsMessage={() => "Aucun employé trouvé"}
                    menuPortalTarget={document.body}
                />
            </div>
        );
    };

    const DateField = ({ label, field }) => (
        <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 block ml-1">
                {label}
            </label>
            <input
                type="date"
                value={filters[field] || ""}
                onChange={(e) => setFilterAndResetPage(field, e.target.value || null)}
                className="
                    w-full rounded-xl bg-cca-base/40 border border-cca-border backdrop-blur-sm
                    px-4 py-2 text-sm text-cca-textPrimary focus:border-brand-primary outline-none
                    transition-all min-h-[42px]
                "
            />
        </div>
    );

    const MobileTextFilter = ({ label, placeholder, value, onChange }) => (
        <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 block ml-1">
                {label}
            </label>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="
                    w-full rounded-xl bg-cca-base/40 border border-cca-border backdrop-blur-sm
                    px-4 py-3 text-sm text-cca-textPrimary placeholder:text-cca-textSecondary/30
                    focus:border-brand-primary outline-none transition-all
                "
            />
        </div>
    );

    const formatWhen = (iso) => {
        try {
            return format(new Date(iso), "d MMM yyyy HH:mm", { locale: fr });
        } catch {
            return "—";
        }
    };

    const InventoryCards = ({ rows }) => {
        if (!Array.isArray(rows) || rows.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-12 opacity-40">
                    <p className="text-sm font-bold uppercase tracking-widest text-cca-textSecondary">
                        Aucun résultat
                    </p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {rows.map((row) => (
                    <div
                        key={row.id}
                        className="
                            rounded-2xl border border-cca-border bg-cca-surface/30
                            backdrop-blur-xl shadow-xl p-5 group transition-all duration-300
                            hover:bg-brand-primary/5
                        "
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="font-black text-cca-textPrimary tracking-tight">
                                    {row.itemLabel || row.itemCode}
                                </p>
                                <p className="text-[10px] font-bold text-cca-textSecondary/60 uppercase tracking-tighter">
                                    {row.itemCode || "—"}
                                </p>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                <span className="text-xl font-black text-cca-textPrimary">
                                    {row.quantity}
                                </span>
                                {row.type === "ADD" ? (
                                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                        + Ajout
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                        − Retrait
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-cca-border/40 grid grid-cols-1 gap-3 text-xs">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/50">Opérateur</span>
                                <span className="font-bold text-cca-textPrimary">
                                    {row.user?.name || row.properName || "—"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/50">Emplacement</span>
                                <span className="font-bold text-cca-textPrimary">
                                    {row.ownerRef?.name || row.owner || "—"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/50">Date</span>
                                <span className="font-bold text-cca-textPrimary">
                                    {row.occurredAt ? formatWhen(row.occurredAt) : "—"}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary opacity-70">Logistique</p>
                    <h1 className="text-4xl font-black tracking-tighter text-cca-textPrimary font-heading">
                        Inventaire <span className="text-brand-primary">Global</span>
                    </h1>
                </div>
                
                <div className="flex items-center gap-3">
                     <button
                        onClick={() => setIsManageModalOpen(true)}
                        className="
                            px-4 py-2 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 
                            backdrop-blur-xl shadow-sm text-xs font-black uppercase tracking-widest text-brand-primary
                            hover:bg-brand-primary hover:text-white transition-all active:scale-95
                        "
                    >
                        ⚙️ Gérer les noms
                    </button>
                     <div className="px-4 py-2 rounded-2xl bg-cca-surface/40 border border-cca-border backdrop-blur-xl shadow-sm text-xs font-bold">
                        <span className="text-cca-textSecondary">Total :</span> <span className="text-brand-primary">{total}</span> <span className="text-cca-textSecondary/40 ml-1 uppercase tracking-widest text-[9px]">Mouvements</span>
                    </div>
                </div>
            </header>

            <InventoryManagementModal 
                isOpen={isManageModalOpen}
                onClose={() => setIsManageModalOpen(false)}
                onSaved={() => query.refetch()}
            />

            {/* ===================== MOBILE: SEARCH + FILTERS ===================== */}
            <div className="md:hidden space-y-4">
                <div className="
                    rounded-2xl border border-cca-border bg-cca-surface/30
                    backdrop-blur-xl shadow-xl p-5 space-y-5
                ">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 block ml-1">
                            Recherche Rapide
                        </label>
                        <input
                            value={mobileSearch}
                            onChange={(e) => setMobileSearch(e.target.value)}
                            placeholder="Objet, coffre, utilisateur…"
                            className="
                                w-full rounded-xl bg-cca-base/40 border border-cca-border
                                px-4 py-3 text-sm text-cca-textPrimary placeholder:text-cca-textSecondary/30
                                focus:border-brand-primary outline-none transition-all
                            "
                        />
                    </div>

                    <div className="flex gap-2 p-1 bg-cca-base/40 rounded-xl border border-cca-border">
                        {typeOptions.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setMobileType(opt.value)}
                                className={
                                    "flex-1 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.95] " +
                                    (mobileType === opt.value
                                        ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20"
                                        : "text-cca-textSecondary hover:text-cca-textPrimary")
                                }
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowMobileFilters((v) => !v)}
                            className="flex-1 px-4 py-3 rounded-xl bg-cca-surface/60 border border-cca-border text-[10px] font-black uppercase tracking-widest text-cca-textPrimary transition-all active:scale-95"
                        >
                            {showMobileFilters ? "Fermer Filtres" : "Plus de Filtres"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                resetAllFilters();
                                setMobileSearch("");
                            }}
                            className="px-4 py-3 rounded-xl bg-cca-surface/60 border border-cca-border text-[10px] font-black uppercase tracking-widest text-rose-500 transition-all active:scale-95"
                        >
                            Reset
                        </button>
                    </div>

                    {showMobileFilters && (
                        <div className="pt-4 border-t border-cca-border/40 space-y-5 animate-in slide-in-from-top-4 duration-300">
                            <MobileTextFilter
                                label="Coffre"
                                placeholder="Ex: Garage, Sac, Véhicule…"
                                value={(filters.coffre || []).join(", ")}
                                onChange={(v) => setFilterAndResetPage("coffre", parseCommaList(v))}
                            />

                            {mode === "ALL" && (
                                <div className="space-y-2">
                                     <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 block ml-1">
                                        Opérateur
                                    </label>
                                    <Select
                                        isMulti
                                        value={filters.users.map(u => ({ value: u, label: u }))}
                                        onChange={(sel) => setFilterAndResetPage("users", sel ? sel.map(o => o.value) : [])}
                                        options={employees.map(emp => ({ value: emp.user.name, label: emp.user.name }))}
                                        styles={typeSelectStyles}
                                        placeholder="Opérateur…"
                                        menuPortalTarget={document.body}
                                    />
                                </div>
                             )}

                            <MobileTextFilter
                                label="Objet"
                                placeholder="Ex: Tissu, Moteur, Pneu…"
                                value={(filters.items || []).join(", ")}
                                onChange={(v) => setFilterAndResetPage("items", parseCommaList(v))}
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <DateField label="Début" field="dateFrom" />
                                <DateField label="Fin" field="dateTo" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ===================== DESKTOP: FILTER BAR ===================== */}
            <div className="hidden md:block">
                <GlassSection title="Filtres Avancés" icon="⚡">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                        {/* Tag Search */}
                        <div className="xl:col-span-2">
                            <TagField label="Recherche Globale" icon="🔎" field="tags" />
                        </div>

                        {/* Coffre */}
                        <TagField label="Emplacement" icon="🧰" field="coffre" />

                        {/* Item */}
                        <TagField label="Référence Objet" icon="📦" field="items" />

                        {/* Type */}
                        <SelectType />

                        {/* Utilisateur */}
                        {mode === "ALL" && (
                            <SelectOperator />
                        )}

                        {/* Dates */}
                        <DateField label="Période (Début)" field="dateFrom" />
                        <DateField label="Période (Fin)" field="dateTo" />
                        
                        {/* RESET */}
                        <div className="xl:col-span-1 lg:col-span-1 flex flex-col justify-end">
                            <button
                                onClick={resetAllFilters}
                                className="w-full px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20
                                           text-rose-500 text-[10px] font-black uppercase tracking-widest h-[42px]
                                           hover:bg-rose-500 hover:text-white transition-all active:scale-95 shadow-lg shadow-rose-500/5"
                            >
                                Réinitialiser
                            </button>
                        </div>
                    </div>
                </GlassSection>
            </div>

            {/* ===================== TABLE SECTION ===================== */}
            <div className="space-y-4">
                <div className="md:hidden">
                    {query.isLoading ? (
                        <div className="flex justify-center py-20"><Spinner /></div>
                    ) : (
                        <InventoryCards rows={data} />
                    )}
                </div>

                <div className="hidden md:block">
                    <GlassTable>
                        {query.isLoading ? (
                            <div className="flex justify-center py-24"><Spinner /></div>
                        ) : (
                            <div className="p-1">
                                <InventoryTable data={data} />
                            </div>
                        )}
                    </GlassTable>
                </div>

                {/* ===================== PAGINATION ===================== */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t border-cca-border/20">
                    <div className="flex items-center gap-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60">
                            Page <span className="text-cca-textPrimary">{page}</span> sur {totalPages}
                        </p>
                        <div className="h-4 w-px bg-cca-border" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60">
                             <span className="text-cca-textPrimary">{total}</span> Résultats trouvés
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            disabled={page <= 1}
                            onClick={() => updateFilter("page", page - 1)}
                            className="
                                flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cca-surface/40 border border-cca-border 
                                text-[10px] font-black uppercase tracking-widest transition-all
                                disabled:opacity-20 disabled:cursor-not-allowed hover:bg-cca-surface hover:text-brand-primary active:scale-95
                            "
                        >
                            Précédent
                        </button>

                        <button
                            disabled={page >= totalPages}
                            onClick={() => updateFilter("page", page + 1)}
                            className="
                                flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cca-surface/40 border border-cca-border 
                                text-[10px] font-black uppercase tracking-widest transition-all
                                disabled:opacity-20 disabled:cursor-not-allowed hover:bg-cca-surface hover:text-brand-primary active:scale-95
                            "
                        >
                            Suivant
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* --------------------------------------------
   GLASS WRAPPERS
-------------------------------------------- */
function GlassSection({ title, icon, children }) {
    return (
        <div className="
            relative overflow-hidden rounded-3xl
            bg-cca-surface/30 border border-cca-border backdrop-blur-2xl
            shadow-2xl shadow-black/20 p-6 md:p-8 space-y-6
        ">
            <div className="
                pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay
                bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]
            " />

            <div className="flex items-center gap-3 relative">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl
                                bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shadow-sm">
                    {icon}
                </div>
                <h2 className="text-xs font-black text-cca-textPrimary uppercase tracking-[0.3em]">
                    {title}
                </h2>
            </div>

            <div className="relative">{children}</div>
        </div>
    );
}

function GlassTable({ children }) {
    return (
        <div className="
            relative overflow-hidden rounded-3xl
            bg-cca-surface/20 border border-cca-border backdrop-blur-3xl
            shadow-2xl shadow-black/30
        ">
             <div className="
                pointer-events-none absolute inset-0 opacity-[0.02] mix-blend-overlay
                bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]
            " />
            <div className="relative">{children}</div>
        </div>
    );
}

