import React, { useState } from "react";
import { useChatStore } from "@/chat/store/useChatStore";
import apiClient from "@/services/api";
import { Plus, X } from "lucide-react";

export default function CreateCategoryModal({ isOpen, onClose }) {
    const { loadInitial } = useChatStore();

    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const close = () => {
        if (loading) return;
        setName("");
        onClose?.();
    };

    const create = async () => {
        if (!name.trim()) return;

        setLoading(true);
        try {
            await apiClient.post("/chat/categories", { name });
            await loadInitial(); // refresh sidebar
            close();
        } catch (err) {
            console.error("Erreur création catégorie :", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
            onClick={close}
        >
            <div
                className="
                    relative w-full max-w-md p-6 rounded-2xl
                    bg-cca-surface/60 border border-cca-border backdrop-blur-2xl
                    shadow-2xl shadow-black/80
                    animate-in zoom-in-95 duration-300
                "
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold font-heading text-cca-textPrimary flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-cca-base border border-cca-border">
                            <Plus size={20} className="text-brand-primary" />
                        </div>
                        Créer une catégorie
                    </h2>
                    <button
                        onClick={close}
                        className="p-2 rounded-xl bg-cca-base hover:bg-cca-surface border border-cca-border text-cca-textSecondary hover:text-cca-textPrimary transition-all active:scale-95"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="space-y-4">
                    <div className="flex flex-col">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-cca-textSecondary mb-2 ml-1">
                            Nom de la catégorie
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex : Administration"
                            maxLength={50}
                            className="
                                w-full px-4 py-3 rounded-xl
                                bg-cca-base border border-cca-border
                                text-cca-textPrimary placeholder-cca-textSecondary/40
                                focus:outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all
                            "
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={close}
                        disabled={loading}
                        className="
                            px-6 py-2.5 rounded-xl text-sm font-bold
                            bg-cca-base border border-cca-border
                            text-cca-textSecondary hover:bg-cca-surface
                            transition-all active:scale-95
                        "
                    >
                        Annuler
                    </button>

                    <button
                        onClick={create}
                        disabled={loading || !name.trim()}
                        className="
                            px-6 py-2.5 rounded-xl text-sm font-bold
                            bg-brand-primary hover:bg-brand-dark
                            border border-brand-primary
                            text-white transition-all active:scale-95 shadow-lg shadow-brand-primary/20
                            disabled:opacity-40 disabled:cursor-not-allowed
                        "
                    >
                        {loading ? "Création..." : "Créer la catégorie"}
                    </button>
                </div>
            </div>
        </div>
    );
}
