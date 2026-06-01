// src/chat/components/ChatChannelItem.jsx

import React from "react";
import { Hash, MoreVertical } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

export default function ChatChannelItem({ channel }) {
    const activeChannelId = useChatStore((s) => s.activeChannelId);
    const setActiveChannel = useChatStore((s) => s.setActiveChannel);

    const isActive = String(activeChannelId) === String(channel.id);

    return (
        <div
            className={`
                flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer
                group mb-1 transition-all active:scale-[0.98]
                ${isActive 
                    ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
                    : "text-cca-textSecondary hover:bg-cca-base hover:text-cca-textPrimary"}
            `}
            onClick={() => setActiveChannel(channel.id)}
        >
            <div className="flex items-center gap-3 truncate">
                <Hash className={`w-4.5 h-4.5 ${isActive ? "text-white/70" : "text-cca-textSecondary/40 group-hover:text-cca-textPrimary/60"}`} />
                <span className="truncate font-semibold text-sm">{channel.name}</span>
            </div>

            <MoreVertical className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
}
