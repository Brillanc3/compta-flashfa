import React, { useState, useEffect, useMemo, useCallback } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

import {
    Home,
    Settings,
    FileText as FileTextIcon,
    Briefcase,
    LogOut,
    Lock,
    User,
    MessageSquare,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Package,
    Star,
    Store,
    Calendar,
    Handshake,
    Users,
    Car,
    Box,
    NewspaperIcon,
    Timer,
    Link2,
    BookOpen,
    Layout,
    Shield,
    Tv,
    Zap,
    Sun,
    Moon,
    Bot,
    BarChart2,
    Globe as GlobeIcon,
    Megaphone,
    Key,
} from "lucide-react";

import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/contexts/PermissionsContext";

import Logo from "../Logo";
import NotificationBell from "../layout/NotificationBell";
import CompanySelector from "./CompanySelector";
import { getCustomPagesNav } from "@/services/customPagesService";
import { getTotalUnreadCounts } from "@/services/chatService";
import { useTheme } from "@/hooks/useTheme";
import { useAudioNotification } from "@/hooks/useAudioNotification";
import { useChannelStore } from "@/modules/tchatv2/stores/channelStore";
import { useForumPostSubStore } from "@/modules/tchatv2/stores/forumPostSubStore";

/* -------------------------------------------------------------------------- */
/* HELPERS */
/* -------------------------------------------------------------------------- */

function replaceCompanyIdInPath(path, companyId) {
    if (!path) return "";
    if (path === "/dashboard/calendar" || path === "/dashboard/chat") return path;
    return path.replace(":companyId", String(companyId));
}

function resolvePermissionTemplate(permission, companyId) {
    if (!permission) return permission;
    return String(permission).replace("{companyId}", String(companyId));
}

function normalizePath(p) {
    if (!p) return "";
    const s = String(p);
    if (s.length > 1 && s.endsWith("/")) return s.slice(0, -1);
    return s;
}

function startsWithPathSegment(cur, base) {
    const c = normalizePath(cur);
    const b = normalizePath(base);
    if (!b) return false;
    if (c === b) return true;
    return c.startsWith(b + "/");
}

function isPathActive(curPath, targetPath, { mode = "exact", excludePrefixes = [] } = {}) {
    const cur = normalizePath(curPath);
    const tgt = normalizePath(targetPath);

    if (!tgt) return false;

    let ok = false;
    if (mode === "prefix") ok = startsWithPathSegment(cur, tgt);
    else ok = cur === tgt;

    if (!ok) return false;

    for (const ex of excludePrefixes) {
        if (!ex) continue;
        if (startsWithPathSegment(cur, ex)) return false;
    }

    return true;
}

function computeItemActive(item, curPath, companyId) {
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;

    if (hasChildren) {
        return item.children.some((child) => computeItemActive(child, curPath, companyId));
    }

    const finalPath = replaceCompanyIdInPath(item.path, companyId);
    if (!finalPath) return false;

    const m = item.activeMatch || { mode: "exact" };

    // Catalogue produits actif sur /products (+ new/edit) mais PAS sur /products/declarations/*
    if (m.mode === "productsCatalog") {
        const base = "/dashboard/company/products";
        const exclude = "/dashboard/company/products/declarations";
        return startsWithPathSegment(curPath, base) && !startsWithPathSegment(curPath, exclude);
    }

    return isPathActive(curPath, finalPath, m);
}

const CUSTOM_PAGE_ICON_MAP = {
    FileText: FileTextIcon,
    Link2,
    BookOpen,
    Layout,
    Shield,
    Timer,
    NewspaperIcon,
};

function getCustomPageIcon(name) {
    const key = String(name || "").trim();
    return CUSTOM_PAGE_ICON_MAP[key] || FileTextIcon;
}

/* -------------------------------------------------------------------------- */
/* NAV ITEM */
/* -------------------------------------------------------------------------- */

