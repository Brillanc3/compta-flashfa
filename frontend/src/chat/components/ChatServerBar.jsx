// src/chat/components/ChatServerBar.jsx

import React, { useState, useCallback } from "react";
import { MessageSquare, User, Home, CheckCheck } from "lucide-react";
import { useChatUIStore } from "../store/useChatUIStore";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTotalUnreadCounts, markGuildAsRead } from "@/services/chatService";
import { useChatStore } from "../store/useChatStore";

export default function ChatServerBar() {
    const activeTab = useChatUIStore((s) => s.activeTab);
    const setActiveTab = useChatUIStore((s) => s.setActiveTab);

    const { companies } = useAuth();
    const ensureInitialized = useChatStore((s) => s.ensureInitialized);
    const initializedCompanyId = useChatStore((s) => s.initializedCompanyId);
    const queryClient = useQueryClient();

    const [contextMenu, setContextMenu] = useState(null); // { x, y, companyId }

    const totalUnreadQuery = useQuery({
        queryKey: ["chat", "total-unread-counts"],
        queryFn: getTotalUnreadCounts,
        staleTime: 0,
    });

    const totalUnreads = totalUnreadQuery.data || {};

    const handleCompanyClick = (companyId) => {
        setActiveTab("channels");
        ensureInitialized(companyId);
    };

    const handleContextMenu = useCallback((e, companyId) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, companyId });
    }, []);

    const closeContextMenu = useCallback(() => setContextMenu(null), []);

    const handleMarkAsRead = useCallback(async () => {
        if (!contextMenu) return;
        const { companyId } = contextMenu;
        closeContextMenu();
        await markGuildAsRead(companyId);
        queryClient.invalidateQueries({ queryKey: ["chat", "total-unread-counts"] });
        queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
    }, [contextMenu, closeContextMenu, queryClient]);

    const getInitials = (name) => {
        return name?.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2) || "??";
    };

    return (
        <>
        <aside className="w-[72px] bg-cca-surface/60 flex flex-col items-center py-3 gap-3 border-r border-cca-border backdrop-blur-xl overflow-y-auto no-scrollbar select-none z-10 transition-colors duration-300">
            {/* Direct Messages Icon (HOME in Discord) */}
            <ServerBarItem
                id="dms"
                active={activeTab === "dms"}
                onClick={() => setActiveTab("dms")}
                icon={<User className="w-6 h-6" />}
                label="Messages Privés"
                color="bg-brand-primary"
            />

            {/* Divider */}
            <div className="w-8 h-[2px] bg-cca-border rounded-full my-1 opacity-50" />

            {/* Guilds / Companies Icons */}
            {companies.map((company) => {
                const isActive = activeTab === "channels" && String(initializedCompanyId) === String(company.id);
                const companyData = totalUnreads[company.id] || {};
                const unreadCount = typeof companyData === 'object'
                    ? Number(companyData.unread || 0)
                    : Number(companyData || 0);
                const mentionCount = typeof companyData === 'object'
                    ? Number(companyData.mentions || 0)
                    : 0;

                return (
                    <ServerBarItem
                        key={company.id}
                        id={company.id}
                        active={isActive}
                        hasUnread={unreadCount > 0}
                        hasMention={mentionCount > 0}
                        onClick={() => handleCompanyClick(company.id)}
                        onContextMenu={(e) => handleContextMenu(e, company.id)}
                        icon={
                            company.imageUrl ? (
                                <img
                                    src={company.imageUrl}
                                    alt={company.name}
                                    className="w-full h-full object-cover rounded-inherit"
                                />
                            ) : (
                                <span className="font-bold text-sm tracking-tighter">
                                    {getInitials(company.name)}
                                </span>
                            )
                        }
                        label={company.name}
                        color="bg-cca-base"
                        badge={unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : null}
                    />
                );
            })}
        </aside>

        {contextMenu && (
            <>
                <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
                <div
                    className="fixed z-50 bg-cca-surface border border-cca-border rounded-lg shadow-xl py-1 min-w-[180px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        onClick={handleMarkAsRead}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-cca-textSecondary hover:bg-cca-hover hover:text-cca-textPrimary transition-colors"
                    >
                        <CheckCheck className="w-4 h-4" />
                        Marquer comme lu
                    </button>
                </div>
            </>
        )}
        </>
    );
}

function ServerBarItem({ active, hasUnread, hasMention, onClick, onContextMenu, icon, label, color = "bg-cca-base", badge = null }) {
    return (
        <div className="relative group flex items-center justify-center w-full px-3">
            {/* Active/Presence Pill indicator on the very left */}
            <div
                className={`
                    absolute left-0 w-1 bg-cca-textPrimary rounded-r-full transition-all duration-300
                    ${active ? "h-10 opacity-100" : hasUnread ? "h-2 opacity-100" : "h-2 opacity-0 group-hover:opacity-100 group-hover:h-5"}
                `}
            />

            {/* Icon Container */}
            <div
                onClick={onClick}
                onContextMenu={onContextMenu}
                title={label}
                className={`
                    relative flex items-center justify-center w-8 h-8 transition-all duration-200 cursor-pointer overflow-visible
                    ${active ? "rounded-lg bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : `${color} text-cca-textSecondary group-hover:rounded-lg group-hover:bg-brand-primary group-hover:text-white rounded-xl`}
                `}
            >
                {icon}

                    {/* Count badge — mentions (red) or unreads (white), bottom-right */}
                {!active && badge !== null && (
                    <div className={`absolute -bottom-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full border-2 border-cca-surface z-20 flex items-center justify-center text-[9px] font-black leading-none ${hasMention ? "bg-red-500 text-white" : "bg-white text-cca-surface"}`}>
                        {badge}
                    </div>
                )}

                {/* Dot fallback — unread without count */}
                {!active && badge === null && hasMention && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-cca-surface z-20" />
                )}
                {!active && badge === null && !hasMention && hasUnread && (
                    <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full bg-white border-2 border-cca-surface z-20" />
                )}
            </div>
        </div>
    );
}
