import { create } from 'zustand';

export const useSidebarActionsStore = create(set => ({
    catOpen:    false,
    chanParent: null,   // null=fermé | {}=top-level | {parentId,parentName}=dans catégorie
    rolesOpen:  false,

    openCat:    ()  => set({ catOpen: true }),
    openChan:   (p) => set({ chanParent: p ?? {} }),
    openRoles:  ()  => set({ rolesOpen: true }),
    closeCat:   ()  => set({ catOpen: false }),
    closeChan:  ()  => set({ chanParent: null }),
    closeRoles: ()  => set({ rolesOpen: false }),
}));
