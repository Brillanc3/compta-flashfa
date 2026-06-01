// /frontend/src/components/inventory/InventoryManagementModal.jsx

import React, { useEffect, useState } from "react";
import {
    getInventoryOwners,
    upsertInventoryOwner,
    deleteInventoryOwner
} from "@/services/inventoryOwnerService";
import toast from "react-hot-toast";
import Spinner from "@/components/ui/Spinner";
import ConfirmationModal from "@/components/ui/ConfirmationModal";

/**
 * Modal pour gérer les correspondances de noms d'emplacements d'inventaire.
 */
export default function InventoryManagementModal({ isOpen, onClose, onSaved }) {
    const [loading, setLoading] = useState(true);
    const [owners, setOwners] = useState([]);
    const [ownerInput, setOwnerInput] = useState("");
    const [nameInput, setNameInput] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchOwners();
        }
    }, [isOpen]);

    const fetchOwners = async () => {
        setLoading(true);
        try {
            const data = await getInventoryOwners();
            setOwners(data);
        } catch {
            toast.error("Erreur lors du chargement des inventaires.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!ownerInput || !nameInput) return;

        setSubmitting(true);
        try {
            await upsertInventoryOwner({
                owner: ownerInput.trim(),
                name: nameInput.trim()
            });
            toast.success("Emplacement enregistré !");
            setOwnerInput("");
            setNameInput("");
            setEditingId(null);
            fetchOwners();
            onSaved?.();
        } catch (err) {
            toast.error(err?.response?.data?.message || "Erreur lors de l'enregistrement.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (item) => {
        setOwnerInput(item.owner);
        setNameInput(item.name);
        setEditingId(item.id);
    };

    const handleDelete = (id) => {
        setPendingDeleteId(id);
        setConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        setConfirmOpen(false);
        try {
            await deleteInventoryOwner(pendingDeleteId);
            toast.success("Renommage supprimé.");
            fetchOwners();
            onSaved?.();
        } catch {
            toast.error("Erreur lors de la suppression.");
        } finally {
            setPendingDeleteId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <>
        <ConfirmationModal
            isOpen={confirmOpen}
            onClose={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
            onConfirm={handleConfirmDelete}
            title="Supprimer le renommage"
            message="Supprimer ce renommage ? Les mouvements perdront leur nom personnalisé (mais resteront historisés)."
        />

        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="
                relative w-full max-w-2xl max-h-[90vh] flex flex-col
                bg-cca-surface/80 border border-cca-border rounded-[2rem] overflow-hidden 
                shadow-2xl shadow-black/50 backdrop-blur-3xl
            ">
                {/* Header */}
                <div className="p-8 border-b border-cca-border/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-cca-textPrimary tracking-tight">
                            Gestion des <span className="text-brand-primary">Emplacements</span>
                        </h2>
                        <p className="text-[10px] font-bold text-cca-textSecondary/50 uppercase tracking-widest mt-1">
                            Donnez un nom clair aux codes d'inventaires
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="h-10 w-10 rounded-full bg-cca-base/50 flex items-center justify-center text-cca-textSecondary hover:bg-cca-base hover:text-cca-textPrimary transition-all"
                    >
                        ✕
                    </button>
                </div>

                {/* Form to Add/Edit */}
                <div className="p-8 bg-brand-primary/5 border-b border-cca-border/30">
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 ml-1">
                                Code Brut (owner)
                            </label>
                            <input 
                                value={ownerInput}
                                onChange={(e) => setOwnerInput(e.target.value)}
                                placeholder="ex: action-73-0-2"
                                required
                                disabled={editingId !== null}
                                className="
                                    w-full px-4 py-2.5 rounded-xl bg-cca-base/40 border border-cca-border
                                    text-sm text-cca-textPrimary placeholder:text-cca-textSecondary/30
                                    focus:border-brand-primary outline-none transition-all
                                "
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 ml-1">
                                Nom Clair
                            </label>
                            <input 
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                placeholder="ex: Coffre Principal"
                                required
                                className="
                                    w-full px-4 py-2.5 rounded-xl bg-cca-base/40 border border-cca-border
                                    text-sm text-cca-textPrimary placeholder:text-cca-textSecondary/30
                                    focus:border-brand-primary outline-none transition-all
                                "
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                            {editingId && (
                                <button 
                                    type="button"
                                    onClick={() => { setEditingId(null); setOwnerInput(""); setNameInput(""); }}
                                    className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-cca-textSecondary hover:text-cca-textPrimary"
                                >
                                    Annuler
                                </button>
                            )}
                            <button 
                                type="submit"
                                disabled={submitting}
                                className="
                                    px-8 py-2.5 rounded-xl bg-brand-primary text-white 
                                    text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-primary/20
                                    hover:scale-105 active:scale-95 transition-all
                                    disabled:opacity-50 disabled:scale-100
                                "
                            >
                                {submitting ? "Enregistrement..." : (editingId ? "Mettre à jour" : "Ajouter")}
                            </button>
                        </div>
                    </form>
                </div>

                {/* List of existing mappings */}
                <div className="flex-1 overflow-y-auto p-8 glass-scroll">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <Spinner />
                            <p className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/30">Chargement...</p>
                        </div>
                    ) : owners.length === 0 ? (
                        <div className="text-center py-12 opacity-30 italic text-sm">
                            Aucun emplacement renommé pour le moment.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {owners.map(item => (
                                <div 
                                    key={item.id}
                                    className="
                                        flex items-center justify-between p-4 rounded-2xl
                                        bg-cca-base/30 border border-cca-border hover:border-brand-primary/30 transition-all group
                                    "
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-cca-textPrimary">{item.name}</span>
                                        <span className="text-[10px] font-bold text-cca-textSecondary/50 uppercase tracking-tighter">{item.owner}</span>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleEdit(item)}
                                            className="h-8 w-8 rounded-lg bg-cca-surface border border-cca-border flex items-center justify-center text-cca-textSecondary hover:text-brand-primary transition-all"
                                            title="Modifier"
                                        >
                                            ✎
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(item.id)}
                                            className="h-8 w-8 rounded-lg bg-cca-surface border border-cca-border flex items-center justify-center text-cca-textSecondary hover:text-rose-500 transition-all"
                                            title="Supprimer"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
        </>
    );
}
