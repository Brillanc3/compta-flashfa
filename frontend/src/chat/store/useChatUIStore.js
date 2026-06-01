// src/chat/store/useChatUIStore.js
import { create } from "zustand";

export const useChatUIStore = create((set) => ({
    /* -------------------------------------------------------
       CONTEXT MENU
    ------------------------------------------------------- */
    contextMenu: null,

    openContextMenu: (payload) => set({ contextMenu: payload }),
    closeContextMenu: () => set({ contextMenu: null }),

    /* -------------------------------------------------------
       CHANNEL MODAL (create + edit)
    ------------------------------------------------------- */
    channelModalOpen: false,
    channelModalMode: "create", // "create" | "edit"
    channelBeingEdited: null,
    preselectedCategoryId: null,

    openChannelModal: (mode = "create", channel = null, preselectedCategoryId = null) =>
        set({
            channelModalOpen: true,
            channelModalMode: mode,
            channelBeingEdited: channel,
            preselectedCategoryId,
        }),

    closeChannelModal: () =>
        set({
            channelModalOpen: false,
            channelModalMode: "create",
            channelBeingEdited: null,
            preselectedCategoryId: null,
        }),

    /* -------------------------------------------------------
       CATEGORY MODAL
    ------------------------------------------------------- */
    categoryModalOpen: false,
    openCategoryModal: () => set({ categoryModalOpen: true }),
    closeCategoryModal: () => set({ categoryModalOpen: false }),

    /* -------------------------------------------------------
       PERMISSIONS DRAWER
    ------------------------------------------------------- */
    permissionsDrawerOpen: false,
    permissionsCategory: null, // { id, name } — set when opening in category-only mode

    openPermissionsDrawer: () => set({ permissionsDrawerOpen: true, permissionsCategory: null }),
    openCategoryPermissionsDrawer: (category) => set({ permissionsDrawerOpen: true, permissionsCategory: category }),
    closePermissionsDrawer: () => set({ permissionsDrawerOpen: false, permissionsCategory: null }),

    /* -------------------------------------------------------
       NAVIGATION TAB
    --------------------------------------- */
    activeTab: "channels", // "channels" | "dms"
    setActiveTab: (tab) => set({ activeTab: tab }),
}));
