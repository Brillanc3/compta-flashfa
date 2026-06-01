// frontend/src/pages/dashboard/partners/ServiceRenderedCreatePage.jsx

import React, { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/contexts/PermissionsContext";

import { getPartner, getPartnerServices, createServiceRendered } from "@/services/partnershipService";

const ServiceRenderedCreatePage = () => {
    const { partnerId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { activeCompanyId, selectedCompany } = useCompany();
    const companyId = activeCompanyId ?? selectedCompany?.id ?? null;

    const { isReady: permsReady, isLoading: permsLoading, has } = usePermissions();

    const canAccess = useMemo(() => permsReady && has("PARTENARIAT.ACCESS"), [permsReady, has]);
    const canCreateRendered = useMemo(
        () => canAccess && has("PARTENARIAT.SERVICE_RENDERED.CREATE"),
        [canAccess, has]
    );
    const canListTypes = useMemo(
        () => canAccess && has("PARTENARIAT.SERVICE_TYPE.LIST"),
        [canAccess, has]
    );

    const [serviceTypeId, setServiceTypeId] = useState("");
    const [quantity, setQuantity] = useState(1);

    const { data: partner } = useQuery({
        queryKey: ["partner", partnerId],
        queryFn: () => getPartner(partnerId),
        enabled: Boolean(partnerId) && permsReady && canAccess,
    });

    const { data: services = [] } = useQuery({
        queryKey: ["partner-services", partnerId],
        queryFn: () => getPartnerServices(partnerId),
        enabled: Boolean(partnerId) && permsReady && canListTypes,
    });

    const createMutation = useMutation({
        mutationFn: createServiceRendered,
        onSuccess: () => {
            toast.success("Prestation enregistrée");
            queryClient.invalidateQueries({ queryKey: ["partner-services", partnerId] });
            queryClient.invalidateQueries({ queryKey: ["partner-summary", partnerId] });
            navigate(`/dashboard/partners/${partnerId}`);
        },
        onError: () => toast.error("Erreur lors de l’enregistrement"),
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!canCreateRendered) return toast.error("Accès refusé");
        if (!serviceTypeId) return toast.error("Sélectionnez un service");
        const qty = Number(quantity);
        if (!Number.isFinite(qty) || qty <= 0) return toast.error("Quantité invalide");

        createMutation.mutate({
            partnerId: Number(partnerId),
            serviceTypeId: Number(serviceTypeId),
            quantity: qty,
        });
    };

    if (!companyId) {
        return (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-slate-300">
                Aucune entreprise sélectionnée.
            </div>
        );
    }

    if (permsLoading || !permsReady) {
        return (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-slate-300">
                Chargement des droits…
            </div>
        );
    }

    if (!canAccess || !canCreateRendered) {
        return (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <h1 className="text-xl font-semibold text-white">Nouvelle prestation</h1>
                <p className="mt-2 text-sm text-slate-400">
                    Permission manquante :{" "}
                    <span className="text-slate-200">PARTENARIAT.SERVICE_RENDERED.CREATE</span>.
                </p>
                <div className="mt-4">
                    <Link
                        to={`/dashboard/partners/${partnerId}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700"
                    >
                        <ArrowLeft size={18} />
                        Retour
                    </Link>
                </div>
            </div>
        );
    }

    if (!partner) return <div className="p-6 text-red-300">Partenaire introuvable.</div>;

    return (
        <div className="space-y-6 text-white">
            <div className="flex items-center gap-3">
                <Link
                    to={`/dashboard/partners/${partnerId}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700"
                >
                    <ArrowLeft size={18} />
                    Retour
                </Link>

                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">Nouvelle prestation</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Partenaire — <span className="text-slate-200">{partner.name}</span>
                    </p>
                </div>
            </div>

            <form
                onSubmit={handleSubmit}
                className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 max-w-xl space-y-5"
            >
                <div className="space-y-2">
                    <label className="text-sm text-slate-300">Service rendu</label>
                    <select
                        className="w-full bg-slate-950/40 border border-slate-800 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        value={serviceTypeId}
                        onChange={(e) => setServiceTypeId(e.target.value)}
                        disabled={!canListTypes}
                    >
                        <option value="">
                            {canListTypes ? "Sélectionner…" : "Accès aux services indisponible"}
                        </option>
                        {services.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name} — {s.partnerPrice} $
                            </option>
                        ))}
                    </select>

                    {!canListTypes && (
                        <p className="text-xs text-slate-400">
                            Permission manquante : <span className="text-slate-200">PARTENARIAT.SERVICE_TYPE.LIST</span>.
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-sm text-slate-300">Quantité</label>
                    <input
                        type="number"
                        min={1}
                        className="w-full bg-slate-950/40 border border-slate-800 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                    />
                </div>

                <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="w-full rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    Enregistrer
                </button>
            </form>
        </div>
    );
};

export default ServiceRenderedCreatePage;
