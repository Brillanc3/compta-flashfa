// frontend/src/components/inventory/InventoryFilters.jsx

export default function InventoryFilters({ filters, updateFilter, mode, items, users }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">

            {/* TYPE */}
            <div className="relative z-20">
                <label className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 block">
                    Type
                </label>
                <select
                    multiple
                    value={filters.types}
                    onChange={(e) =>
                        updateFilter(
                            "types",
                            Array.from(e.target.selectedOptions).map((o) => o.value)
                        )
                    }
                    className="
            w-full rounded-lg bg-slate-900 border border-slate-700
            px-3 py-2.5 text-sm text-slate-100 hover:border-slate-500/80
            focus:border-indigo-400 focus:ring-2 outline-none
        "
                >
                    <option value="ADD">Ajout</option>
                    <option value="REMOVE">Retrait</option>
                </select>
            </div>

            {/* ITEMS */}
            <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 block">
                    Items
                </label>
                <select
                    multiple
                    value={filters.items}
                    onChange={(e) =>
                        updateFilter(
                            "items",
                            Array.from(e.target.selectedOptions).map((o) => o.value)
                        )
                    }
                    className="
                        w-full rounded-lg bg-slate-900/60 border border-slate-700/80
                        px-3 py-2.5 text-sm text-slate-100 hover:border-slate-500/80
                        focus:border-indigo-400 focus:ring-2 outline-none
                    "
                >
                    {items.map((code) => (
                        <option key={code} value={code}>{code}</option>
                    ))}
                </select>
            </div>

            {/* USERS */}
            {mode === "ALL" && (
                <div>
                    <label className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 block">
                        Utilisateurs
                    </label>
                    <select
                        multiple
                        value={filters.users}
                        onChange={(e) =>
                            updateFilter(
                                "users",
                                Array.from(e.target.selectedOptions).map((o) => o.value)
                            )
                        }
                        className="
                            w-full rounded-lg bg-slate-900/60 border border-slate-700/80
                            px-3 py-2.5 text-sm text-slate-100 hover:border-slate-500/80
                            focus:border-indigo-400 focus:ring-2 outline-none
                        "
                    >
                        {users.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* DATE FROM */}
            <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 block">
                    Date début
                </label>
                <input
                    type="date"
                    value={filters.dateFrom || ""}
                    onChange={(e) => updateFilter("dateFrom", e.target.value)}
                    className="
                        w-full rounded-lg bg-slate-900/60 border border-slate-700/80
                        px-3 py-2.5 text-sm text-slate-100 focus:border-indigo-400 outline-none
                    "
                />
            </div>

            {/* DATE TO */}
            <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 block">
                    Date fin
                </label>
                <input
                    type="date"
                    value={filters.dateTo || ""}
                    onChange={(e) => updateFilter("dateTo", e.target.value)}
                    className="
                        w-full rounded-lg bg-slate-900/60 border border-slate-700/80
                        px-3 py-2.5 text-sm text-slate-100 focus:border-indigo-400 outline-none
                    "
                />
            </div>

        </div>
    );
}