function NavItem({ item, collapsed, companyId, onNavigate }) {
    const location = useLocation();
    const { has, companyModules, isReady } = usePermissions();

    const hasChildren = Array.isArray(item.children) && item.children.length > 0;

    const needsPerms = Boolean(
        item.module ||
        item.permission ||
        (hasChildren && item.children?.some((c) => c.module || c.permission || c.permissions))
    );

    const moduleOK = !item.module || companyModules.includes(item.module);
    const permissionSpec = item.permissions ?? item.permission;
    const permissionOK = !permissionSpec
        ? true
        : Array.isArray(permissionSpec)
            ? permissionSpec.some((p) => has(resolvePermissionTemplate(p, companyId)))
            : has(resolvePermissionTemplate(permissionSpec, companyId));

    const visibleChildren = useMemo(() => {
        if (!hasChildren) return [];
        return item.children.filter((child) => {
            const mOK = !child.module || companyModules.includes(child.module);
            const childPermSpec = child.permissions ?? child.permission;
            const pOK = !childPermSpec
                ? true
                : Array.isArray(childPermSpec)
                    ? childPermSpec.some((p) => has(resolvePermissionTemplate(p, companyId)))
                    : has(resolvePermissionTemplate(childPermSpec, companyId));
            return mOK && pOK;
        });
    }, [hasChildren, item.children, companyModules, has, companyId]);

    const finalPath = replaceCompanyIdInPath(item.path, companyId);

    // All hooks before early returns (React rules of hooks)
    const isActiveSelf = useMemo(() => {
        return computeItemActive(
            { ...item, children: hasChildren ? visibleChildren : item.children },
            location.pathname,
            companyId
        );
    }, [location.pathname, companyId, item, hasChildren, visibleChildren]);

    const isActiveSub = hasChildren ? isActiveSelf : false;
    const [open, setOpen] = useState(isActiveSub);
    useEffect(() => setOpen(isActiveSub), [isActiveSub]);

    // Early returns after all hooks
    if (needsPerms && !isReady) return null;
    if (item.forceAdmin && !has("ADMIN.PANEL.ACCESS")) return null;
    if (!hasChildren && (!moduleOK || !permissionOK)) return null;
    if (hasChildren && visibleChildren.length === 0) return null;

    const base =
        "flex items-center w-full rounded-lg transition-all duration-300 text-cca-textSecondary hover:text-cca-textPrimary hover:bg-brand-primary/10 active:scale-95";

    const activeClass = "bg-brand-primary/10 border border-brand-primary/40 text-cca-textPrimary shadow-sm";

    const badgeText =
        item?.badge !== undefined && item?.badge !== null && item?.badge !== "" && item?.badge !== 0
            ? String(item.badge)
            : null;

    if (collapsed) {
        if (hasChildren && !finalPath) {
            return (
                <div className="mb-1">
                    <button
                        type="button"
                        title={item.name}
                        className={`${base} justify-center p-2 ${isActiveSub ? activeClass : ""}`}
                        onClick={() => setOpen((o) => !o)}
                    >
                        <span className="relative">
                            <item.icon className="w-5 h-5" />
                            {badgeText && (
                                <span className={`absolute -top-2 -right-2 min-w-[1.1rem] h-[1.1rem] px-1 rounded text-[0.65rem] leading-[1.1rem] text-center border ${item.mentionType === "user" ? "border-red-500 bg-red-500/10 text-red-400" : item.mentionType === "group" ? "border-orange-400 bg-orange-400/10 text-orange-400" : "border-brand-primary/50 bg-brand-primary/10 text-brand-primary"}`}>
                                    {badgeText}
                                </span>
                            )}
                        </span>
                    </button>
                </div>
            );
        }

        return (
            <div className="mb-1">
                <NavLink
                    to={finalPath || "/dashboard"}
                    title={item.name}
                    className={`${base} justify-center p-2 ${isActiveSelf ? activeClass : ""}`}
                    onClick={onNavigate}
                >
                    <span className="relative">
                        <item.icon className="w-5 h-5" />
                        {badgeText && (
                            <span className={`absolute -top-2 -right-2 min-w-[1.1rem] h-[1.1rem] px-1 rounded text-[0.65rem] leading-[1.1rem] text-center border ${item.mentionType === "user" ? "border-red-500 bg-red-500/10 text-red-400" : item.mentionType === "group" ? "border-orange-400 bg-orange-400/10 text-orange-400" : "border-brand-primary/50 bg-brand-primary/10 text-brand-primary"}`}>
                                {badgeText}
                            </span>
                        )}
                    </span>
                </NavLink>
            </div>
        );
    }

    if (hasChildren) {
        return (
            <div className="mb-1">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className={`${base} justify-between px-4 py-2 text-sm ${isActiveSub ? activeClass : ""}`}
                >
                    <div className="flex items-center">
                        <item.icon className="w-5 h-5 mr-3" />
                        <span>{item.name}</span>
                    </div>
                    <ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                    {open && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="ml-4 pl-3 mt-1 border-l border-cca-border space-y-1"
                        >
                            {visibleChildren.map((child) => (
                                <NavItem
                                    key={child.name}
                                    item={child}
                                    collapsed={false}
                                    companyId={companyId}
                                    onNavigate={onNavigate}
                                />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <NavLink
            to={finalPath}
            onClick={onNavigate}
            className={`${base} px-4 py-2 text-sm ${isActiveSelf ? activeClass : ""} relative group`}
        >
            <div className="relative">
                <item.icon className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
                {collapsed && badgeText && (
                    <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded border ${item.mentionType === "user" ? "border-red-500 bg-red-500/20" : item.mentionType === "group" ? "border-orange-400 bg-orange-400/20" : "border-brand-primary/60 bg-brand-primary/20"}`} />
                )}
            </div>
            {!collapsed && <span>{item.name}</span>}
            {!collapsed && badgeText && (
                <span className={`ml-auto min-w-[1.2rem] h-[1.2rem] px-1.5 rounded text-[10px] font-bold leading-[1.2rem] text-center border transition-all duration-300 ${item.mentionType === "user" ? "border-red-500 bg-red-500/10 text-red-400" : item.mentionType === "group" ? "border-orange-400 bg-orange-400/10 text-orange-400" : "border-brand-primary/50 bg-brand-primary/10 text-brand-primary"}`}>
                    {badgeText}
                </span>
            )}
        </NavLink>
    );
}

/* -------------------------------------------------------------------------- */
/* USER MENU */
/* -------------------------------------------------------------------------- */

function UserMenu({ user, collapsed, onLock: _onLock, onLogout, hasCompanyThemeEngine, useCompanyTheme, toggleCompanyTheme }) {
    const [open, setOpen] = useState(false);

    const { theme, toggleTheme } = useTheme();

    const displayName = user?.name || user?.username || "Utilisateur";
    const initials = displayName
        .split(" ")
        .filter(Boolean)
        .map((s) => s[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return (
        <div className="relative px-2 py-3 border-t border-cca-border transition-colors duration-300">
            <button
                onClick={() => setOpen((o) => !o)}
                className={`w-full flex items-center rounded-lg px-3 py-2 hover:bg-cca-surface transition-all duration-300 active:scale-95 ${collapsed ? "justify-center" : ""
                    }`}
            >
                <div className="w-8 h-8 rounded-full bg-cca-base border border-cca-border flex items-center justify-center overflow-hidden transition-colors">
                    {user?.imageUrl ? (
                        <img
                            src={user.imageUrl}
                            alt={displayName}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span className="text-xs font-bold text-cca-textPrimary">{initials}</span>
                    )}
                </div>

                {!collapsed && (
                    <>
                        <div className="ml-3 text-left min-w-0">
                            <p className="text-sm font-semibold text-cca-textPrimary truncate">
                                {displayName}
                            </p>
                            <p className="text-xs text-cca-textSecondary">Compte</p>
                        </div>
                        <ChevronDown className="ml-auto" size={16} />
                    </>
                )}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className={`absolute bg-cca-surface border border-cca-border rounded-md shadow-xl z-50 transition-colors duration-300 ${collapsed ? "left-20 bottom-2 w-52" : "left-3 right-3 bottom-20"
                            }`}
                    >
                        <Link
                            to="/dashboard/me"
                            className="flex items-center px-4 py-2 hover:bg-brand-primary/10 text-cca-textPrimary text-sm transition-colors duration-200"
                        >
                            <User size={14} className="mr-2" /> Profil
                        </Link>
                        <button
                            onClick={onLogout}
                            className="flex items-center w-full px-4 py-2 hover:bg-red-500/10 text-red-500 text-sm transition-colors duration-200"
                        >
                            <LogOut size={14} className="mr-2" /> Déconnexion
                        </button>

                        <div className="border-t border-cca-border my-1" />

                        <div className="px-4 py-4 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/50 mb-1">
                                Design System
                            </p>
                            <div className="flex p-1.5 bg-cca-base/40 border border-cca-border/50 rounded-2xl backdrop-blur-md">
                                <button
                                    onClick={() => theme !== 'light' && toggleTheme()}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${theme === 'light'
                                        ? 'bg-white text-indigo-600 shadow-[0_0_20px_rgba(99,102,241,0.3)] scale-[1.02]'
                                        : 'text-cca-textSecondary hover:text-cca-textPrimary hover:bg-white/5'
                                        }`}
                                >
                                    <Sun size={14} className={theme === 'light' ? 'animate-pulse' : ''} />
                                    Clair
                                </button>
                                <button
                                    onClick={() => theme !== 'dark' && toggleTheme()}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${theme === 'dark'
                                        ? 'bg-brand-primary text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] scale-[1.02]'
                                        : 'text-cca-textSecondary hover:text-cca-textPrimary hover:bg-white/5'
                                        }`}
                                >
                                    <Moon size={14} className={theme === 'dark' ? 'animate-pulse' : ''} />
                                    Sombre
                                </button>
                            </div>

                            {hasCompanyThemeEngine && (
                                <>
                                    <div className="border-t border-cca-border/50 my-3" />
                                    <button
                                        onClick={toggleCompanyTheme}
                                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${useCompanyTheme
                                            ? 'bg-brand-primary/20 border-brand-primary/50 text-brand-primary shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                            : 'bg-cca-base/40 border-cca-border/50 text-cca-textSecondary hover:text-cca-textPrimary hover:bg-white/5'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <Layout size={14} />
                                            Thème Entreprise
                                        </span>
                                        <div className={`w-6 h-3 rounded-full transition-colors relative ${useCompanyTheme ? 'bg-brand-primary' : 'bg-cca-border'}`}>
                                            <div className={`absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-white transition-transform ${useCompanyTheme ? 'translate-x-3' : 'translate-x-0'}`} />
                                        </div>
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* SIDEBAR ROOT */
/* -------------------------------------------------------------------------- */

export default function DashboardSidebar({ isOpen = false, setIsOpen = () => { } }) {
    const { user, logout, lockSession } = useAuth();
    const { activeCompany, activeCompanyId, companies, loading: companyLoading, isAuthLoading, useCompanyTheme, toggleCompanyTheme } = useCompany();
    const permissions = usePermissions();

    const isLogoLoading = Boolean(
        isAuthLoading || companyLoading || permissions.isLoading || !permissions.isReady
    );

    const companyId = useMemo(() => {
        if (activeCompanyId === null || activeCompanyId === undefined) return null;
        const n = Number(activeCompanyId);
        return Number.isFinite(n) && n > 0 ? n : null;
    }, [activeCompanyId]);

    const [collapsed, setCollapsed] = useState(false);
    const [customPagesNavGroups, setCustomPagesNavGroups] = useState([]);

    const { isScopeMuted } = useAudioNotification();

    const totalUnreadQuery = useQuery({
        queryKey: ["chat", "total-unread-counts"],
        queryFn: () => getTotalUnreadCounts(),
        enabled: Boolean(user && companies.length > 0),
        refetchInterval: 30_000,
        staleTime: 15_000,
    });

    const { unreadCount, unreadMentionType } = useMemo(() => {
        const data = totalUnreadQuery.data || {};
        let total = 0;
        let mentionType = null;

        for (const companyData of Object.values(data)) {
            if (!companyData?.channels) continue;
            for (const [channelId, ch] of Object.entries(companyData.channels)) {
                if (isScopeMuted(channelId)) continue;
                total += ch.unread || 0;
                if (ch.mentionType === "user") {
                    mentionType = "user";
                } else if (ch.mentionType === "group" && mentionType !== "user") {
                    mentionType = "group";
                }
            }
        }

        return { unreadCount: total, unreadMentionType: mentionType };
    }, [totalUnreadQuery.data, isScopeMuted]);

    const unreadBadge = unreadCount > 99 ? "99+" : String(unreadCount);

    const v2ByGuild = useChannelStore(s => s.byGuild);
    const v2ReadState = useChannelStore(s => s.readStateByChannel);
    const markAllV2Read = useChannelStore(s => s.markAllRead);
    const subscribedPostsByGuild = useForumPostSubStore(s => s.byGuild);

    const v2UnreadCount = useMemo(() => {
        const subscribedPostIds = new Set(
            Object.values(subscribedPostsByGuild).flatMap(posts => posts.map(p => String(p.id)))
        );
        const forumChannelIds = new Set();
        for (const channels of Object.values(v2ByGuild)) {
            for (const ch of channels) {
                if (ch.type === 15) forumChannelIds.add(String(ch.id));
            }
        }
        let count = 0;
        for (const channels of Object.values(v2ByGuild)) {
            for (const ch of channels) {
                if (ch.type === 4) continue;
                if (ch.parentId && forumChannelIds.has(String(ch.parentId)) && !subscribedPostIds.has(String(ch.id))) continue;
                if (!ch.lastMessageId) continue;
                const readId = v2ReadState[String(ch.id)];
                if (!readId) { count++; continue; }
                try { if (BigInt(String(ch.lastMessageId)) > BigInt(readId)) count++; } catch { /* skip */ }
            }
        }
        return count;
    }, [v2ByGuild, v2ReadState, subscribedPostsByGuild]);

    const v2UnreadBadge = v2UnreadCount > 99 ? '99+' : v2UnreadCount > 0 ? String(v2UnreadCount) : null;

    const closeMobile = () => setIsOpen(false);

    const [v2CtxMenu, setV2CtxMenu] = React.useState(null);

    const handleV2ContextMenu = useCallback((e) => {
        e.preventDefault();
        setV2CtxMenu({ x: e.clientX, y: e.clientY });
    }, []);

    const closeV2Ctx = useCallback(() => setV2CtxMenu(null), []);

    useEffect(() => {
        if (!v2CtxMenu) return;
        const handler = (e) => {
            if (e.key === 'Escape') closeV2Ctx();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [v2CtxMenu, closeV2Ctx]);

    useEffect(() => {
        let cancelled = false;

        async function loadCustomPagesNav() {
            if (!companyId || !activeCompany || !permissions.isReady) {
                if (!cancelled) setCustomPagesNavGroups([]);
                return;
            }

            const companyModules = permissions.companyModules || [];
            if (!companyModules.includes("custom-pages")) {
                if (!cancelled) setCustomPagesNavGroups([]);
                return;
            }

            try {
                const res = await getCustomPagesNav();
                const groups = res?.data || [];
                if (!cancelled) setCustomPagesNavGroups(Array.isArray(groups) ? groups : []);
            } catch {
                if (!cancelled) setCustomPagesNavGroups([]);
            }
        }

        loadCustomPagesNav();
        return () => {
            cancelled = true;
        };
    }, [companyId, activeCompany, permissions.isReady, permissions.companyModules]);

    const customPagesChildren = useMemo(() => {
        const out = [];

        for (const g of customPagesNavGroups || []) {
            const groupName = g?.group ?? null;
            const items = Array.isArray(g?.items) ? g.items : [];

            const mappedItems = items
                .filter((p) => p?.slug)
                .map((p) => ({
                    name: p.navTitle || p.title || p.slug,
                    icon: getCustomPageIcon(p.navIcon),
                    path: `/dashboard/pages/${p.slug}`,
                    module: "custom-pages",
                    permission: "CUSTOM_PAGES.VIEW",
                    activeMatch: { mode: "exact" },
                }));

            if (mappedItems.length === 0) continue;

            if (groupName) {
                out.push({
                    name: String(groupName),
                    icon: FileTextIcon,
                    module: "custom-pages",
                    children: mappedItems,
                });
            } else {
                out.push(...mappedItems);
            }
        }

        return out;
    }, [customPagesNavGroups]);

    const navigationGlobal = useMemo(() => {
        const items = [
            { name: "Vue d'ensemble", path: "/dashboard", icon: Home, activeMatch: { mode: "exact" } },
            { name: "Contacter CCA", path: "/dashboard/tickets", icon: BookOpen, activeMatch: { mode: "exact" } },
            { name: "Mon Calendrier", path: "/dashboard/mycalendar", icon: Calendar, activeMatch: { mode: "exact" } },
        ];

        if (companies.length > 0) {
            items.push({
                name: "Tchat",
                path: "/dashboard/chat",
                icon: MessageSquare,
                badge: unreadCount > 0 ? unreadBadge : null,
                mentionType: unreadCount > 0 ? unreadMentionType : null,
                activeMatch: { mode: "exact" },
            });
            items.push({
                name: "Tchat V2",
                path: "/dashboard/tchatv2",
                icon: MessageSquare,
                badge: v2UnreadBadge,
                activeMatch: { mode: "prefix" },
            });
        }

        items.push({
            name: "Mes avantages",
            path: "/dashboard/me/perks",
            icon: Star,
            activeMatch: { mode: "exact" },
        });

        items.push({
            name: "Catalogue",
            path: "/dashboard/perks-catalog",
            icon: Store,
            activeMatch: { mode: "exact" },
        });

        items.push({
            name: "Panel Admin",
            path: "/admin",
            icon: AdminPanelSettingsIcon,
            forceAdmin: true,
            activeMatch: { mode: "prefix" },
        });

        return items;
    }, [companies.length, unreadCount, unreadBadge, unreadMentionType, v2UnreadBadge]);

    const navigationCompany = [
        {
            name: "Automates",
            path: "/dashboard/automation",
            icon: Zap,
            activeMatch: { mode: "exact" },
            module: "automation",
            permission: "AUTOMATION.{companyId}.VIEW",
        },
        {
            name: "Services",
            icon: Timer,
            path: "/dashboard/services",
            module: "calendar",
            permission: "CALENDAR.VIEW_SELF",
            activeMatch: { mode: "exact" },
        },
        {
            name: "Comptabilité",
            icon: FileTextIcon,
            module: "comptabilite",
            children: [
                {
                    name: "Factures",
                    path: "/dashboard/company/bills",
                    icon: FileTextIcon,
                    module: "comptabilite",
                    permission: "COMPTABILITE.{companyId}.BILLS.VIEW_ALL",
                    activeMatch: { mode: "exact" },
                },
                {
                    name: "Transactions",
                    path: "/dashboard/company/journal",
                    icon: Briefcase,
                    module: "comptabilite",
                    permission: "COMPTABILITE.{companyId}.TRANSACTIONS.VIEW",
                    activeMatch: { mode: "exact" },
                },
                {
                    name: "Déclaration",
                    path: "/dashboard/company/declaration",
                    icon: FileTextIcon,
                    module: "comptabilite",
                    permission: "COMPTABILITE.{companyId}.DECLARATION.VIEW",
                    activeMatch: { mode: "exact" },
                },
                {
                    name: "Notes de frais",
                    path: "/dashboard/company/expense-reports",
                    icon: FileTextIcon,
                    module: "comptabilite",
                    permission: "COMPTABILITE.{companyId}.EXPENSE_REPORTS.MANAGE",
                    activeMatch: { mode: "exact" },
                },
            ],
        },
        {
            name: "Boxs",
            icon: Box,
            module: "boxs",
            children: [
                {
                    name: "Déclarations cartons",
                    path: "/dashboard/boxs/carton-sales",
                    icon: Box,
                    module: "boxs",
                    permission: "BOXS.CARTON_SALES.VIEW",
                    activeMatch: { mode: "exact" },
                },
            ],
        },
        {
            name: "Gestion",
            module: "comptabilite",
            icon: Briefcase,
            children: [
                {
                    name: "Clients",
                    path: "/dashboard/company/clients",
                    icon: Users,
                    module: "comptabilite",
                    permission: "CLIENTS.{companyId}.VIEW",
                    activeMatch: { mode: "prefix" },
                },
                {
                    name: "Employés",
                    path: "/dashboard/company/employees",
                    icon: Users,
                    module: "comptabilite",
                    permission: "EMPLOYEES.{companyId}.EMPLOYEES.VIEW",
                    activeMatch: { mode: "prefix" },
                },
                {
                    name: "Rangs",
                    path: "/dashboard/company/ranks",
                    icon: Users,
                    module: "comptabilite",
                    permission: "EMPLOYEES.{companyId}.RANKS.VIEW",
                    activeMatch: { mode: "prefix" },
                },
                {
                    name: "SACEM",
                    path: "/dashboard/company/sacem",
                    icon: NewspaperIcon,
                    module: "sacem",
                    permissions: ["SACEM.{companyId}.VIEW", "SACEM.{companyId}.VIEW_SELF"],
                    activeMatch: { mode: "exact" },
                },
                {
                    name: "Régie",
                    path: "/dashboard/company/regie",
                    icon: Tv,
                    module: "regie",
                    permissions: ["REGIE.{companyId}.VIEW"],
                    activeMatch: { mode: "exact" },
                },
                {
                    name: "Inventaire",
                    path: "/dashboard/company/inventory",
                    icon: Box,
                    module: "inventory",
                    permission: "INVENTORY.{companyId}.VIEW_ALL",
                    activeMatch: { mode: "exact" },
                },
                {
                    name: "Garage",
                    path: "/dashboard/company/garage",
                    icon: Car,
                    module: "garage",
                    permission: "GARAGE.{companyId}.VIEW",
                    activeMatch: { mode: "exact" },
                },
                {
                    name: "Produits",
                    icon: Package,
                    module: "products",
                    children: [
                        {
                            name: "Catalogue",
                            path: "/dashboard/company/products",
                            icon: Package,
                            module: "products",
                            permission: "PRODUCTS.{companyId}.MANAGE",
                            activeMatch: { mode: "productsCatalog" },
                        },
                        {
                            name: "Déclarations",
                            path: "/dashboard/company/products/declarations",
                            icon: Package,
                            module: "products",
                            permissions: ["PRODUCTS.VIEW_SELF", "PRODUCTS.{companyId}.DECLARATIONS.VIEW", "PRODUCTS.{companyId}.MANAGE"],
                            activeMatch: { mode: "exact" },
                        },
                        {
                            name: "Récap semaine",
                            path: "/dashboard/company/products/declarations/weekly",
                            icon: Timer,
                            module: "products",
                            permissions: ["PRODUCTS.VIEW_SELF", "PRODUCTS.{companyId}.DECLARATIONS.VIEW", "PRODUCTS.{companyId}.MANAGE"],
                            activeMatch: { mode: "exact" },
                        },
                    ],
                },
                {
                    name: "Pawnshop",
                    icon: Package,
                    module: "pawnshop",
                    children: [
                        {
                            name: "Feuilles d'achat",
                            path: "/dashboard/company/pawnshop",
                            icon: Package,
                            module: "pawnshop",
                            permissions: ["PAWNSHOP.ACCESS"],
                            activeMatch: { mode: "exact" },
                        },
                        {
                            name: "Estimations",
                            path: "/dashboard/company/pawnshop/estimations",
                            icon: Timer,
                            module: "pawnshop",
                            permissions: ["PAWNSHOP.ACCESS"],
                            activeMatch: { mode: "exact" },
                        },
                        {
                            name: "Classement vendeurs",
                            path: "/dashboard/company/pawnshop/stats",
                            icon: BarChart2,
                            module: "pawnshop",
                            permissions: ["PAWNSHOP.ACCESS", "PAWNSHOP.PURCHASES.VIEW_ALL"],
                            activeMatch: { mode: "exact" },
                        },
                        {
                            name: "Produits",
                            path: "/dashboard/company/pawnshop/manage",
                            icon: Timer,
                            module: "pawnshop",
                            permissions: ["PAWNSHOP.ACCESS", "PAWNSHOP.PRODUCTS.VIEW"],
                            activeMatch: { mode: "exact" },
                        },
                        {
                            name: "Page publique",
                            path: "/dashboard/company/pawnshop/public-settings",
                            icon: Link2,
                            module: "pawnshop",
                            permissions: ["PAWNSHOP.PUBLIC_PAGE.MANAGE"],
                            activeMatch: { mode: "exact" },
                        },
                        {
                            name: "Documentation",
                            path: "/dashboard/company/pawnshop/public-docs",
                            icon: BookOpen,
                            module: "pawnshop",
                            permissions: ["PAWNSHOP.PUBLIC_PAGE.MANAGE"],
                            activeMatch: { mode: "exact" },
                        },
                    ],
                },
                {
                    name: "Annonces FiveM",
                    path: "/dashboard/company/announcement-generator",
                    icon: Megaphone,
                    activeMatch: { mode: "exact" },
                },
                {
                    name: "Partenaire",
                    path: "/dashboard/partners",
                    icon: Handshake,
                    module: "partenariat",
                    permissions: ["PARTENARIAT.ACCESS"],
                    activeMatch: { mode: "prefix" },
                },
            ],
        },
        {
            name: "Hébergement",
            icon: GlobeIcon,
            module: "hosting",
            children: [
                {
                    name: "Mes sites",
                    path: "/dashboard/hosting",
                    icon: GlobeIcon,
                    module: "hosting",
                    permissions: ["HOSTING.VIEW", "HOSTING.MANAGE"],
                    activeMatch: { mode: "prefix", excludePrefixes: ["/dashboard/hosting/docs"] },
                },
                {
                    name: "Documentation",
                    path: "/dashboard/hosting/docs",
                    icon: BookOpen,
                    module: "hosting",
                    permissions: ["HOSTING.VIEW", "HOSTING.MANAGE"],
                    activeMatch: { mode: "exact" },
                },
            ],
        },
        {
            name: "API",
            icon: Key,
            module: "api",
            children: [
                {
                    name: "Gestion des clés",
                    path: "/dashboard/api",
                    icon: Key,
                    module: "api",
                    permissions: ["API.VIEW", "API.MANAGE"],
                    activeMatch: { mode: "exact" },
                },
                {
                    name: "Documentation",
                    path: "/dashboard/api/docs",
                    icon: BookOpen,
                    module: "api",
                    permissions: ["API.VIEW", "API.MANAGE"],
                    activeMatch: { mode: "exact" },
                },
            ],
        },
        {
            name: "Pages",
            icon: FileTextIcon,
            module: "custom-pages",
            children: [
                {
                    name: "Gérer les pages",
                    path: "/dashboard/custom-pages",
                    icon: FileTextIcon,
                    module: "custom-pages",
                    permissions: ["CUSTOM_PAGES.MANAGE"],
                    activeMatch: { mode: "prefix" },
                },
                ...customPagesChildren,
            ],
        },
        {
            name: "Fidélité",
            icon: Star,
            children: [
                {
                    name: "Configuration",
                    path: "/dashboard/company/fidelity/setup",
                    icon: Star,
                    module: "comptabilite",
                    permission: "CLIENTS.{companyId}.FIDELITY.MANAGE",
                    activeMatch: { mode: "exact" },
                },
                {
                    name: "Gestion carte client",
                    path: "/dashboard/company/fidelity/clients",
                    icon: Star,
                    module: "comptabilite",
                    permission: "CLIENTS.{companyId}.FIDELITY.VIEW",
                    activeMatch: { mode: "exact" },
                },
            ],
        },
        {
            name: "Contrats",
            icon: NewspaperIcon,
            module: "contracts",
            children: [
                {
                    name: "Contrats employés",
                    path: "/dashboard/company/contracts",
                    icon: NewspaperIcon,
                    module: "contracts",
                    permission: "CONTRACTS.COMPANY_ASSIGNMENTS.VIEW.{companyId}",
                    activeMatch: { mode: "exact" },
                },
                {
                    name: "Templates",
                    path: "/dashboard/company/contracts/templates",
                    icon: NewspaperIcon,
                    module: "contracts",
                    permission: "CONTRACTS.TEMPLATE.LIST.{companyId}",
                    activeMatch: { mode: "prefix" },
                },
                {
                    name: "Assigner un contrat",
                    path: "/dashboard/company/contracts/assign",
                    icon: NewspaperIcon,
                    module: "contracts",
                    permission: "CONTRACTS.ASSIGN.{companyId}",
                    activeMatch: { mode: "exact" },
                },
            ],
        },
        {
            name: "Discord",
            icon: Bot,
            path: "/dashboard/company/discord",
            module: "discord",
            permission: "DISCORD.VIEW",
            activeMatch: { mode: "prefix" },
        },
        {
            name: "Paramètres",
            icon: Settings,
            path: "/dashboard/company/settings",
            module: "comptabilite",
            permission: "COMPTABILITE.{companyId}.SETTINGS.EDIT",
            activeMatch: { mode: "exact" },
        },
        {
            name: "Personnalisation",
            icon: Layout,
            path: "/dashboard/company/customization",
            module: "customization",
            permission: "COMPTABILITE.{companyId}.SETTINGS.EDIT",
            activeMatch: { mode: "exact" },
        },
    ];

    return (
        <>
            {/* -------------------- MOBILE: Off-canvas -------------------- */}
            <aside
                className={[
                    "md:hidden fixed top-0 left-0 h-screen supports-[height:100dvh]:h-[100dvh] w-80 max-w-[85vw]",
                    "bg-cca-base border-r border-cca-border",
                    // ✅ IMPORTANT: au-dessus de la MobileNavBar (z-50)
                    "z-[60]",
                    "transform transition-transform duration-300 ease-out",
                    isOpen ? "translate-x-0" : "-translate-x-full",
                    "flex flex-col shadow-2xl",
                ].join(" ")}
                aria-hidden={!isOpen}
            >
                <div className="flex items-center justify-between h-16 px-3 border-b border-cca-border bg-cca-surface transition-colors duration-300">
                    <Link to="/" className="flex items-center" onClick={closeMobile}>
                        <Logo
                            variant={isLogoLoading ? "loading" : "open"}
                            className="h-8 w-auto"
                        />
                    </Link>

                    <button
                        type="button"
                        onClick={closeMobile}
                        className="px-3 py-1.5 rounded-md border border-cca-border text-cca-textSecondary hover:text-cca-textPrimary transition-all active:scale-95 text-sm"
                    >
                        Fermer
                    </button>
                </div>

                {companies?.length > 1 && (
                    <div className="px-4 py-4 border-b border-cca-border">
                        <CompanySelector />
                    </div>
                )}

                {/* ✅ IMPORTANT: padding-bottom pour ne jamais passer sous la MobileNavBar */}
                <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
                    {navigationGlobal.map((item) => {
                        if (item.name === 'Tchat V2') {
                            return (
                                <div key={item.name} onContextMenu={handleV2ContextMenu} style={{ position: 'relative' }}>
                                    <NavItem item={item} collapsed={false} companyId={companyId || 0} onNavigate={closeMobile} />
                                </div>
                            );
                        }
                        return (
                            <NavItem
                                key={item.name}
                                item={item}
                                collapsed={false}
                                companyId={companyId || 0}
                                onNavigate={closeMobile}
                            />
                        );
                    })}

                    {activeCompany && companyId && (
                        <>
                            <p className="px-4 pt-4 pb-2 text-xs text-cca-textSecondary uppercase font-heading tracking-widest">{activeCompany.name}</p>

                            {!permissions.isReady && (
                                <div className="px-4 py-2 text-xs text-cca-textSecondary animate-pulse">Chargement des accès...</div>
                            )}

                            {navigationCompany.map((item) => (
                                <NavItem
                                    key={item.name}
                                    item={item}
                                    collapsed={false}
                                    companyId={companyId}
                                    onNavigate={closeMobile}
                                />
                            ))}
                        </>
                    )}
                </nav>

                {/* Pas de UserMenu en mobile */}
            </aside>

            {/* -------------------- DESKTOP -------------------- */}
            <aside
                className={`hidden md:flex flex-col bg-cca-base border-r border-cca-border transition-all duration-300 shadow-sm ${collapsed ? "w-[72px]" : "w-64"
                    }`}
            >
                <div className="flex items-center justify-between h-20 px-3 border-b border-cca-border bg-cca-surface/30 transition-colors duration-300">
                    <Link to="/" className="flex items-center">
                        <Logo
                            variant={isLogoLoading ? "loading" : collapsed ? "closed" : "open"}
                            className="h-8 w-auto"
                        />
                    </Link>

                    <div className="flex gap-2">
                        {!collapsed && <NotificationBell />}
                        <button
                            onClick={() => setCollapsed((c) => !c)}
                            className="p-1.5 rounded-full border border-cca-border text-cca-textSecondary hover:text-brand-primary hover:border-brand-primary transition-all duration-300 active:scale-90"
                        >
                            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </button>
                    </div>
                </div>

                {!collapsed && companies?.length > 1 && (
                    <div className="px-4 py-4 border-b border-cca-border">
                        <CompanySelector />
                    </div>
                )}

                <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
                    {navigationGlobal.map((item) => {
                        if (item.name === 'Tchat V2') {
                            return (
                                <div key={item.name} onContextMenu={handleV2ContextMenu} style={{ position: 'relative' }}>
                                    <NavItem item={item} collapsed={collapsed} companyId={companyId || 0} />
                                </div>
                            );
                        }
                        return (
                            <NavItem key={item.name} item={item} collapsed={collapsed} companyId={companyId || 0} />
                        );
                    })}

                    {activeCompany && companyId && (
                        <>
                            {!collapsed && (
                                <p className="px-4 pt-4 pb-2 text-xs text-cca-textSecondary uppercase font-heading tracking-widest">{activeCompany.name}</p>
                            )}

                            {!permissions.isReady && (
                                <div className="px-4 py-2 text-xs text-cca-textSecondary animate-pulse">Chargement des accès...</div>
                            )}

                            {navigationCompany.map((item) => (
                                <NavItem key={item.name} item={item} collapsed={collapsed} companyId={companyId} />
                            ))}
                        </>
                    )}
                </nav>

                <UserMenu
                    user={user}
                    collapsed={collapsed}
                    onLock={lockSession}
                    onLogout={logout}
                    hasCompanyThemeEngine={!!activeCompanyId && permissions.companyModules?.includes("customization")}
                    useCompanyTheme={useCompanyTheme}
                    toggleCompanyTheme={toggleCompanyTheme}
                />
            </aside>

            {v2CtxMenu && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                        onClick={closeV2Ctx}
                        onContextMenu={(e) => { e.preventDefault(); closeV2Ctx(); }}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            top: v2CtxMenu.y,
                            left: v2CtxMenu.x,
                            zIndex: 9999,
                        }}
                        className="bg-cca-surface border border-cca-border rounded-md shadow-xl py-1 min-w-[180px]"
                    >
                        <button
                            className="flex items-center w-full px-4 py-2 text-sm text-cca-textPrimary hover:bg-brand-primary/10 transition-colors"
                            onClick={() => { markAllV2Read(); closeV2Ctx(); }}
                        >
                            Tout marquer comme lu
                        </button>
                    </div>
                </>
            )}
        </>
    );
}