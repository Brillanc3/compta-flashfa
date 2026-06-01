import React from "react";
import { Hash } from "lucide-react";

export default function ChatSidebarCategory({
                                                category,
                                                channels,
                                                currentChannelId,
                                                onSelectChannel
                                            }) {
    return (
        <div className="mb-4">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cca-textSecondary/50 select-none">
                {category.name}
            </div>

            <div className="space-y-0.5">
                {channels.map(ch => (
                    <div
                        key={ch.id}
                        onClick={() => onSelectChannel(ch.id)}
                        className={`
                            group mx-2 px-3 py-2 rounded-xl cursor-pointer transition-all active:scale-[0.98]
                            flex items-center gap-3
                            ${currentChannelId === ch.id
                                ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20"
                                : "text-cca-textSecondary hover:bg-cca-surface hover:text-cca-textPrimary"}
                        `}
                    >
                        <Hash className={`w-4 h-4 ${currentChannelId === ch.id ? "text-white/70" : "text-cca-textSecondary/40 group-hover:text-cca-textPrimary/60"}`} />
                        <span className="font-semibold text-sm truncate">{ch.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
