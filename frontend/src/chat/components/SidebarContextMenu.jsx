// src/chat/components/SidebarContextMenu.jsx

import React from "react";
import { useChatUIStore } from "../store/useChatUIStore";
import { useChatStore } from "../store/useChatStore";
import { useAudioNotification } from "@/hooks/useAudioNotification";
import {
    Plus,
    FolderPlus,
    Edit2,
    Shield,
    Trash2,
    Hash,
    CheckCircle,
    Flag,
    BellOff,
    Bell,
} from "lucide-react";
import toast from "react-hot-toast";

export default function SidebarContextMenu() {
    const {
        contextMenu,
        closeContextMenu,
        openChannelModal,
        openCategoryModal,
        openPermissionsDrawer,
        openCategoryPermissionsDrawer,
    } = useChatUIStore();

    const deleteChannel = useChatStore((s) => s.deleteChannel);
    const deleteCategory = useChatStore((s) => s.deleteCategory);
    const selectChannel = useChatStore((s) => s.selectChannel);
    const markAsRead = useChatStore((s) => s.markAsRead);
    const channels = useChatStore((s) => s.channels);
    const categories = useChatStore((s) => s.categories);

    const { muteScope, unmuteScope, isScopeMuted } = useAudioNotification();

    if (!contextMenu) return null;

    const { x, y, targetType, targetId } = contextMenu;

    // Récup du salon si clic droit sur un salon
    const channel =
        targetType === "channel"
            ? channels.find((c) => String(c.id) === String(targetId)) || null
            : null;

    /* ------------------------------------------------------------------ */
    /* ACTIONS                                                            */
    /* ------------------------------------------------------------------ */

    // Créer un salon (depuis la sidebar ou une catégorie)
    const handleCreateChannel = () => {
        closeContextMenu();
        const preselectedCategoryId = targetType === "category" ? targetId : null;
        openChannelModal("create", null, preselectedCategoryId);
    };

    // Créer une catégorie
    const handleCreateCategory = () => {
        closeContextMenu();
        openCategoryModal();
    };

    // Modifier un salon (clic droit sur channel)
    const handleEditChannel = () => {
        if (!channel) return;
        closeContextMenu();
        openChannelModal("edit", channel);
    };

    // Ouvrir les permissions avancées pour un salon
    const handleEditPermissions = async () => {
        if (!channel) return;
        closeContextMenu();
        await selectChannel(channel.id);
        openPermissionsDrawer();
    };

    // Mettre en lu le salon
    const handleMarkAsRead = async () => {
        if (!channel) return;
        closeContextMenu();
        await markAsRead(channel.id);
    };

    // Supprimer un salon
    const handleDeleteChannel = async () => {
        if (!channel) return;
        closeContextMenu();
        try {
            await deleteChannel(channel.id);
        } catch (e) {
            console.error("[SidebarContextMenu] deleteChannel error:", e);
        }
    };

    // Permissions d'une catégorie
    const handleEditCategoryPermissions = () => {
        if (!targetId) return;
        closeContextMenu();
        const category = Array.isArray(categories)
            ? categories.find((c) => String(c.id) === String(targetId)) || null
            : null;
        openCategoryPermissionsDrawer(category || { id: targetId, name: `Catégorie ${targetId}` });
    };

    // Supprimer une catégorie
    const handleDeleteCategory = async () => {
        if (!targetId) return;
        closeContextMenu();
        try {
            await deleteCategory(targetId);
        } catch (e) {
            console.error("[SidebarContextMenu] deleteCategory error:", e);
        }
    };

    // Signaler un message
    const handleReportMessage = () => {
        closeContextMenu();
        toast.success("Message signalé (simulation)");
    };

    /* ------------------------------------------------------------------ */
    /* RENDER MENU                                                        */
    /* ------------------------------------------------------------------ */

    return (
        <div
            className="
                fixed z-50 w-64
                rounded-2xl border border-cca-border
                bg-cca-surface/95 backdrop-blur-2xl
                shadow-[0_20px_50px_rgba(0,0,0,0.5)]
                text-sm text-cca-textPrimary overflow-hidden
                animate-in fade-in zoom-in-95 duration-200
            "
            style={{ top: y, left: x }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Clic droit sur la sidebar ou une catégorie → création */}
            {(targetType === "sidebar" || targetType === "category") && (
                <div className="p-1.5 flex flex-col gap-1">
                    <button
                        onClick={handleCreateChannel}
                        className="
                            flex w-full items-center gap-3 px-3 py-2.5
                            rounded-xl hover:bg-cca-base transition-all active:scale-[0.98]
                        "
                    >
                        <div className="p-1 rounded-lg bg-brand-primary/10 border border-brand-primary/20">
                            <Plus className="w-4 h-4 text-brand-primary" />
                        </div>
                        <span className="font-semibold">Créer un salon</span>
                    </button>

                    <button
                        onClick={handleCreateCategory}
                        className="
                            flex w-full items-center gap-3 px-3 py-2.5
                            rounded-xl hover:bg-cca-base transition-all active:scale-[0.98]
                        "
                    >
                        <div className="p-1 rounded-lg bg-cca-base border border-cca-border">
                            <FolderPlus className="w-4 h-4 text-cca-textSecondary" />
                        </div>
                        <span className="font-semibold">Créer une catégorie</span>
                    </button>

                    {targetType === "category" && (
                        <>
                            <div className="my-1 border-t border-cca-border/50 mx-2" />
                            <button
                                onClick={handleEditCategoryPermissions}
                                className="
                                    flex w-full items-center gap-3 px-3 py-2.5
                                    rounded-xl hover:bg-cca-base transition-all active:scale-[0.98]
                                "
                            >
                                <div className="p-1 rounded-lg bg-cca-base border border-cca-border">
                                    <Shield className="w-4 h-4 text-cca-textSecondary" />
                                </div>
                                <span className="font-semibold text-cca-textPrimary">Permissions de la catégorie</span>
                            </button>
                            {(() => {
                                const catMuted = isScopeMuted(targetId);
                                return (
                                    <button
                                        onClick={() => {
                                            if (catMuted) unmuteScope(targetId);
                                            else muteScope(targetId);
                                            closeContextMenu();
                                        }}
                                        className="
                                            flex w-full items-center gap-3 px-3 py-2.5
                                            rounded-xl hover:bg-cca-base transition-all active:scale-[0.98]
                                        "
                                    >
                                        <div className="p-1 rounded-lg bg-cca-base border border-cca-border">
                                            {catMuted
                                                ? <Bell className="w-4 h-4 text-cca-textSecondary" />
                                                : <BellOff className="w-4 h-4 text-cca-textSecondary" />
                                            }
                                        </div>
                                        <span className="font-semibold text-cca-textPrimary">
                                            {catMuted ? "Rétablir les notifications" : "Couper les notifications"}
                                        </span>
                                    </button>
                                );
                            })()}
                            <button
                                onClick={handleDeleteCategory}
                                className="
                                    flex w-full items-center gap-3 px-3 py-2.5
                                    rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300
                                    transition-all active:scale-[0.98]
                                "
                            >
                                <div className="p-1 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <Trash2 className="w-4 h-4" />
                                </div>
                                <span className="font-semibold">Supprimer la catégorie</span>
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Clic droit sur un salon → actions salon */}
            {targetType === "channel" && channel && (
                <div className="p-1.5 flex flex-col gap-1">
                    <div className="px-4 py-3 border-b border-cca-border/50 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/60 mb-1">
                        <Hash className="w-3.5 h-3.5" />
                        <span className="truncate">{channel.name}</span>
                    </div>

                    <button
                        onClick={handleMarkAsRead}
                        className="
                            flex w-full items-center gap-3 px-3 py-2.5
                            rounded-xl hover:bg-cca-base transition-all active:scale-[0.98]
                        "
                    >
                        <div className="p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                        </div>
                        <span className="font-semibold text-cca-textPrimary">Marquer comme lu</span>
                    </button>

                    <button
                        onClick={handleEditChannel}
                        className="
                            flex w-full items-center gap-3 px-3 py-2.5
                            rounded-xl hover:bg-cca-base transition-all active:scale-[0.98]
                        "
                    >
                        <div className="p-1 rounded-lg bg-cca-base border border-cca-border">
                            <Edit2 className="w-4 h-4 text-cca-textSecondary" />
                        </div>
                        <span className="font-semibold text-cca-textPrimary">Modifier le salon</span>
                    </button>

                    <button
                        onClick={handleEditPermissions}
                        className="
                            flex w-full items-center gap-3 px-3 py-2.5
                            rounded-xl hover:bg-cca-base transition-all active:scale-[0.98]
                        "
                    >
                        <div className="p-1 rounded-lg bg-cca-base border border-cca-border">
                            <Shield className="w-4 h-4 text-cca-textSecondary" />
                        </div>
                        <span className="font-semibold text-cca-textPrimary">Permissions</span>
                    </button>

                    {(() => {
                        const scopeMuted = channel ? isScopeMuted(channel.id) : false;
                        return (
                            <button
                                onClick={() => {
                                    if (!channel) return;
                                    if (scopeMuted) unmuteScope(channel.id);
                                    else muteScope(channel.id);
                                    closeContextMenu();
                                }}
                                className="
                                    flex w-full items-center gap-3 px-3 py-2.5
                                    rounded-xl hover:bg-cca-base transition-all active:scale-[0.98]
                                "
                            >
                                <div className="p-1 rounded-lg bg-cca-base border border-cca-border">
                                    {scopeMuted
                                        ? <Bell className="w-4 h-4 text-cca-textSecondary" />
                                        : <BellOff className="w-4 h-4 text-cca-textSecondary" />
                                    }
                                </div>
                                <span className="font-semibold text-cca-textPrimary">
                                    {scopeMuted ? "Rétablir les notifications" : "Couper les notifications"}
                                </span>
                            </button>
                        );
                    })()}

                    <div className="my-1 border-t border-cca-border/50 mx-2" />

                    <button
                        onClick={handleDeleteChannel}
                        className="
                            flex w-full items-center gap-3 px-3 py-2.5
                            rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300
                            transition-all active:scale-[0.98]
                        "
                    >
                        <div className="p-1 rounded-lg bg-red-500/10 border border-red-500/20">
                            <Trash2 className="w-4 h-4" />
                        </div>
                        <span className="font-semibold">Supprimer le salon</span>
                    </button>
                </div>
            )}

            {/* Clic droit sur un message → actions message */}
            {targetType === "message" && (
                <div className="p-1.5 flex flex-col gap-1">
                    <button
                        onClick={handleReportMessage}
                        className="
                            flex w-full items-center gap-3 px-3 py-2.5
                            rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300
                            transition-all active:scale-[0.98]
                        "
                    >
                        <div className="p-1 rounded-lg bg-red-500/10 border border-red-500/20">
                            <Flag className="w-4 h-4" />
                        </div>
                        <span className="font-semibold">Signaler ce message</span>
                    </button>
                </div>
            )}
        </div>
    );
}
