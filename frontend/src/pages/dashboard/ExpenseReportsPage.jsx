// frontend/src/pages/dashboard/ExpenseReportsPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Check, X, Clock, Plus, Pencil, Trash2, Save } from "lucide-react";

import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/Modal";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import Pagination from "@/components/ui/Pagination";
import apiClient from "@/services/api";

import {
    getExpenseReports,
    updateExpenseReportStatus,
    createExpenseReportCategory,
    updateExpenseReportCategory,
    deleteExpenseReportCategory,
    createExpenseReport,
    getExpenseReportCategories,
} from "@/services/comptabiliteService";

import usePagination from "@/hooks/usePagination";

import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/contexts/PermissionsContext";

const StatusBadge = ({ status }) => {
    const styles = {
        PENDING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        REIMBURSED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        REJECTED: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    };
    const labels = {
        PENDING: "En Attente",
        REIMBURSED: "Validé",
        REJECTED: "Rejeté",
    };
    return (
        <span className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border shadow-sm backdrop-blur-md transition-all ${styles[status] || "bg-cca-surface/20 text-cca-textSecondary border-cca-border"}`}>
            {labels[status] || status}
        </span>
    );
};

function resolvePermissionTemplate(permission, companyId) {
    if (!permission) return permission;
    return String(permission).replace("{companyId}", String(companyId));
}

const ExpenseReportsPage = () => {
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;

    const { has, isReady } = usePermissions();

    const canManageReports = useMemo(() => {
        if (!companyId) return false;
        return has(resolvePermissionTemplate("COMPTABILITE.{companyId}.EXPENSE_REPORTS.MANAGE", companyId));
    }, [has, companyId]);

    const canManageCategories = useMemo(() => {
        if (!companyId) return false;
        return has(resolvePermissionTemplate("COMPTABILITE.{companyId}.EXPENSE_CATEGORIES.MANAGE", companyId));
    }, [has, companyId]);

    const canEditReports = canManageReports;
    const canDeleteReports = canManageReports;

    const [reports, setReports] = useState([]);
    const [categories, setCategories] = useState([]);

    const [filters, setFilters] = useState({
        q: "",
        status: "ALL",
        categoryId: "ALL",
        authorId: "ALL",
    });

    const [loading, setLoading] = useState(true);
    const [loadingCategories, setLoadingCategories] = useState(false);

    const [newCategoryName, setNewCategoryName] = useState("");
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReport, setEditingReport] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    const [form, setForm] = useState({
        date: "",
        categoryId: "",
        amount: "",
        comment: "",
    });

    const fetchReports = useCallback(async () => {
        if (!companyId) return;

        setLoading(true);
        try {
            const data = await getExpenseReports(companyId);
            setReports(Array.isArray(data) ? data : []);
        } catch (error) {
            toast.error(error?.message || "Échec de l'audit des registres.");
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    const fetchCategories = useCallback(async () => {
        if (!companyId) return;

        setLoadingCategories(true);
        try {
            const data = await getExpenseReportCategories(companyId);
            setCategories(Array.isArray(data) ? data : []);
        } catch (error) {
            toast.error(error?.message || "Échec de l'audit des catégories.");
        } finally {
            setLoadingCategories(false);
        }
    }, [companyId]);

    useEffect(() => {
        if (!isReady) return;
        if (!companyId) return;

        if (!canManageReports) {
            setLoading(false);
            return;
        }

        fetchReports();
        fetchCategories();
    }, [isReady, companyId, canManageReports, fetchReports, fetchCategories]);

    const authorOptions = useMemo(() => {
        const map = new Map();
        for (const r of reports) {
            const id = r?.author?.id ?? r?.authorId;
            const name = r?.author?.name;
            if (id == null || !name) continue;
            map.set(String(id), name);
        }
        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [reports]);

    const filteredReports = useMemo(() => {
        const q = String(filters.q || "").trim().toLowerCase();

        return reports.filter((r) => {
            if (filters.status !== "ALL" && r?.status !== filters.status) return false;

            const rCategoryId = r?.categoryId ?? r?.category?.id;
            if (filters.categoryId !== "ALL" && String(rCategoryId ?? "") !== String(filters.categoryId)) return false;

            const rAuthorId = r?.author?.id ?? r?.authorId;
            if (filters.authorId !== "ALL" && String(rAuthorId ?? "") !== String(filters.authorId)) return false;

            if (!q) return true;

            const haystack = [
                r?.author?.name,
                r?.category?.name,
                r?.comment,
                r?.date ? format(new Date(r.date), "PPP", { locale: fr }) : "",
                r?.amount != null ? String(r.amount) : "",
                r?.status,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(q);
        });
    }, [reports, filters]);

    const { page, pageSize, totalItems, totalPages, setPageSize, goTo, slice } = usePagination(filteredReports, { pageSize: 10 });

    useEffect(() => { goTo(1); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleStatusUpdate = async (reportId, status) => {
        try {
            await updateExpenseReportStatus(companyId, reportId, status);
            toast.success(`État transmuté en ${status.toLowerCase()}.`);
            fetchReports();
        } catch (err) {
            toast.error(err?.message || "Collision détectée lors de la mutation.");
        }
    };

    const handleCreateCategory = async (e) => {
        e.preventDefault();
        try {
            await createExpenseReportCategory(companyId, newCategoryName);
            toast.success(`Nomenclature "${newCategoryName}" validée.`);
            setNewCategoryName("");
            fetchCategories();
        } catch (error) {
            toast.error(error?.message || "Échec de l'instanciation.");
        }
    };

    const handleSaveCategory = async (categoryId) => {
        try {
            const updated = await updateExpenseReportCategory(companyId, categoryId, editingCategoryName);
            setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, name: updated.name } : c));
            setEditingCategoryId(null);
            toast.success('Catégorie mise à jour.');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Erreur mise à jour.');
        }
    };

    const handleDeleteCategory = (categoryId) => {
        setConfirmModal({
            isOpen: true,
            message: 'Supprimer cette catégorie ?',
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await deleteExpenseReportCategory(companyId, categoryId);
                    setCategories(prev => prev.filter(c => c.id !== categoryId));
                    toast.success('Catégorie supprimée.');
                } catch (err) {
                    toast.error(err?.response?.data?.message || 'Erreur suppression.');
                }
            },
        });
    };

    const openCreateModal = () => {
        const today = format(new Date(), "yyyy-MM-dd");
        setEditingReport(null);
        setForm({
            date: today,
            categoryId: categories?.[0]?.id ? String(categories[0].id) : "",
            amount: "",
            comment: "",
        });
        setIsModalOpen(true);
    };

    const openEditModal = (report) => {
        setEditingReport(report);

        const dateValue = report?.date ? format(new Date(report.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

        setForm({
            date: dateValue,
            categoryId: report?.categoryId ? String(report.categoryId) : (report?.category?.id ? String(report.category.id) : ""),
            amount: report?.amount != null ? String(report.amount) : "",
            comment: report?.comment || "",
        });

        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingReport(null);
    };

    const handleSubmitReport = async (e) => {
        e.preventDefault();

        const payload = {
            date: form.date,
            categoryId: Number(form.categoryId),
            amount: Number(form.amount),
            comment: form.comment,
        };

        if (!payload.date || !payload.categoryId || !payload.amount || !payload.comment) {
            toast.error("Veuillez saturer tous les champs requis.");
            return;
        }

        try {
            if (!editingReport) {
                await createExpenseReport(companyId, payload);
                toast.success("Note de frais indexée.");
            } else {
                await apiClient.patch(`/comptabilite/expense-reports/${editingReport.id}`, payload);
                toast.success("Données rectifiées.");
            }

            closeModal();
            fetchReports();
        } catch (err) {
            toast.error(err?.response?.data?.message || err?.message || "Signal d'erreur lors du transfert.");
        }
    };

    const handleDeleteReport = async (report) => {
        if (!report?.id) return;
        try {
            await apiClient.delete(`/comptabilite/expense-reports/${report.id}`);
            toast.success("Rapport révoqué.");
            fetchReports();
        } catch (err) {
            toast.error(err?.response?.data?.message || err?.message || "Révocation impossible.");
        }
    };

    if (!isReady) {
        return (
            <div className="flex justify-center py-24">
                <Spinner />
            </div>
        );
    }

    if (!canManageReports) {
        return (
            <div className="flex flex-col items-center justify-center p-24 bg-cca-surface/10 rounded-3xl border border-cca-border/20 opacity-30 text-center space-y-4">
                 <X size={48} className="text-rose-500" />
                <h1 className="text-3xl font-black font-heading text-cca-textPrimary">Zone Restreinte</h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary">Accréditation comptable insuffisante</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1600px] mx-auto space-y-10 pb-16 animate-in fade-in duration-700 overflow-hidden">

            {/* HEADER */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary/80">Flux de Trésorerie & Remboursements</p>
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-cca-textPrimary font-heading">Notes de Frais</h1>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <button
                        onClick={fetchReports}
                        className="
                             h-[52px] px-6 rounded-2xl bg-cca-surface/40 border border-cca-border text-white text-[10px] font-black uppercase tracking-widest
                             hover:bg-cca-surface transition-all active:scale-95 disabled:opacity-50
                        "
                        disabled={loading}
                    >
                         Rafraîchir Audit
                    </button>

                    <button
                        onClick={openCreateModal}
                        className="
                             h-[52px] px-6 rounded-2xl bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest
                             shadow-xl shadow-brand-primary/20 hover:brightness-110 transition-all active:scale-95
                             flex items-center gap-2
                        "
                        disabled={loadingCategories}
                    >
                        <Plus size={16} />
                        Déposer un Rapport
                    </button>
                </div>
            </div>

            {/* FILTRES PREMIUM */}
            <div className="
                 relative overflow-hidden rounded-3xl p-8
                 bg-cca-surface/20 border border-cca-border backdrop-blur-3xl shadow-2xl shadow-black/40
                 transition-all hover:bg-cca-surface/30
            ">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end">
                    <div className="flex-grow space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/50 ml-1">Recherche Analytique</label>
                        <input
                            value={filters.q}
                            onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                            placeholder="Nom, catégorie, référence..."
                            className="
                                 w-full h-[52px] bg-cca-base/40 border border-cca-border/50 rounded-2xl px-5 text-sm text-white
                                 placeholder:text-cca-textSecondary/30 focus:border-brand-primary focus:bg-cca-base/60 transition-all outline-none
                            "
                        />
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <div className="w-full sm:w-auto space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/50 ml-1">Statut</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                                className="h-[52px] px-5 bg-cca-base/40 border border-cca-border rounded-2xl text-sm text-white focus:border-brand-primary transition-all cursor-pointer"
                            >
                                <option value="ALL">Tout l'Historique</option>
                                <option value="PENDING">En Attente</option>
                                <option value="REIMBURSED">Remboursées</option>
                                <option value="REJECTED">Rejetées</option>
                            </select>
                        </div>

                        <div className="w-full sm:w-auto space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/50 ml-1">Classification</label>
                            <select
                                value={filters.categoryId}
                                onChange={(e) => setFilters((p) => ({ ...p, categoryId: e.target.value }))}
                                className="h-[52px] px-5 bg-cca-base/40 border border-cca-border rounded-2xl text-sm text-white focus:border-brand-primary transition-all cursor-pointer"
                            >
                                <option value="ALL">Catégories Globales</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={String(c.id)}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="w-full sm:w-auto space-y-2">
                             <label className="text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/50 ml-1">Émetteur</label>
                            <select
                                value={filters.authorId}
                                onChange={(e) => setFilters((p) => ({ ...p, authorId: e.target.value }))}
                                className="h-[52px] px-5 bg-cca-base/40 border border-cca-border rounded-2xl text-sm text-white focus:border-brand-primary transition-all cursor-pointer"
                            >
                                <option value="ALL">Tous les Employés</option>
                                {authorOptions.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-cca-border/30 pt-6">
                    <div className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40">
                         {totalItems} <span className="opacity-50">sur</span> {reports.length} flux détectés
                    </div>

                    <button
                        type="button"
                        onClick={() => setFilters({ q: "", status: "ALL", categoryId: "ALL", authorId: "ALL" })}
                        className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
                    >
                        Réinitialiser l'Audit
                    </button>
                </div>
            </div>

            {canManageCategories && (
                <div className="relative overflow-hidden rounded-3xl p-6 bg-brand-primary/5 border border-brand-primary/20 backdrop-blur-3xl group space-y-6">
                    <form onSubmit={handleCreateCategory} className="flex flex-col xl:flex-row gap-6">
                        <div className="flex-grow space-y-2">
                             <label className="text-[8px] font-black uppercase tracking-[0.4em] text-brand-primary/60 ml-2">Administration des nomenclatures</label>
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Intitulé de la nouvelle catégorie..."
                                className="w-full h-[52px] bg-white/5 border border-white/10 rounded-2xl px-6 text-sm text-white placeholder:text-white/10 focus:border-brand-primary transition-all"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="h-[52px] px-10 rounded-2xl bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand-primary/10 hover:brightness-110 active:scale-95 transition-all self-end"
                        >
                            Enregistrer Nomenclature
                        </button>
                    </form>

                    {categories.length > 0 && (
                        <div className="flex flex-wrap gap-3 border-t border-brand-primary/10 pt-4">
                            {categories.map((cat) => (
                                <div key={cat.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                                    {editingCategoryId === cat.id ? (
                                        <>
                                            <input
                                                type="text"
                                                value={editingCategoryName}
                                                onChange={(e) => setEditingCategoryName(e.target.value)}
                                                className="h-8 bg-cca-base/60 border border-cca-border rounded-lg px-3 text-sm text-white focus:border-brand-primary transition-all outline-none"
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleSaveCategory(cat.id)}
                                                className="h-8 px-3 rounded-lg bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
                                            >
                                                <Save size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditingCategoryId(null)}
                                                className="h-8 px-3 rounded-lg bg-cca-surface/40 border border-cca-border text-white text-[10px] font-black uppercase tracking-widest hover:bg-cca-surface transition-all"
                                            >
                                                <X size={14} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/70">{cat.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }}
                                                className="h-7 w-7 flex items-center justify-center rounded-lg bg-cca-surface/40 border border-cca-border text-white/60 hover:text-white hover:bg-cca-surface transition-all"
                                            >
                                                <Pencil size={12} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteCategory(cat.id)}
                                                className="h-7 w-7 flex items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TABLEAU / CARDS */}
            {loading ? (
                <div className="flex justify-center py-24 bg-cca-surface/10 rounded-3xl border border-cca-border/20">
                    <Spinner />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Mobile View */}
                    <div className="md:hidden space-y-4">
                        {totalItems === 0 ? (
                            <div className="py-24 text-center text-cca-textSecondary/30 bg-cca-surface/10 rounded-3xl border border-cca-border/20 italic">Aucune note de frais archivée.</div>
                        ) : (
                            slice.map((report) => (
                                <div key={report.id} className="rounded-3xl border border-cca-border bg-cca-surface/20 p-6 backdrop-blur-3xl shadow-xl transition-all active:scale-[0.98]">
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div className="min-w-0">
                                            <div className="text-base font-black tracking-tight text-white truncate">
                                                {report.author?.name || "Anonyme"}
                                            </div>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/40 mt-1">
                                                {report.date ? format(new Date(report.date), "PPP", { locale: fr }) : "-"}
                                            </div>
                                        </div>
                                        <div className="shrink-0 flex flex-col items-end gap-3">
                                            <div className="font-mono font-black text-emerald-400 text-lg tracking-tighter">
                                                 {report.amount != null ? `${parseFloat(report.amount).toFixed(0)} $` : "-"}
                                            </div>
                                            <StatusBadge status={report.status} />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 bg-cca-base/40 rounded-xl px-4 py-2 border border-cca-border/50">
                                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/40">Classification :</span>
                                            <span className="text-[10px] font-black text-cca-textPrimary uppercase tracking-widest">{report.category?.name || "-"}</span>
                                        </div>

                                        <div className="p-4 bg-cca-base/40 rounded-2xl border border-cca-border/50 text-xs text-cca-textSecondary italic leading-relaxed">
                                            "{report.comment}"
                                        </div>
                                    </div>

                                    <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-cca-border/30 pt-6">
                                        {report.status === "PENDING" ? (
                                            <>
                                                <button
                                                    onClick={() => handleStatusUpdate(report.id, "REIMBURSED")}
                                                    className="h-12 px-5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                                >
                                                    <Check size={16} /> Valider
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate(report.id, "REJECTED")}
                                                    className="h-12 px-5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                                >
                                                    <X size={16} /> Rejeter
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleStatusUpdate(report.id, "PENDING")}
                                                className="h-12 px-5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                            >
                                                <Clock size={16} /> Reset
                                            </button>
                                        )}

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => openEditModal(report)}
                                                disabled={!canEditReports || report.status !== "PENDING"}
                                                className="h-12 w-12 flex items-center justify-center rounded-xl bg-cca-surface/40 border border-cca-border text-cca-textPrimary disabled:opacity-30 transition-all"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteReport(report)}
                                                disabled={!canDeleteReports}
                                                className="h-12 w-12 flex items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 disabled:opacity-30 transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop View */}
                    <div className="hidden md:block w-full relative overflow-hidden rounded-3xl bg-cca-surface/20 border border-cca-border backdrop-blur-3xl shadow-2xl shadow-black/40">
                        <div className="w-full overflow-x-auto">
                            <table className="min-w-full text-sm text-cca-textPrimary border-separate border-spacing-0">
                                <thead className="sticky top-0 z-10 bg-cca-surface/60 backdrop-blur-2xl">
                                    <tr>
                                        <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/50 border-b border-cca-border/30">Employé</th>
                                        <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/50 border-b border-cca-border/30">Période</th>
                                        <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/50 border-b border-cca-border/30">Classification</th>
                                        <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/50 border-b border-cca-border/30">Justificatif</th>
                                        <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/50 border-b border-cca-border/30">Montant</th>
                                        <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/50 border-b border-cca-border/30">Statut</th>
                                        <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/50 border-b border-cca-border/30">Actions Audit</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-cca-border/20">
                                    {totalItems === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-8 py-24 text-center text-cca-textSecondary/30 italic">Aucune note de frais détectée.</td>
                                        </tr>
                                    ) : (
                                        slice.map((report) => (
                                            <tr key={report.id} className="group hover:bg-brand-primary/5 transition-all">
                                                <td className="px-8 py-5 font-black text-cca-textPrimary group-hover:text-brand-primary transition-all">{report.author?.name || "-"}</td>
                                                <td className="px-8 py-5 text-[11px] font-bold text-cca-textSecondary/60">
                                                    {report.date ? format(new Date(report.date), "dd MMM yyyy", { locale: fr }) : "-"}
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="px-3 py-1 rounded-lg bg-cca-base/40 border border-cca-border/50 text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60">{report.category?.name || "-"}</span>
                                                </td>
                                                <td className="px-8 py-5 max-w-xs truncate text-[11px] font-medium text-cca-textSecondary group-hover:text-cca-textPrimary transition-colors italic" title={report.comment}>
                                                    "{report.comment}"
                                                </td>
                                                <td className="px-8 py-5 text-right font-mono font-black text-emerald-400 group-hover:drop-shadow-[0_0_10px_rgba(52,211,153,0.3)] transition-all">
                                                    {report.amount != null ? `${parseFloat(report.amount).toFixed(0)} $` : "-"}
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <StatusBadge status={report.status} />
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center justify-end gap-3">
                                                        {report.status === "PENDING" ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleStatusUpdate(report.id, "REIMBURSED")}
                                                                    className="h-9 w-9 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all shadow-lg hover:shadow-emerald-500/20"
                                                                >
                                                                    <Check size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleStatusUpdate(report.id, "REJECTED")}
                                                                    className="h-9 w-9 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all shadow-lg hover:shadow-rose-500/20"
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleStatusUpdate(report.id, "PENDING")}
                                                                className="h-9 w-9 flex items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all"
                                                            >
                                                                <Clock size={16} />
                                                            </button>
                                                        )}

                                                        <div className="h-4 w-px bg-cca-border/30 mx-1" />

                                                        <button
                                                            onClick={() => openEditModal(report)}
                                                            disabled={!canEditReports || report.status !== "PENDING"}
                                                            className="h-9 w-9 flex items-center justify-center rounded-xl bg-cca-surface/40 border border-cca-border text-cca-textPrimary hover:bg-white hover:text-black transition-all disabled:opacity-20"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteReport(report)}
                                                            disabled={!canDeleteReports}
                                                            className="h-9 w-9 flex items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-lg hover:shadow-rose-500/20 disabled:opacity-20"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        pageSizeOptions={[10, 25, 50]}
                        onPageChange={goTo}
                        onPageSizeChange={setPageSize}
                    />
                </div>
            )}

            {/* MODAL CREATE / EDIT */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingReport ? "Rectification de Rapport" : "Dépôt d'une Note de Frais"}
                premium
            >
                {loadingCategories ? (
                    <div className="flex justify-center py-16"><Spinner /></div>
                ) : (
                    <form onSubmit={handleSubmitReport} className="space-y-8 p-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 ml-1">Date d'engagement</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                                    className="w-full h-12 bg-cca-base/60 border border-cca-border rounded-2xl px-5 text-sm text-white focus:border-brand-primary transition-all"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 ml-1">Classification analytique</label>
                                <select
                                    value={form.categoryId}
                                    onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
                                    className="w-full h-12 bg-cca-base/60 border border-cca-border rounded-2xl px-5 text-sm text-white focus:border-brand-primary transition-all cursor-pointer"
                                    required
                                >
                                    <option value="" disabled>Sélectionner classification...</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={String(c.id)}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 ml-1">Indemnité sollicitée ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.amount}
                                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                                className="w-full h-12 bg-cca-base/60 border border-cca-border rounded-2xl px-5 text-sm text-white focus:border-brand-primary transition-all font-mono font-bold"
                                placeholder="0.00"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60 ml-1">Justification circonstanciée</label>
                            <textarea
                                value={form.comment}
                                onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
                                className="w-full bg-cca-base/60 border border-cca-border rounded-2xl p-5 text-sm text-white focus:border-brand-primary transition-all min-h-[140px] leading-relaxed resize-none"
                                placeholder="Décrivez les circonstances de la dépense..."
                                required
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="h-12 px-8 rounded-2xl bg-cca-surface/40 text-white text-[10px] font-black uppercase tracking-widest hover:bg-cca-surface transition-all"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                className="h-12 px-10 rounded-2xl bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
                                disabled={categories.length === 0}
                            >
                                <Save size={16} />
                                {editingReport ? "Valider Rectifications" : "Indexation Registre"}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
            />
        </div>
    );
};

export default ExpenseReportsPage;
