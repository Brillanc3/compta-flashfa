// src/chat/components/ChatSidebar.jsx

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Hash, ChevronDown, ChevronRight, GripVertical, Plus, Users, MessageSquare } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useChatStore } from "../store/useChatStore";
import { useDmStore } from "../store/useDmStore";
import { useChatUIStore } from "../store/useChatUIStore";
import * as chatApi from "@/services/chatService";
import OpenDmModal from "./OpenDmModal";
import { createPortal } from "react-dom";

/* ========================================================================== */
/* Helpers                                                                    */
/* ========================================================================== */

function arrayMove(list, fromIndex, toIndex) {
    const next = [...list];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
}

function getCategoryKey(categoryId) {
    return categoryId === null || categoryId === undefined
        ? "uncategorized"
        : String(categoryId);
}

function parseChannelsDroppableId(droppableId) {
    // droppableId: "channels:uncategorized" | "channels:<categoryId>"
    if (!droppableId || typeof droppableId !== "string") return "uncategorized";
    if (!droppableId.startsWith("channels:")) return "uncategorized";
    return droppableId.slice("channels:".length) || "uncategorized";
}


/* ========================================================================== */
/* Component                                                                  */
/* ========================================================================== */

export default function ChatSidebar({
    className = "",
    headerRight = null,
    onSelectChannel = null,
}) {
    const categories = useChatStore((s) => s.categories);
    const channels = useChatStore((s) => s.channels);
    const activeChannelId = useChatStore((s) => s.activeChannelId);
    const selectChannel = useChatStore((s) => s.selectChannel);
    const loadInitial = useChatStore((s) => s.loadInitial);
    const hasUnread = useChatStore((s) => s.hasUnread);
    const isLoadingChannels = useChatStore((s) => s.isLoadingChannels);

    const openContextMenu = useChatUIStore((s) => s.openContextMenu);
    const openCategoryModal = useChatUIStore((s) => s.openCategoryModal);

    const dmConversations = useDmStore((s) => s.conversations);
    const activeConversationId = useDmStore((s) => s.activeConversationId);
    const setActiveConversation = useDmStore((s) => s.setActiveConversation);
    const loadDmConversations = useDmStore((s) => s.loadConversations);

    const activeTab = useChatUIStore((s) => s.activeTab);

    // Initial load of DMs
    useEffect(() => {
        loadDmConversations();
    }, [loadDmConversations]);

    const [collapsed, setCollapsed] = useState(() => new Set());
    const [, setDragType] = useState(null); // "CATEGORY" | "CHANNEL" | null
    const [dmModalOpen, setDmModalOpen] = useState(false);

    // Empêche les clicks parasites pendant le drag + juste après (release)
    const isDraggingRef = useRef(false);
    const suppressClicksUntilRef = useRef(0);

    const suppressClicksForMs = (ms) => {
        suppressClicksUntilRef.current = Date.now() + ms;
    };

    const openCategory = (rawId) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            next.delete(rawId);
            const asNum = Number(rawId);
            if (!Number.isNaN(asNum)) next.delete(asNum);
            return next;
        });
    };

    const toggleCategory = (categoryId) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(categoryId)) next.delete(categoryId);
            else next.add(categoryId);
            return next;
        });
    };

    const sortedCategories = useMemo(() => {
        return Array.isArray(categories)
            ? [...categories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            : [];
    }, [categories]);

    const channelsByCategory = useMemo(() => {
        const map = {};
        (Array.isArray(channels) ? channels : []).forEach((ch) => {
            const key = getCategoryKey(ch.categoryId);
            if (!map[key]) map[key] = [];
            map[key].push(ch);
        });

        Object.values(map).forEach((list) =>
            list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        );

        return map;
    }, [channels]);

    const uncategorizedChannels = channelsByCategory["uncategorized"] || [];

    /* ---------------------------------------------------------------------- */
    /* Drag handlers                                                          */
    /* ---------------------------------------------------------------------- */

    const onDragStart = (start) => {
        isDraggingRef.current = true;
        setDragType(start?.type || null);

        // Empêche toggle/select immédiatement au mousedown+drag
        suppressClicksForMs(250);
    };

    const onDragUpdate = (update) => {
        // Auto-open d’une catégorie repliée quand on survole sa zone channels
        if (update?.type !== "CHANNEL") return;
        const dest = update?.destination;
        if (!dest) return;

        const destKey = parseChannelsDroppableId(dest.droppableId);
        if (destKey && destKey !== "uncategorized") {
            openCategory(destKey);
        }
    };

    const onDragEnd = async (result) => {
        isDraggingRef.current = false;
        setDragType(null);

        // Critique : supprime le click “fantôme” au release
        suppressClicksForMs(250);

        const { destination, source, draggableId, type } = result;
        if (!destination) return;

        // No-op
        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return;
        }

        /* ----------------------------- CATEGORY ---------------------------- */
        if (type === "CATEGORY") {
            const current = sortedCategories;
            const reordered = arrayMove(current, source.index, destination.index).map(
                (cat, idx) => ({ ...cat, position: idx })
            );

            // Optimistic update
            useChatStore.setState((state) => ({
                categories: state.categories.map((c) => {
                    const updated = reordered.find((x) => x.id === c.id);
                    return updated ? { ...c, position: updated.position } : c;
                }),
            }));

            try {
                await Promise.all(
                    reordered.map((cat) =>
                        chatApi.updateCategory(cat.id, { position: cat.position })
                    )
                );
            } catch (e) {
                console.error("[ChatSidebar] updateCategory order failed", e);
                loadInitial();
            }
            return;
        }

        /* ------------------------------ CHANNEL ---------------------------- */
        if (type === "CHANNEL") {
            const all = Array.isArray(channels) ? channels : [];
            const activeChId = String(draggableId).startsWith("ch-")
                ? String(draggableId).slice(3)
                : String(draggableId);

            const activeCh = all.find((c) => String(c.id) === activeChId);
            if (!activeCh) return;

            const sourceKey = parseChannelsDroppableId(source.droppableId);
            const destKey = parseChannelsDroppableId(destination.droppableId);

            const sourceGroup = all
                .filter((c) => getCategoryKey(c.categoryId) === sourceKey)
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

            const destGroup = all
                .filter((c) => getCategoryKey(c.categoryId) === destKey)
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

            const updatesById = new Map();

            if (sourceKey === destKey) {
                // Reorder dans la même catégorie
                const reorderedGroup = arrayMove(
                    sourceGroup,
                    source.index,
                    destination.index
                ).map((ch, idx) => ({ ...ch, position: idx }));

                reorderedGroup.forEach((ch) => updatesById.set(ch.id, ch));

                const updatedChannels = all.map((ch) => {
                    const u = updatesById.get(ch.id);
                    return u ? { ...ch, position: u.position } : ch;
                });

                useChatStore.setState({ channels: updatedChannels });

                try {
                    await Promise.all(
                        reorderedGroup.map((ch) =>
                            chatApi.updateChannel(ch.id, { position: ch.position })
                        )
                    );
                } catch (e) {
                    console.error("[ChatSidebar] updateChannel order failed", e);
                    loadInitial();
                }

                return;
            }

            // Move vers une autre catégorie (ou uncategorized)
            const newSourceGroup = sourceGroup
                .filter((c) => String(c.id) !== activeChId)
                .map((ch, idx) => ({ ...ch, position: idx }));

            const activeMoved = {
                ...activeCh,
                categoryId: destKey === "uncategorized" ? null : destKey,
            };

            const destWithoutActive = destGroup.filter(
                (c) => String(c.id) !== activeChId
            );

            const newDestGroup = [
                ...destWithoutActive.slice(0, destination.index),
                activeMoved,
                ...destWithoutActive.slice(destination.index),
            ].map((ch, idx) => ({ ...ch, position: idx }));

            newSourceGroup.forEach((ch) => updatesById.set(ch.id, ch));
            newDestGroup.forEach((ch) => updatesById.set(ch.id, ch));

            const updatedChannels = all.map((ch) => {
                const u = updatesById.get(ch.id);
                if (!u) return ch;
                return {
                    ...ch,
                    position: u.position,
                    categoryId: u.categoryId ?? null,
                };
            });

            useChatStore.setState({ channels: updatedChannels });

            // UX: si on drop dans une catégorie, on l’ouvre
            if (destKey && destKey !== "uncategorized") {
                openCategory(destKey);
            }

            try {
                await Promise.all(
                    Array.from(updatesById.values()).map((ch) =>
                        chatApi.updateChannel(ch.id, {
                            position: ch.position,
                            categoryId: ch.categoryId ?? null,
                        })
                    )
                );
            } catch (e) {
                console.error("[ChatSidebar] updateChannel move failed", e);
                loadInitial();
            }

            return;
        }
    };

    /* ---------------------------------------------------------------------- */
    /* Context menu sidebar                                                   */
    /* ---------------------------------------------------------------------- */

    const handleSidebarContextMenu = (e) => {
        // Ne pas écraser le context menu déjà géré par les rows
        if (
            e.target.closest("[data-chat-channel-row]") ||
            e.target.closest("[data-chat-category-row]")
        ) {
            return;
        }
        e.preventDefault();
        openContextMenu({
            x: e.clientX,
            y: e.clientY,
            targetType: "sidebar",
        });
    };

    const handleSelectChannel = (channelId) => {
        if (isLoadingChannels) return;
        selectChannel(channelId);
        if (typeof onSelectChannel === "function") onSelectChannel(channelId);
    };

    const handleSelectDm = (convId) => {
        if (isLoadingChannels) return;
        setActiveConversation(convId);
        if (typeof onSelectChannel === "function") onSelectChannel(convId);
    };

    /* ---------------------------------------------------------------------- */
    /* Render                                                                 */
    /* ---------------------------------------------------------------------- */

    return (
        <aside
            className={`
                flex-1 md:w-64 min-w-0 h-full flex flex-col
                bg-cca-surface/40 border-r border-cca-border/50
                backdrop-blur-xl transition-all duration-300
                ${className}
            `}
            onContextMenu={handleSidebarContextMenu}
        >
            {/* HEADER */}
            <div
                className="
                    h-12 px-4 flex items-center justify-between gap-3
                    border-b border-cca-border/50 shadow-sm
                "
            >
                <span className="text-sm font-bold text-cca-textPrimary truncate font-heading">
                    {activeTab === "channels" ? "Canaux de l'entreprise" : "Messages Privés"}
                </span>

                {headerRight ? (
                    <div className="shrink-0">{headerRight}</div>
                ) : (
                    activeTab === "channels" && (
                        <button
                            onClick={() => openCategoryModal()}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                        >
                            <Plus className="w-4 h-4 text-cca-textSecondary" />
                        </button>
                    )
                )}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar py-3 px-2">
                {activeTab === "channels" ? (
                    <DragDropContext
                        onDragStart={onDragStart}
                        onDragUpdate={onDragUpdate}
                        onDragEnd={onDragEnd}
                    >
                        <Droppable droppableId="channels:uncategorized" type="CHANNEL">
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`
                                        mb-4 rounded-md transition-colors
                                        ${snapshot.isDraggingOver ? "bg-cca-base/40 border border-cca-border/40" : ""}
                                    `}
                                    style={{
                                        minHeight: uncategorizedChannels.length === 0 ? 30 : 10,
                                    }}
                                >
                                    <div className="px-2 mb-2 text-[11px] font-bold uppercase tracking-wider text-cca-textSecondary/60 flex items-center justify-between group">
                                        <span>Salons</span>
                                    </div>
                                    {uncategorizedChannels.map((channel, index) => (
                                        <Draggable
                                            key={`ch-${channel.id}`}
                                            draggableId={`ch-${channel.id}`}
                                            index={index}
                                        >
                                            {(draggableProvided, draggableSnapshot) => {
                                                const content = (
                                                    <div
                                                        ref={draggableProvided.innerRef}
                                                        {...draggableProvided.draggableProps}
                                                        {...draggableProvided.dragHandleProps}
                                                        style={draggableProvided.draggableProps.style}
                                                        className={`
                                                            group relative flex items-center gap-2 px-2 py-1.5 mb-0.5
                                                            rounded text-sm select-none transition-all
                                                            ${String(activeChannelId) === String(channel.id)
                                                                ? "bg-brand-primary/10 text-brand-primary"
                                                                : hasUnread(channel.id)
                                                                    ? "text-cca-textPrimary hover:bg-cca-base/40"
                                                                    : "text-cca-textSecondary hover:bg-cca-base/40 hover:text-cca-textPrimary"
                                                            }
                                                            ${draggableSnapshot.isDragging ? "bg-cca-surface border border-cca-border shadow-2xl z-[9999] w-[240px]" : "cursor-pointer"}
                                                            ${isLoadingChannels ? "opacity-40 cursor-not-allowed pointer-events-none grayscale-[0.5]" : ""}
                                                        `}
                                                        onClick={() => handleSelectChannel(channel.id)}
                                                        onContextMenu={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            openContextMenu({
                                                                x: e.clientX,
                                                                y: e.clientY,
                                                                targetType: "channel",
                                                                targetId: channel.id,
                                                            });
                                                        }}
                                                    >
                                                        {hasUnread(channel.id) && String(activeChannelId) !== String(channel.id) && (
                                                            <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-1 h-3 bg-white rounded-r-md shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                                                        )}
                                                        <Hash className={`w-5 h-5 ${String(activeChannelId) === String(channel.id) ? "text-brand-primary" : "text-cca-textSecondary/60 group-hover:text-cca-textSecondary"}`} />
                                                        <span className={`truncate flex-1 ${hasUnread(channel.id) ? "font-bold text-cca-textPrimary" : "font-medium"}`}>{channel.name}</span>
                                                    </div>
                                                );
                                                
                                                if (draggableSnapshot.isDragging) {
                                                    return createPortal(content, document.body);
                                                }
                                                return content;
                                            }}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>

                        <Droppable droppableId="categories" type="CATEGORY">
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                                    {sortedCategories.map((cat, index) => {
                                        const catKey = String(cat.id);
                                        const isCollapsed = collapsed.has(cat.id);
                                        const catChannels = channelsByCategory[catKey] || [];

                                        return (
                                            <Draggable key={`cat-${cat.id}`} draggableId={`cat-${cat.id}`} index={index}>
                                                {(catProvided) => (
                                                    <div ref={catProvided.innerRef} {...catProvided.draggableProps}>
                                                        <div
                                                            {...catProvided.dragHandleProps}
                                                            className="flex items-center justify-between px-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-cca-textSecondary/60 cursor-pointer group hover:text-cca-textSecondary transition-colors"
                                                            onClick={() => toggleCategory(cat.id)}
                                                            onContextMenu={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                openContextMenu({
                                                                    x: e.clientX,
                                                                    y: e.clientY,
                                                                    targetType: "category",
                                                                    targetId: cat.id,
                                                                });
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-0.5">
                                                                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                                <span>{cat.name}</span>
                                                            </div>
                                                        </div>

                                                        {!isCollapsed && (
                                                            <Droppable droppableId={`channels:${catKey}`} type="CHANNEL">
                                                                {(chProvided, chSnapshot) => (
                                                                    <div 
                                                                        ref={chProvided.innerRef} 
                                                                        {...chProvided.droppableProps} 
                                                                        className={`space-y-0.5 ${chSnapshot.isDraggingOver ? "bg-cca-base/40 rounded-md" : ""}`}
                                                                        style={{ minHeight: catChannels.length === 0 ? 30 : 5 }}
                                                                    >
                                                                        {catChannels.map((channel, chIndex) => (
                                                                            <Draggable key={`ch-${channel.id}`} draggableId={`ch-${channel.id}`} index={chIndex}>
                                                                                {(draggableProvided, draggableSnapshot) => {
                                                                                    const content = (
                                                                                        <div
                                                                                            ref={draggableProvided.innerRef}
                                                                                            {...draggableProvided.draggableProps}
                                                                                            {...draggableProvided.dragHandleProps}
                                                                                            style={draggableProvided.draggableProps.style}
                                                                                            className={`
                                                                                                group relative flex items-center gap-2 px-2 py-1.5
                                                                                                rounded text-sm select-none transition-all
                                                                                                ${String(activeChannelId) === String(channel.id)
                                                                                                    ? "bg-brand-primary/10 text-brand-primary"
                                                                                                    : hasUnread(channel.id)
                                                                                                        ? "text-cca-textPrimary hover:bg-cca-base/40"
                                                                                                        : "text-cca-textSecondary hover:bg-cca-base/40 hover:text-cca-textPrimary"
                                                                                                }
                                                                                                ${draggableSnapshot.isDragging ? "bg-cca-surface border border-cca-border shadow-2xl z-[9999] w-[240px]" : "cursor-pointer"}
                                                                                                ${isLoadingChannels ? "opacity-40 cursor-not-allowed pointer-events-none grayscale-[0.5]" : ""}
                                                                                            `}
                                                                                            onClick={() => handleSelectChannel(channel.id)}
                                                                                            onContextMenu={(e) => {
                                                                                                e.preventDefault();
                                                                                                e.stopPropagation();
                                                                                                openContextMenu({
                                                                                                    x: e.clientX,
                                                                                                    y: e.clientY,
                                                                                                    targetType: "channel",
                                                                                                    targetId: channel.id,
                                                                                                });
                                                                                            }}
                                                                                        >
                                                                                            {hasUnread(channel.id) && String(activeChannelId) !== String(channel.id) && (
                                                                                                <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-1 h-3 bg-white rounded-r-md shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                                                                                            )}
                                                                                            <Hash className={`w-5 h-5 ${String(activeChannelId) === String(channel.id) ? "text-brand-primary" : "text-cca-textSecondary/60 group-hover:text-cca-textSecondary"}`} />
                                                                                            <span className={`truncate flex-1 ${hasUnread(channel.id) ? "font-bold text-cca-textPrimary" : "font-medium"}`}>{channel.name}</span>
                                                                                        </div>
                                                                                    );

                                                                                    if (draggableSnapshot.isDragging) {
                                                                                        return createPortal(content, document.body);
                                                                                    }
                                                                                    return content;
                                                                                }}
                                                                            </Draggable>
                                                                        ))}
                                                                        {chProvided.placeholder}
                                                                    </div>
                                                                )}
                                                            </Droppable>
                                                        )}
                                                    </div>
                                                )}
                                            </Draggable>
                                        );
                                    })}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                ) : (
                    <div className="space-y-1">
                        <div
                            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-cca-base/40 cursor-pointer text-cca-textSecondary hover:text-cca-textPrimary transition-all mb-4"
                            onClick={() => setDmModalOpen(true)}
                        >
                            <div className="w-8 h-8 rounded-full bg-cca-base flex items-center justify-center border border-cca-border">
                                <Plus className="w-5 h-5 text-cca-textSecondary" />
                            </div>
                            <span className="font-medium text-sm">Démarrer une conversation</span>
                        </div>

                        <div className="px-2 mb-2 text-[11px] font-bold uppercase tracking-wider text-cca-textSecondary/60">
                            Messages Directs
                        </div>

                        {dmConversations.map((conv) => (
                            <div
                                key={conv.id}
                                className={`
                                    group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all
                                    ${activeConversationId === conv.id ? "bg-brand-primary/10 text-brand-primary" : "text-cca-textSecondary hover:bg-cca-base/40 hover:text-cca-textPrimary"}
                                    ${isLoadingChannels ? "opacity-40 cursor-not-allowed pointer-events-none grayscale-[0.5]" : ""}
                                `}
                                onClick={() => handleSelectDm(conv.id)}
                            >
                                <div className="relative shrink-0">
                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-cca-base border border-cca-border">
                                        {conv.otherUserAvatar ? (
                                            <img src={conv.otherUserAvatar} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-cca-surface text-xs font-bold text-cca-textSecondary uppercase">
                                                {conv.otherUserName?.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    {/* Online indicator could be added here if backend supports it */}
                                </div>
                                <span className="truncate text-sm font-medium flex-1">
                                    {conv.otherUserName}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {dmModalOpen && <OpenDmModal onClose={() => setDmModalOpen(false)} />}
        </aside>
    );
}
