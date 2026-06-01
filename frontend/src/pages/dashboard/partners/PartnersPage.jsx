// frontend/src/pages/dashboard/partners/PartnersPage.jsx

import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/contexts/PermissionsContext";

import {
    getPartners,
    createPartner,
    deactivatePartner,
    activatePartner,
} from "@/services/partnershipService";

const PartnersPage = () => {
    const queryClient = useQueryClient();

    const { activeCompanyId, selectedCompany } = useCompany();
    const companyId = activeCompanyId ?? selectedCompany?.id ?? null;
    const companyName = selectedCompany?.name;

    const { isReady: permsReady, isLoading: permsLoading, has } = usePermissions();

    const canAccess = useMemo(() => permsReady && has("PARTENARIAT.ACCESS"), [permsReady, has]);
    const canList = useMemo(() => canAccess && has("PARTENARIAT.PARTNER.LIST"), [canAccess, has]);
    const canCreate = useMemo(() => canAccess && has("PARTENARIAT.PARTNER.CREATE"), [canAccess, has]);

    // Permission existante : on l’utilise pour activer/désactiver (toggle)
    const canToggleStatus = useMemo(
        () => canAccess && has("PARTENARIAT.PARTNER.DEACTIVATE"),
        [canAccess, has]
    );

    const [isCreating, setIsCreating] = useState(false);
    const [newPartnerName, setNewPartnerName] = useState("");

    // Backend: includeInactive = String(query.includeInactive || "false") === "true"
    const [includeInactive, setIncludeInactive] = useState(false);

    // Filtre d’affichage (client-side)
    // - si includeInactive=false, on force ACTIVE (sinon tu ne peux pas “voir” les inactifs de toute façon)
    const [statusFilter, setStatusFilter] = useState("ACTIVE"); // "ACTIVE" | "INACTIVE" | "ALL"

    const effectiveStatusFilter = includeInactive ? statusFilter : "ACTIVE";

    const createMutation = useMutation({
        mutationFn: createPartner,
        onSuccess: () => {
            toast.success("Partenaire créé");
            queryClient.invalidateQueries({ queryKey: ["partners", companyId, includeInactive] });
            setIsCreating(false);
            setNewPartnerName("");
        },
        onError: () => toast.error("Erreur lors de la création"),
    });

    const getIsActive = (partner) => {
        if (typeof partner?.isActive === "boolean") return partner.isActive;
        if (typeof partner?.active === "boolean") return partner.active;
        if (typeof partner?.enabled === "boolean") return partner.enabled;
        if (typeof partner?.isEnabled === "boolean") return partner.isEnabled;
        return true;
    };

    const {
        data: partnersRaw = [],
        isLoading,
        isError,
        error,
        isFetching,
    } = useQuery({
        queryKey: ["partners", companyId, includeInactive],
        queryFn: () => getPartners({ includeInactive }),
        enabled: Boolean(companyId) && permsReady && canList,
    });

    const partners = useMemo(() => {
        const list = Array.isArray(partnersRaw) ? partnersRaw : [];
        if (effectiveStatusFilter === "ALL") return list;

        const wantActive = effectiveStatusFilter === "ACTIVE";
        return list.filter((p) => getIsActive(p) === wantActive);
    }, [partnersRaw, effectiveStatusFilter]);

    const toggleStatusMutation = useMutation({
        mutationFn: async ({ partnerId, nextActive }) => {
            if (nextActive) return activatePartner(partnerId);
            return deactivatePartner(partnerId);
        },

        onMutate: async ({ partnerId, nextActive }) => {
            await queryClient.cancelQueries({ queryKey: ["partners", companyId, includeInactive] });

            const previous = queryClient.getQueryData(["partners", companyId, includeInactive]);

            queryClient.setQueryData(["partners", companyId, includeInactive], (old) => {
                const list = Array.isArray(old) ? old : [];
                return list.map((p) => {
                    if (p.id !== partnerId) return p;

                    return {
                        ...p,
                        isActive: typeof p.isActive === "boolean" ? nextActive : p.isActive,
                        active: typeof p.active === "boolean" ? nextActive : p.active,
                        enabled: typeof p.enabled === "boolean" ? nextActive : p.enabled,
                        isEnabled: typeof p.isEnabled === "boolean" ? nextActive : p.isEnabled,
                    };
                });
            });

            return { previous };
        },

        onError: (_err, _vars, ctx) => {
            if (ctx?.previous) {
                queryClient.setQueryData(["partners", companyId, includeInactive], ctx.previous);
            }
            toast.error("Impossible de mettre à jour le statut");
        },

        onSuccess: (_data, vars) => {
            toast.success(vars.nextActive ? "Partenaire activé" : "Partenaire désactivé");
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["partners", companyId, includeInactive] });
        },
    });

    const handleCreate = () => {
        const name = newPartnerName.trim();
        if (!name) return toast.error("Entrez un nom");
        createMutation.mutate({ name });
    };

    const handleToggleStatus = (partner) => {
        if (!canToggleStatus) return;

        const current = getIsActive(partner);
        const nextActive = !current;

        if (
            toggleStatusMutation.isPending &&
            toggleStatusMutation.variables?.partnerId === partner.id
        ) {
            return;
        }

        toggleStatusMutation.mutate({ partnerId: partner.id, nextActive });
    };

    const handleIncludeInactiveChange = (next) => {
        setIncludeInactive(next);
        if (!next) {
            // Si on repasse à false, on repasse en "ACTIVE" pour éviter un écran vide incohérent.
            setStatusFilter("ACTIVE");
        }
    };

    if (!companyId) {
        return (
            <div className="space-y-6">
                <div className="rounded-2xl border border-cca-border bg-cca-surface p-6">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-lg bg-cca-base p-2">
                            <Building2 size={18} className="text-cca-textPrimary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-cca-textPrimary">Partenaires</h1>
                            <p className="mt-1 text-sm text-cca-textSecondary">
                                Aucune entreprise sélectionnée. Sélectionnez une entreprise pour accéder au module.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (permsLoading || !permsReady) {
        return (
            <div className="rounded-2xl border border-cca-border bg-cca-surface p-6 text-cca-textSecondary">
                Chargement des droits…
            </div>
        );
    }

    if (!canAccess) {
        return (
            <div className="rounded-2xl border border-cca-border bg-cca-surface p-6">
                <h1 className="text-xl font-semibold text-cca-textPrimary">Partenaires</h1>
                <p className="mt-2 text-sm text-cca-textSecondary">
                    Accès refusé : permission requise{" "}
                    <span className="text-cca-textPrimary">PARTENARIAT.ACCESS</span>.
                </p>
            </div>
        );
    }

    if (!canList) {
        return (
            <div className="rounded-2xl border border-cca-border bg-cca-surface p-6">
                <h1 className="text-xl font-semibold text-cca-textPrimary">Partenaires</h1>
                <p className="mt-2 text-sm text-cca-textSecondary">
                    Accès refusé : permission requise{" "}
                    <span className="text-cca-textPrimary">PARTENARIAT.PARTNER.LIST</span>.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 text-cca-textPrimary">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Partenaires</h1>
                    <p className="mt-1 text-sm text-cca-textSecondary">
                        Gérez les partenaires liés à{" "}
                        <span className="text-cca-textPrimary font-medium">
              {companyName || `l’entreprise #${companyId}`}
            </span>
                        .
                    </p>
                </div>

                <div className="flex items-center gap-3 justify-end">
                    {canCreate && !isCreating && (
                        <button
                            onClick={() => setIsCreating(true)}
                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium shadow-sm shadow-indigo-900/30 transition hover:bg-indigo-500 active:scale-[0.99]"
                        >
                            <Plus size={18} />
                            Ajouter
                        </button>
                    )}
                </div>
            </div>

            {/* Contrôles d’affichage */}
            <div className="rounded-2xl border border-cca-border bg-cca-surface p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    {/* Toggle includeInactive (backend) */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            role="switch"
                            aria-checked={includeInactive}
                            onClick={() => handleIncludeInactiveChange(!includeInactive)}
                            disabled={isLoading || isFetching}
                            className={[
                                "relative inline-flex h-6 w-11 items-center rounded-full transition",
                                includeInactive ? "bg-indigo-600" : "bg-cca-border",
                                (isLoading || isFetching) ? "opacity-60 cursor-not-allowed" : "hover:opacity-95",
                            ].join(" ")}
                            title="Inclure les partenaires inactifs"
                        >
              <span
                  className={[
                      "inline-block h-5 w-5 transform rounded-full bg-white transition",
                      includeInactive ? "translate-x-5" : "translate-x-1",
                  ].join(" ")}
              />
                        </button>

                        <div className="min-w-0">
                            <div className="text-sm font-medium text-cca-textPrimary">Inclure les inactifs</div>
                            <div className="text-xs text-cca-textSecondary">
                                {includeInactive
                                    ? "Le backend renvoie aussi les partenaires inactifs."
                                    : "Le backend renvoie uniquement les partenaires actifs."}
                            </div>
                        </div>
                    </div>

                    {/* Filtre client-side */}
                    <div className="flex items-center gap-2 justify-end">
                        <div className="inline-flex rounded-lg bg-cca-base p-1">
                            <button
                                type="button"
                                onClick={() => setStatusFilter("ACTIVE")}
                                className={[
                                    "px-3 py-1.5 text-sm font-medium rounded-md transition",
                                    effectiveStatusFilter === "ACTIVE" ? "bg-cca-surface text-cca-textPrimary" : "text-cca-textSecondary hover:bg-cca-surface/60",
                                ].join(" ")}
                            >
                                Actifs
                            </button>

                            <button
                                type="button"
                                onClick={() => setStatusFilter("INACTIVE")}
                                disabled={!includeInactive}
                                className={[
                                    "px-3 py-1.5 text-sm font-medium rounded-md transition",
                                    effectiveStatusFilter === "INACTIVE" ? "bg-cca-surface text-cca-textPrimary" : "text-cca-textSecondary hover:bg-cca-surface/60",
                                    !includeInactive ? "opacity-50 cursor-not-allowed" : "",
                                ].join(" ")}
                                title={!includeInactive ? "Active “Inclure les inactifs” pour voir ce filtre" : ""}
                            >
                                Inactifs
                            </button>

                            <button
                                type="button"
                                onClick={() => setStatusFilter("ALL")}
                                disabled={!includeInactive}
                                className={[
                                    "px-3 py-1.5 text-sm font-medium rounded-md transition",
                                    effectiveStatusFilter === "ALL" ? "bg-cca-surface text-cca-textPrimary" : "text-cca-textSecondary hover:bg-cca-surface/60",
                                    !includeInactive ? "opacity-50 cursor-not-allowed" : "",
                                ].join(" ")}
                                title={!includeInactive ? "Active “Inclure les inactifs” pour voir ce filtre" : ""}
                            >
                                Tous
                            </button>
                        </div>

                        {isFetching && <span className="text-xs text-cca-textSecondary">Actualisation…</span>}
                    </div>
                </div>
            </div>

            {isCreating && canCreate && (
                <div className="rounded-2xl border border-cca-border bg-cca-surface p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end">
                        <div className="flex-1">
                            <label className="text-sm text-cca-textSecondary">Nom du partenaire</label>
                            <input
                                type="text"
                                value={newPartnerName}
                                onChange={(e) => setNewPartnerName(e.target.value)}
                                placeholder="Ex: Société ABC"
                                autoFocus
                                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                                className="mt-1 w-full rounded-lg border border-cca-border bg-cca-base px-3 py-2 text-sm text-cca-textPrimary outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleCreate}
                                disabled={createMutation.isPending}
                                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Créer
                            </button>
                            <button
                                onClick={() => {
                                    setIsCreating(false);
                                    setNewPartnerName("");
                                }}
                                className="rounded-lg bg-cca-base px-4 py-2 text-sm font-medium transition hover:bg-cca-surface"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-2xl border border-cca-border bg-cca-surface overflow-hidden">
                <div className="px-5 py-4 border-b border-cca-border">
                    <h2 className="text-base font-semibold text-cca-textPrimary">Liste</h2>
                    <p className="text-xs text-cca-textSecondary mt-0.5">
                        {canCreate || canToggleStatus ? "Gestion disponible selon vos droits." : "Accès lecture seule."}
                    </p>
                </div>

                {isLoading ? (
                    <div className="px-5 py-10 text-center text-cca-textSecondary">Chargement…</div>
                ) : isError ? (
                    <div className="px-5 py-10 text-center text-red-300">
                        Impossible de charger les partenaires.
                        <div className="mt-2 text-xs text-red-200/80">{String(error?.message || "")}</div>
                    </div>
                ) : partners.length === 0 ? (
                    <div className="px-5 py-10 text-center text-cca-textSecondary">
                        Aucun partenaire {effectiveStatusFilter === "ACTIVE" ? "actif" : effectiveStatusFilter === "INACTIVE" ? "inactif" : ""} pour le moment.
                    </div>
                ) : (
                    <div className="divide-y divide-cca-border">
                        {partners.map((p) => {
                            const isActive = getIsActive(p);
                            const isRowPending =
                                toggleStatusMutation.isPending &&
                                toggleStatusMutation.variables?.partnerId === p.id;

                            return (
                                <div
                                    key={p.id}
                                    className="flex flex-col gap-3 px-5 py-4 transition hover:bg-cca-base/40 md:flex-row md:items-center md:justify-between"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-3">
                                            <div className="font-medium text-cca-textPrimary truncate">{p.name}</div>

                                            <span
                                                className={[
                                                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                                    isActive ? "bg-emerald-600/20 text-emerald-600" : "bg-cca-base text-cca-textSecondary",
                                                ].join(" ")}
                                            >
                        {isActive ? "Actif" : "Inactif"}
                      </span>
                                        </div>

                                        <div className="text-xs text-cca-textSecondary mt-0.5">ID: {p.id}</div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 justify-end">
                                        {/* Switch activation/désactivation */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={isActive}
                                                onClick={() => handleToggleStatus(p)}
                                                disabled={!canToggleStatus || isRowPending}
                                                className={[
                                                    "relative inline-flex h-6 w-11 items-center rounded-full transition",
                                                    isActive ? "bg-emerald-600" : "bg-cca-border",
                                                    (!canToggleStatus || isRowPending) ? "opacity-60 cursor-not-allowed" : "hover:opacity-95",
                                                ].join(" ")}
                                                title={isActive ? "Cliquer pour désactiver" : "Cliquer pour activer"}
                                            >
                        <span
                            className={[
                                "inline-block h-5 w-5 transform rounded-full bg-white transition",
                                isActive ? "translate-x-5" : "translate-x-1",
                            ].join(" ")}
                        />
                                            </button>

                                            {isRowPending && (
                                                <span className="text-xs text-cca-textSecondary">Mise à jour…</span>
                                            )}
                                        </div>

                                        <Link
                                            to={`/dashboard/partners/${p.id}`}
                                            className="inline-flex items-center gap-2 rounded-lg bg-cca-base px-3 py-2 text-sm font-medium text-cca-textPrimary transition hover:bg-cca-border"
                                        >
                                            Ouvrir
                                            <ArrowRight size={16} />
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PartnersPage;
