// frontend/src/components/common/EntityMultiSelect.jsx
import React, { useMemo, useState } from "react";

export default function EntityMultiSelect({
                                              label,
                                              placeholder = "Rechercher…",
                                              items = [],
                                              selectedIds = [],
                                              onChangeSelectedIds,
                                              getId,
                                              renderItem,
                                              disabled = false,
                                          }) {
    const [q, setQ] = useState("");

    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    const filtered = useMemo(() => {
        const query = q.trim().toLowerCase();
        if (!query) return items;

        return items.filter((it) => {
            const text = renderItem(it).toLowerCase();
            return text.includes(query);
        });
    }, [q, items, renderItem]);

    const selectedItems = useMemo(() => {
        const map = new Map(items.map((it) => [getId(it), it]));
        return selectedIds.map((id) => map.get(id)).filter(Boolean);
    }, [items, selectedIds, getId]);

    function toggle(id) {
        if (disabled) return;
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChangeSelectedIds(Array.from(next));
    }

    function remove(id) {
        if (disabled) return;
        onChangeSelectedIds(selectedIds.filter((x) => x !== id));
    }

    return (
        <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-100">{label}</div>

            <input
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 disabled:opacity-60"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
            />

            {/* Selected chips */}
            {selectedItems.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selectedItems.map((it) => {
                        const id = getId(it);
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => remove(id)}
                                disabled={disabled}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs disabled:opacity-60"
                                title="Retirer"
                            >
                                {renderItem(it)} <span className="opacity-70">×</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* List */}
            <div className="max-h-60 overflow-auto border border-slate-700 rounded-lg">
                {filtered.length === 0 ? (
                    <div className="p-3 text-sm text-slate-400">Aucun résultat</div>
                ) : (
                    <ul className="divide-y divide-slate-800">
                        {filtered.map((it) => {
                            const id = getId(it);
                            const active = selectedSet.has(id);
                            return (
                                <li key={id}>
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => toggle(id)}
                                        className={`w-full text-left px-3 py-2 text-sm disabled:opacity-60 ${
                                            active
                                                ? "bg-indigo-600/15 text-indigo-100"
                                                : "bg-slate-900/40 hover:bg-slate-900/70 text-slate-200"
                                        }`}
                                    >
                                        {renderItem(it)}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <div className="text-xs text-slate-400">
                Sélection: {selectedIds.length}
            </div>
        </div>
    );
}
