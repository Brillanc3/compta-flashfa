// frontend/src/components/inventory/InventorySearchTags.jsx

import { X } from "lucide-react";
import { useState } from "react";

export default function InventorySearchTags({ tags, addTag, removeTag }) {
    const [input, setInput] = useState("");

    function handleKeyDown(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            addTag(input);
            setInput("");
        }
    }

    return (
        <div className="
            relative overflow-hidden rounded-xl
            bg-gradient-to-r from-slate-900/80 via-slate-800/90 to-slate-900/80
            border border-slate-700/70 shadow-lg shadow-slate-900/40 p-4
        ">
            {/* Halo */}
            <div className="
                pointer-events-none absolute inset-0 opacity-40 mix-blend-screen
                [background:
                    radial-gradient(circle_at_top,_rgba(79,70,229,0.35),_transparent_55%),
                    radial-gradient(circle_at_bottom,_rgba(8,47,73,0.6),_transparent_55%)
                ]
            " />

            <div className="relative space-y-3">
                <h2 className="text-sm font-semibold text-slate-200 tracking-wide flex items-center gap-2">
                    <span className="
                        inline-flex h-6 w-6 items-center justify-center rounded-full
                        bg-indigo-500/20 text-xs text-indigo-300 border border-indigo-500/40">
                        🔍
                    </span>
                    Recherche avancée
                </h2>

                {/* TAGS */}
                <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                        <span
                            key={tag}
                            className="
                                px-3 py-1 rounded-full text-sm font-medium
                                bg-indigo-500/20 text-indigo-300 border border-indigo-500/30
                                backdrop-blur-sm flex items-center gap-2
                            "
                        >
                            {tag}
                            <X
                                className="w-4 h-4 cursor-pointer hover:text-red-400 transition"
                                onClick={() => removeTag(tag)}
                            />
                        </span>
                    ))}
                </div>

                {/* INPUT */}
                <input
                    type="text"
                    placeholder="Tapez un mot et appuyez sur Entrée…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="
                        w-full bg-slate-900/60 border border-slate-700/80 rounded-lg
                        px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500
                        focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 outline-none
                    "
                />
            </div>
        </div>
    );
}
