// frontend/src/pages/dashboard/partners/PartnerServicesPage.jsx

import React, { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Check, X, Pencil, Trash2, ArrowLeft } from "lucide-react";

import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import ConfirmationModal from "@/components/ui/ConfirmationModal";

import {
    getPartner,
    getPartnerServices,
    createPartnerService,
    updatePartnerService,
    deactivatePartnerService,
} from "@/services/partnershipService";

const PartnerServicesPage = () => {
    const { partnerId } = useParams();
    const queryClient = useQueryClient();

    const { activeCompanyId, selectedCompany } = useCompany();
    const companyId = activeCompanyId ?? selectedCompany?.id ?? null;

    const { isReady: permsReady, isLoading: permsLoading, has } = usePermissions();

    const canAccess = useMemo(() => permsReady && has("PARTENARIAT.ACCESS"), [permsReady, has]);
    const canList = useMemo(
        () => canAccess && has("PARTENARIAT.SERVICE_TYPE.LIST"),
        [canAccess, has]
    );
    const canCreate = useMemo(
        () => canAccess && has("PARTENARIAT.SERVICE_TYPE.CREATE"),
        [canAccess, has]
    );
    const canUpdate = useMemo(
        () => canAccess && has("PARTENARIAT.SERVICE_TYPE.UPDATE"),
        [canAccess, has]
    );
    const canDeactivate = useMemo(
        () => canAccess && has("PARTENARIAT.SERVICE_TYPE.DEACTIVATE"),
        [canAccess, has]
    );

    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [newPrice, setNewPrice] = useState("");

    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editPrice, setEditPrice] = useState("");
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    const { data: partner } = useQuery({
        queryKey: ["partner", partnerId],
        queryFn: () => getPartner(partnerId),
        enabled: Boolean(partnerId) && permsReady && canList,
    });

    const { data: services = [], isLoading } = useQuery({
        queryKey: ["partner-services", partnerId],
        queryFn: () => getPartnerServices(partnerId),
        enabled: Boolean(partnerId) && permsReady && canList,
    });

    const createMutation = useMutation({
        mutationFn: (data) => createPartnerService(partnerId, data),
        onSuccess: () => {
            toast.success("Service créé");
            queryClient.invalidateQueries({ queryKey: ["partner-services", partnerId] });
            setIsAdding(false);
            setNewName("");
            setNewPrice("");
        },
        onError: () => toast.error("Erreur lors de la création"),
    });

    const updateMutation = useMutation({
        mutationFn: (payload) => updatePartnerService(partnerId, payload.serviceId, payload.data),
        onSuccess: () => {
            toast.success("Service mis à jour");
            queryClient.invalidateQueries({ queryKey: ["partner-services", partnerId] });
            setEditingId(null);
        },
        onError: () => toast.error("Erreur lors de la mise à jour"),
    });

    const deleteMutation = useMutation({
        mutationFn: (serviceId) => deactivatePartnerService(partnerId, serviceId),
        onSuccess: () => {
            toast.success("Service désactivé");
            queryClient.invalidateQueries({ queryKey: ["partner-services", partnerId] });
        },
        onError: () => toast.error("Erreur lors de la désactivation"),
    });

    const handleCreate = () => {
        if (!canCreate) return;
        const name = newName.trim();
        if (!name) return toast.error("Nom requis");
        const priceNum = Number(newPrice);
        if (!Number.isFinite(priceNum)) return toast.error("Prix invalide");

        createMutation.mutate({ name, price: priceNum });
    };

    const handleSaveEdit = () => {
        if (!canUpdate) return;
        const name = editName.trim();
        if (!name) return toast.error("Nom requis");
        const priceNum = Number(editPrice);
        if (!Number.isFinite(priceNum)) return toast.error("Prix invalide");

        updateMutation.mutate({
            serviceId: editingId,
            data: { name, price: priceNum },
        });
    };

    if (!companyId) {
        return (
            <div className="rounded-2xl border border-cca-border bg-cca-surface/40 p-6 text-cca-textSecondary">
                Aucune entreprise sélectionnée.
            </div>
        );
    }

    if (permsLoading || !permsReady) {
        return (
            <div className="rounded-2xl border border-cca-border bg-cca-surface/40 p-6 text-cca-textSecondary">
                Chargement des droits…
            </div>
        );
    }

    if (!canAccess || !canList) {
        return (
            <div className="rounded-2xl border border-cca-border bg-cca-surface/40 p-6">
                <h1 className="text-xl font-semibold text-cca-textPrimary">Services du partenaire</h1>
                <p className="mt-2 text-sm text-cca-textSecondary">
                    Accès refusé : permissions requises{" "}
                    <span className="text-cca-textPrimary">PARTENARIAT.ACCESS</span> /{" "}
                    <span className="text-cca-textPrimary">PARTENARIAT.SERVICE_TYPE.LIST</span>.
                </p>
                <div className="mt-4">
                    <Link
                        to={`/dashboard/partners/${partnerId}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-cca-surface border border-cca-border px-3 py-2 text-sm font-medium hover:bg-cca-base text-cca-textPrimary transition-colors"
                    >
                        <ArrowLeft size={18} />
                        Retour
                    </Link>
                </div>
            </div>
        );
    }

    if (isLoading) return <div className="p-6 text-cca-textSecondary">Chargement des services…</div>;

    return (
        <div className="space-y-6 text-cca-textPrimary">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        to={`/dashboard/partners/${partnerId}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-cca-surface border border-cca-border px-3 py-2 text-sm font-medium hover:bg-cca-base text-cca-textPrimary transition-colors"
                    >
                        <ArrowLeft size={18} />
                        Retour
                    </Link>

                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">Services</h1>
                        <p className="text-sm text-cca-textSecondary mt-1">
                            Catalogue — <span className="text-cca-textPrimary">{partner?.name}</span>
                        </p>
                    </div>
                </div>

                {canCreate && !isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium hover:bg-brand-dark text-white transition-colors"
                    >
                        <Plus size={18} />
                        Ajouter
                    </button>
                )}
            </div>

            {isAdding && canCreate && (
                <div className="rounded-2xl border border-cca-border bg-cca-surface/40 p-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                            type="text"
                            placeholder="Nom du service"
                            className="bg-cca-base border border-cca-border px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-brand-primary/50 text-cca-textPrimary placeholder:text-cca-textSecondary/50 transition-all"
                            autoFocus
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                        <input
                            type="number"
                            placeholder="Prix"
                            className="bg-cca-base border border-cca-border px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-brand-primary/50 text-cca-textPrimary placeholder:text-cca-textSecondary/50 transition-all"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleCreate}
                                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 text-white transition-colors"
                            >
                                Créer
                            </button>
                            <button
                                onClick={() => {
                                    setIsAdding(false);
                                    setNewName("");
                                    setNewPrice("");
                                }}
                                className="flex-1 rounded-lg bg-cca-surface border border-cca-border px-4 py-2 text-sm font-medium hover:bg-cca-base text-cca-textPrimary transition-colors"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-2xl border border-cca-border bg-cca-surface/40 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-cca-base/50 border-b border-cca-border">
                        <tr>
                            <th className="px-4 py-3 text-left text-cca-textSecondary">Nom</th>
                            <th className="px-4 py-3 text-right text-cca-textSecondary">Prix</th>
                            <th className="px-4 py-3 text-right text-cca-textSecondary">Actions</th>
                        </tr>
                        </thead>

                        <tbody className="divide-y divide-cca-border">
                        {services.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-10 text-center text-cca-textSecondary">
                                    Aucun service.
                                </td>
                            </tr>
                        ) : (
                            services.map((srv) => (
                                <tr key={srv.id} className="hover:bg-cca-surface/20 transition-colors">
                                    <td className="px-4 py-3">
                                        {editingId === srv.id ? (
                                            <input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                autoFocus
                                                className="w-full bg-cca-base border border-cca-border px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-brand-primary/50 text-cca-textPrimary transition-all"
                                            />
                                        ) : (
                                            srv.name
                                        )}
                                    </td>

                                    <td className="px-4 py-3 text-right">
                                        {editingId === srv.id ? (
                                            <input
                                                type="number"
                                                value={editPrice}
                                                onChange={(e) => setEditPrice(e.target.value)}
                                                className="w-28 bg-cca-base border border-cca-border px-3 py-2 rounded-lg text-right outline-none focus:ring-2 focus:ring-brand-primary/50 text-cca-textPrimary transition-all"
                                            />
                                        ) : (
                                            `${srv.partnerPrice} $`
                                        )}
                                    </td>

                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                        {editingId === srv.id ? (
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    onClick={handleSaveEdit}
                                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium hover:bg-emerald-500 text-white transition-colors"
                                                >
                                                    <Check size={16} />
                                                    OK
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="inline-flex items-center gap-2 rounded-lg bg-cca-surface border border-cca-border px-3 py-2 text-xs font-medium hover:bg-cca-base text-cca-textPrimary transition-colors"
                                                >
                                                    <X size={16} />
                                                    Annuler
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (!canUpdate) return;
                                                        setEditingId(srv.id);
                                                        setEditName(srv.name);
                                                        setEditPrice(srv.partnerPrice);
                                                    }}
                                                    disabled={!canUpdate}
                                                    className="inline-flex items-center gap-2 rounded-lg bg-cca-surface border border-cca-border px-3 py-2 text-xs font-medium hover:bg-cca-base text-cca-textPrimary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Modifier"
                                                >
                                                    <Pencil size={16} />
                                                    Modifier
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        if (!canDeactivate) return;
                                                        setConfirmModal({
                                                            isOpen: true,
                                                            message: "Désactiver ce service ?",
                                                            onConfirm: () => {
                                                                setConfirmModal(p => ({ ...p, isOpen: false }));
                                                                deleteMutation.mutate(srv.id);
                                                            },
                                                        });
                                                    }}
                                                    disabled={!canDeactivate}
                                                    className="inline-flex items-center gap-2 rounded-lg bg-red-600/90 px-3 py-2 text-xs font-medium hover:bg-red-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Désactiver"
                                                >
                                                    <Trash2 size={16} />
                                                    Désactiver
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
            />
        </div>
    );
};

export default PartnerServicesPage;
