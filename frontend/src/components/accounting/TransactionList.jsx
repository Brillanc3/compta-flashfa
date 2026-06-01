// frontend/src/components/accounting/TransactionList.jsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { Edit, Save, X, FileText } from "lucide-react";

import { updateTransactionCategory } from "@/services/comptabiliteService";
import TransactionFilter from "./TransactionFilter";
import BillViewerModal from "./BillViewerModal";

/* --------------------------------------------------------------------------
   Helpers
--------------------------------------------------------------------------- */
function formatMoneyUSD(amount) {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" }).format(
        Number(amount) || 0
    );
}

function formatDateFR(dateLike) {
    try {
        const d = new Date(dateLike);
        if (Number.isNaN(d.getTime())) return "—";
        return d.toLocaleString("fr-FR");
    } catch {
        return "—";
    }
}

export default function TransactionList({ companyId, transactions, categories, onFilterChange, onUpdate }) {
    const resolvedCompanyId = useMemo(() => {
        const n = Number(companyId);
        return Number.isFinite(n) && n > 0 ? n : null;
    }, [companyId]);

    const safeTransactions = useMemo(() => Array.isArray(transactions) ? transactions : [], [transactions]);
    const safeCategories = useMemo(() => Array.isArray(categories) ? categories : [], [categories]);

    const [currentPage, setCurrentPage] = useState(1);
    const [editingTx, setEditingTx] = useState(null);
    const [viewingBillId, setViewingBillId] = useState(null);

    const pageSize = 15;
    const totalPages = Math.max(1, Math.ceil(safeTransactions.length / pageSize));

    // UX: si la liste change radicalement (nouvelle boîte de données), on vérifie la cohérence de la page
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(1);
        }
        setEditingTx(null);
    }, [safeTransactions, totalPages, currentPage]);

    const handleFilterChangeWrapped = useCallback((newFilters) => {
        setCurrentPage(1);
        if (onFilterChange) onFilterChange(newFilters);
    }, [onFilterChange]);

    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        return safeTransactions.slice(start, end);
    }, [safeTransactions, currentPage]);

    /* -------------------------------------------
       Save category edit
    --------------------------------------------*/
    const handleCategorySave = async () => {
        if (!editingTx) return;

        try {
            const updatedTx = await updateTransactionCategory(resolvedCompanyId, editingTx.id, editingTx.categoryId);
            toast.success("Catégorie mise à jour.");
            setEditingTx(null);
            if (onUpdate) onUpdate(updatedTx);
        } catch {
            toast.error("Erreur lors de la mise à jour.");
            setEditingTx(null);
        }
    };

    /* -------------------------------------------
       Categories filtered by tx type
    --------------------------------------------*/
    const availableCategoriesForEdit = useMemo(() => {
        if (!editingTx) return [];

        const currentTx = safeTransactions.find((tx) => tx.id === editingTx.id);
        const txType = currentTx?.category?.type;

        if (!txType) return safeCategories;
        return safeCategories.filter((cat) => cat.type === txType);
    }, [editingTx, safeCategories, safeTransactions]);

    const isRevenue = (tx) => tx?.category?.type === "REVENUE";

    const renderTypeBadge = (tx) => {
        const revenue = isRevenue(tx);
        return (
            <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${revenue ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"}`} />
                <span
                    className={[
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border",
                        revenue
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20",
                    ].join(" ")}
                >
                    {revenue ? "Revenu" : "Dépense"}
                </span>
            </div>
        );
    };

    const renderAmount = (tx) => {
        const revenue = isRevenue(tx);
        const sign = revenue ? "+" : "-";
        return (
            <span className={["font-bold font-mono tracking-tight", revenue ? "text-emerald-400" : "text-red-400"].join(" ")}>
                {sign} {formatMoneyUSD(tx?.amount)}
            </span>
        );
    };

    const pageLabel = (
        <div className="text-[11px] font-bold uppercase tracking-wider text-cca-textSecondary/60 min-w-0 break-words">
            Page <span className="text-cca-textPrimary">{currentPage}</span> sur{" "}
            <span className="text-cca-textPrimary">{totalPages}</span>
            <span className="ml-2 font-medium normal-case">({safeTransactions.length} transactions)</span>
        </div>
    );

    return (
        // FIX MOBILE: empêche un enfant de “pousser” horizontalement
        <div className="space-y-4 w-full max-w-full overflow-x-hidden min-w-0">
            {/* Filters */}
            <TransactionFilter categories={safeCategories} onFilterChange={handleFilterChangeWrapped} />

            <BillViewerModal companyId={resolvedCompanyId} billId={viewingBillId} onClose={() => setViewingBillId(null)} />

            {/* MOBILE: cards (comme factures) */}
            <div className="md:hidden space-y-4 w-full max-w-full min-w-0">
                {paginatedTransactions.length === 0 ? (
                    <div className="text-center py-12 bg-cca-surface/40 border border-cca-border rounded-2xl text-cca-textSecondary italic">Aucune transaction trouvée.</div>
                ) : (
                    paginatedTransactions.map((tx) => {
                        const isEditing = editingTx?.id === tx.id;
                        const categoryName = tx?.category?.name;

                        return (
                            <div
                                key={tx.id}
                                className="
                                    relative rounded-2xl border border-cca-border bg-cca-surface/40 backdrop-blur-xl p-5 
                                    transition-all hover:bg-cca-surface shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300
                                "
                            >
                                <div className="flex items-start justify-between gap-4 min-w-0">
                                    {/* LEFT */}
                                    <div className="space-y-2 min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-3 min-w-0 mb-1">
                                            <span className="text-[10px] font-bold text-cca-textSecondary/50 tracking-widest uppercase shrink-0">#{tx.id}</span>
                                            {renderTypeBadge(tx)}
                                            {tx.billId ? (
                                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border border-cca-border bg-cca-base text-cca-textSecondary">
                                                    Facture lié
                                                </span>
                                            ) : null}
                                        </div>

                                        <div
                                            className="text-cca-textPrimary font-bold text-base leading-tight whitespace-normal break-words"
                                            title={tx.description}
                                        >
                                            {tx.description || "—"}
                                        </div>

                                        <div className="text-[11px] font-medium text-cca-textSecondary/70 flex items-center gap-2">
                                            <span>Catégorie :</span>
                                            {!isEditing ? (
                                                categoryName ? (
                                                    <span className="text-cca-textPrimary font-semibold px-2 py-0.5 rounded-lg bg-cca-base border border-cca-border/30"> {categoryName}</span>
                                                ) : (
                                                    <span className="text-amber-400 italic"> Non classé</span>
                                                )
                                            ) : null}
                                        </div>

                                        {isEditing && editingTx && (
                                            <div className="pt-2 min-w-0 animate-in fade-in slide-in-from-top-1 duration-300">
                                                <select
                                                    value={editingTx?.categoryId || ""}
                                                    onChange={(e) =>
                                                        setEditingTx((prev) => prev ? ({
                                                            ...prev,
                                                            categoryId: parseInt(e.target.value, 10),
                                                        }) : null)
                                                    }
                                                    className="w-full rounded-xl bg-cca-base border border-cca-border px-4 py-2.5 text-sm text-cca-textPrimary
                                                               focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none"
                                                >
                                                    <option value="" disabled>
                                                        Choisir…
                                                    </option>
                                                    {availableCategoriesForEdit.map((cat) => (
                                                        <option key={cat.id} value={cat.id}>
                                                            {cat.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    {/* RIGHT */}
                                    <div className="text-right space-y-2 shrink-0">
                                    <div className="text-cca-textPrimary">{renderAmount(tx)}</div>

                                        <div className="flex items-center justify-end gap-2">
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={handleCategorySave}
                                                        className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95"
                                                        title="Sauvegarder"
                                                    >
                                                        <Save size={18} className="text-emerald-400" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingTx(null)}
                                                        className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all active:scale-95"
                                                        title="Annuler"
                                                    >
                                                        <X size={18} className="text-red-400" />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingTx({ id: tx.id, categoryId: tx.categoryId })}
                                                    className="p-2.5 rounded-xl bg-cca-base border border-cca-border hover:bg-cca-surface transition-all active:scale-95"
                                                    title="Modifier la catégorie"
                                                >
                                                    <Edit size={18} className="text-cca-textSecondary" />
                                                </button>
                                            )}

                                            {tx.billId ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setViewingBillId(tx.billId)}
                                                    className="p-2.5 rounded-xl bg-cca-base border border-cca-border hover:bg-cca-surface transition-all active:scale-95"
                                                    title={`Voir la facture #${tx.billId}`}
                                                >
                                                    <FileText size={18} className="text-cca-textSecondary" />
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-cca-border/50 flex items-center justify-between text-[11px] font-bold text-cca-textSecondary/60 gap-4 min-w-0">
                                    <div className="min-w-0 break-words uppercase tracking-wider">{formatDateFR(tx.date)}</div>
                                    {categoryName ? (
                                        <div className="text-brand-primary bg-brand-primary/10 border border-brand-primary/20 rounded-lg px-2.5 py-1 max-w-[55%] truncate uppercase tracking-tighter">
                                            {categoryName}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* DESKTOP: table */}
            <div className="hidden md:block relative overflow-hidden rounded-2xl border border-cca-border bg-cca-surface/40 backdrop-blur-xl shadow-lg">
                <table className="min-w-full text-sm text-cca-textPrimary">
                    <thead className="bg-cca-base/50 border-b border-cca-border">
                    <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-cca-textSecondary/70 border-r border-cca-border/40">
                            Date
                        </th>
                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-cca-textSecondary/70 border-r border-cca-border/40">
                            Description
                        </th>
                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-cca-textSecondary/70 border-r border-cca-border/40">
                            Catégorie
                        </th>
                        <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-cca-textSecondary/70 border-r border-cca-border/40">
                            Montant
                        </th>
                        <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-cca-textSecondary/70">
                            Actions
                        </th>
                    </tr>
                    </thead>

                    <tbody className="divide-y divide-cca-border/40">
                    {paginatedTransactions.length > 0 ? (
                        paginatedTransactions.map((tx) => (
                            <tr
                                key={tx.id}
                                className="transition-all hover:bg-cca-surface group"
                            >
                                <td className="px-6 py-5 text-cca-textSecondary font-medium border-cca-border/40 whitespace-nowrap">{formatDateFR(tx.date)}</td>

                                <td className="px-6 py-5 max-w-sm truncate text-cca-textPrimary font-semibold" title={tx.description}>
                                    {tx.description || "—"}
                                </td>

                                <td className="px-6 py-5 whitespace-nowrap text-cca-textSecondary">
                                    {editingTx && editingTx.id === tx.id ? (
                                        <select
                                            value={editingTx.categoryId || ""}
                                            onChange={(e) =>
                                                setEditingTx((prev) => prev ? ({
                                                    ...prev,
                                                    categoryId: parseInt(e.target.value, 10),
                                                }) : null)
                                            }
                                            className="bg-cca-base border border-cca-border rounded-lg px-3 py-1.5 text-sm focus:border-brand-primary outline-none transition-all"
                                        >
                                            <option value="" disabled>
                                                Choisir…
                                            </option>
                                            {availableCategoriesForEdit.map((cat) => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : tx?.category?.name ? (
                                        <span className="px-2.5 py-1 rounded-lg bg-cca-base border border-cca-border text-[11px] font-bold uppercase tracking-tighter text-brand-primary">
                                             {tx.category.name}
                                        </span>
                                    ) : (
                                        <span className="text-amber-400/80 italic font-medium">Non classé</span>
                                    )}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                                    {renderAmount(tx)}
                                </td>

                                <td className="px-6 py-5 whitespace-nowrap text-center text-cca-textSecondary">
                                    <div className="flex items-center justify-center gap-3">
                                        {editingTx?.id === tx.id ? (
                                            <>
                                                <button onClick={handleCategorySave} className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all border border-emerald-500/20" title="Sauvegarder">
                                                    <Save size={16} />
                                                </button>
                                                <button onClick={() => setEditingTx(null)} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all border border-red-500/20" title="Annuler">
                                                    <X size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => setEditingTx({ id: tx.id, categoryId: tx.categoryId })}
                                                className="p-2 rounded-xl bg-cca-base border border-cca-border hover:bg-cca-surface text-cca-textSecondary hover:text-cca-textPrimary transition-all active:scale-95"
                                                title="Modifier la catégorie"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        )}

                                        {tx.billId ? (
                                            <button
                                                onClick={() => setViewingBillId(tx.billId)}
                                                className="p-2 rounded-xl bg-cca-base border border-cca-border hover:bg-cca-surface text-cca-textSecondary hover:text-cca-textPrimary transition-all active:scale-95"
                                                title={`Voir la facture #${tx.billId}`}
                                            >
                                                <FileText size={16} />
                                            </button>
                                        ) : null}
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="5" className="text-center py-12 text-cca-textSecondary italic">
                                Aucune transaction trouvée.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {safeTransactions.length > pageSize && (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 py-2">
                    {pageLabel}

                    <div className="flex gap-2">
                        <button
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="px-6 py-2.5 bg-cca-base border border-cca-border rounded-xl text-cca-textSecondary font-bold text-xs hover:bg-cca-surface transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                        >
                            Précédent
                        </button>
                        <button
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className="px-6 py-2.5 bg-cca-base border border-cca-border rounded-xl text-cca-textSecondary font-bold text-xs hover:bg-cca-surface transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                        >
                            Suivant
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
