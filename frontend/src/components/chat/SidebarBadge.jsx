// src/components/chat/SidebarBadge.jsx
import React from "react";

/**
 * Petit badge stylé utilisé dans la sidebar (tickets, états, catégories…)
 * Couleurs disponibles : slate, green, red, yellow, blue, indigo, purple
 */
export default function SidebarBadge({ children, color = "slate" }) {
    const COLORS = {
        slate: "bg-slate-700/60 text-slate-200 border-slate-600",
        green: "bg-emerald-700/60 text-white border-emerald-600",
        red: "bg-rose-700/60 text-white border-rose-600",
        yellow: "bg-amber-600/60 text-white border-amber-500",
        blue: "bg-blue-700/60 text-white border-blue-600",
        indigo: "bg-indigo-700/60 text-white border-indigo-600",
        purple: "bg-purple-700/60 text-white border-purple-600",
    };

    return (
        <span
            className={`
                inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium
                border backdrop-blur-sm
                ${COLORS[color] || COLORS.slate}
            `}
        >
            {children}
        </span>
    );
}
