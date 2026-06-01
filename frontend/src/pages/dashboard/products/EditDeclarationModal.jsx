// /frontend/src/pages/dashboard/products/EditDeclarationModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/button";

export default function EditDeclarationModal({ open, declaration, canEdit, saving, onClose, onSave }) {
    const [quantity, setQuantity] = useState(() => String(declaration?.quantity ?? ""));

    // Sync quand on change de déclaration (évite une valeur “stale”)
    useEffect(() => {
        if (!open) return;
        setQuantity(String(declaration?.quantity ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, declaration?.id]);

    const productName = useMemo(() => {
        return declaration?.product?.name || declaration?.productNameSnapshot || "Produit";
    }, [declaration]);

    const employeeName = useMemo(() => {
        return declaration?.employee?.user?.name || "Utilisateur";
    }, [declaration]);

    const qtyNumber = useMemo(() => {
        const n = Number(quantity);
        return Number.isFinite(n) ? n : NaN;
    }, [quantity]);

    if (!open) return null;

    const handleSubmit = async () => {
        if (!canEdit) return;
        if (!Number.isFinite(qtyNumber) || qtyNumber <= 0) return;

        await onSave({
            declarationId: declaration.id,
            quantity: qtyNumber,
        });
    };

    const disabled = !canEdit || saving || !Number.isFinite(qtyNumber) || qtyNumber <= 0;

    const modal = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-4">
            {/* overlay */}
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />

            <div
                className="
          relative w-full max-w-lg
          rounded-2xl border border-slate-700/70
          bg-slate-900/90 backdrop-blur-xl shadow-2xl shadow-black/50
          p-5
          max-h-[calc(100dvh-2rem)] overflow-auto
          pb-[calc(env(safe-area-inset-bottom)+1rem)]
        "
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-white">Modifier la déclaration</h3>
                        <p className="text-sm text-slate-400 mt-1 truncate">
                            {productName} — {employeeName}
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 transition"
                        aria-label="Fermer"
                    >
                        ✕
                    </button>
                </div>

                <div className="mt-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] uppercase tracking-wide text-slate-400 block mb-1">
                                Quantité actuelle
                            </label>
                            <div className="w-full rounded-lg bg-slate-800/50 border border-slate-700/70 px-3 py-2.5 text-sm text-slate-100">
                                {Number(declaration?.quantity || 0).toFixed(2)}
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] uppercase tracking-wide text-slate-400 block mb-1">
                                Nouvelle quantité
                            </label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                min="0"
                                step="0.01"
                                className="
                  w-full rounded-lg bg-slate-900/60 border border-slate-700/80
                  px-3 py-2.5 text-sm text-slate-100 focus:border-indigo-400 outline-none
                "
                                placeholder="Ex: 3"
                                disabled={!canEdit || saving}
                            />
                            {!Number.isFinite(qtyNumber) || qtyNumber <= 0 ? (
                                <p className="text-xs text-amber-300 mt-1">
                                    La quantité doit être un nombre strictement positif.
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                        <Button
                            onClick={onClose}
                            className="bg-slate-800 hover:bg-slate-700 border border-slate-700"
                            disabled={saving}
                        >
                            Annuler
                        </Button>

                        <Button
                            onClick={handleSubmit}
                            className="bg-indigo-600 hover:bg-indigo-700"
                            disabled={disabled}
                        >
                            {saving ? "Enregistrement..." : "Enregistrer"}
                        </Button>
                    </div>

                    {!canEdit ? (
                        <p className="text-xs text-slate-400">
                            Vous n’avez pas la permission de modifier les déclarations.
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    );

    // Portal vers body : évite les stacking-context (MobileNavBar) et garantit l’affichage au-dessus.
    if (typeof document !== "undefined") {
        return createPortal(modal, document.body);
    }

    return modal;
}
