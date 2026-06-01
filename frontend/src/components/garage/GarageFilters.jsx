// /frontend/src/components/garage/GarageFilters.jsx

import React from "react";
import Select from "react-select";
import { WithContext as ReactTags } from "react-tag-input";

const KeyCodes = {
    comma: 188,
    enter: 13,
};
const delimiters = [KeyCodes.enter, KeyCodes.comma];

const typeOptions = [
    { value: "", label: "Tous" },
    { value: "OUT", label: "Sortie" },
    { value: "IN", label: "Rangement" },
];

// Styles react-select PREMIUM GLASS identiques CompanySelector
const selectStyles = {
    control: (styles, state) => ({
        ...styles,
        backgroundColor: "var(--cca-base)",
        borderColor: state.isFocused ? "#6366f1" : "var(--cca-border)",
        borderRadius: 12,
        minHeight: 40,
        boxShadow: "none",
        borderWidth: "1px",
        outline: "none",
        backdropFilter: "blur(10px)",
        color: "var(--cca-textPrimary)",
        cursor: "pointer",
        "&:hover": {
            borderColor: state.isFocused ? "#6366f1" : "var(--cca-textSecondary)",
        },
    }),
    menu: (styles) => ({
        ...styles,
        backgroundColor: "var(--cca-surface)",
        backdropFilter: "blur(16px)",
        borderRadius: 12,
        border: "1px solid var(--cca-border)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.65)",
        zIndex: 50,
    }),
    option: (styles, { isFocused, isSelected }) => ({
        ...styles,
        fontSize: 13,
        paddingTop: 8,
        paddingBottom: 8,
        background: isSelected
            ? "rgba(99, 102, 241, 0.2)"
            : isFocused
                ? "rgba(99, 102, 241, 0.1)"
                : "transparent",
        color: "var(--cca-textPrimary)",
    }),
    singleValue: (styles) => ({
        ...styles,
        color: "var(--cca-textPrimary)",
        fontSize: 13,
        fontWeight: 500,
    }),
    placeholder: (styles) => ({
        ...styles,
        color: "var(--cca-textSecondary)",
        opacity: 0.5,
        fontSize: 12,
    }),
};

function GarageFilters({
                                          filters,
                                          updateFilter,
                                          addTag,
                                          removeTag,
                                          resetAllFilters,
                                      }) {
    /* ---------------- TAGS ---------------- */
    const tagItems = filters.tags.map((t) => ({ id: t, text: t }));

    const handleTagDelete = (i) => {
        removeTag(filters.tags[i]);
    };

    const handleTagAddition = (tag) => {
        addTag(tag.text);
    };

    return (
        <div className="
            relative overflow-hidden rounded-xl
            bg-cca-surface
            border border-cca-border shadow-lg shadow-black/20 p-5
        ">
            <div className="
                pointer-events-none absolute inset-0 opacity-10
                [background:
                    radial-gradient(circle_at_top,_#6366f1,transparent_50%),
                    radial-gradient(circle_at_bottom,_#0891b2,transparent_50%)
                ]
            " />

            <div className="relative space-y-5">

                {/* --------------------------------------------------------------------
                    TAGS GLOBAUX
                -------------------------------------------------------------------- */}
                <div>
                    <label className="text-[11px] uppercase tracking-wide text-cca-textSecondary block mb-2">
                        Recherche globale (tags)
                    </label>

                    <ReactTags
                        tags={tagItems}
                        delimiters={delimiters}
                        handleDelete={handleTagDelete}
                        handleAddition={handleTagAddition}
                        inputFieldPosition="inline"
                        placeholder="Ajouter un tag…"
                        classNames={{
                            tags: "flex flex-wrap gap-2",
                            tagInputField:
                                "mt-2 bg-cca-base border border-cca-border rounded-lg px-3 py-2 text-sm text-cca-textPrimary focus:outline-none focus:border-indigo-400 transition",
                            tag:
                                "px-3 py-1 bg-indigo-600/20 text-indigo-400 rounded-full text-xs border border-indigo-500/40",
                            remove:
                                "ml-2 cursor-pointer text-indigo-400 hover:text-indigo-600",
                        }}
                    />
                </div>

                {/* --------------------------------------------------------------------
                    TYPE (IN / OUT)
                -------------------------------------------------------------------- */}
                <div>
                    <label className="text-[11px] uppercase tracking-wide text-cca-textSecondary mb-1 block">
                        Type de mouvement
                    </label>

                    <Select
                        options={typeOptions}
                        styles={selectStyles}
                        placeholder="Tous"
                        isSearchable={false}
                        value={
                            typeOptions.find((o) => o.value === (filters.types[0] || "")) ||
                            typeOptions[0]
                        }
                        onChange={(opt) =>
                            updateFilter("types", opt.value ? [opt.value] : [])
                        }
                    />
                </div>

                {/* --------------------------------------------------------------------
                    DATES
                -------------------------------------------------------------------- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[11px] uppercase tracking-wide text-cca-textSecondary mb-1 block">
                            Date début
                        </label>
                        <input
                            type="date"
                            value={filters.dateFrom || ""}
                            onChange={(e) => updateFilter("dateFrom", e.target.value)}
                            className="w-full rounded-lg bg-cca-base border border-cca-border
                                       px-3 py-2 text-sm text-cca-textPrimary focus:border-indigo-400 outline-none transition"
                        />
                    </div>

                    <div>
                        <label className="text-[11px] uppercase tracking-wide text-cca-textSecondary mb-1 block">
                            Date fin
                        </label>
                        <input
                            type="date"
                            value={filters.dateTo || ""}
                            onChange={(e) => updateFilter("dateTo", e.target.value)}
                            className="w-full rounded-lg bg-cca-base border border-cca-border
                                       px-3 py-2 text-sm text-cca-textPrimary focus:border-indigo-400 outline-none transition"
                        />
                    </div>
                </div>

                {/* --------------------------------------------------------------------
                    RESET
                -------------------------------------------------------------------- */}
                <div className="flex justify-end">
                    <button
                        onClick={resetAllFilters}
                        className="
                            px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-cca-base
                            border border-cca-border hover:bg-cca-border text-cca-textSecondary
                            active:scale-95 transition
                        "
                    >
                        Réinitialiser les filtres
                    </button>
                </div>

            </div>
        </div>
    );
}

export default React.memo(GarageFilters);
