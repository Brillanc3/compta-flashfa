import React, { useState } from 'react';
import {
    getAllFidelityTemplates,
    createCardForClient,
    addStampToCard,
} from '@/services/clientsService';

import toast from 'react-hot-toast';
import { useHasPermission } from '@/hooks/useHasPermission';

import {
    PlusCircle,
    Copy,
    BadgeCheck,
    Stamp,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';

const ClientFidelityCardManager = ({ client, companyId, onRefresh }) => {
    const canManage = useHasPermission(`COMPANY.${companyId}.FIDELITY.MANAGE`);
    const canStamp  = useHasPermission(`COMPANY.${companyId}.FIDELITY.CLIENTS.STAMPED`);

    const [expanded, setExpanded] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [creating, setCreating] = useState(false);

    const loadTemplates = async () => {
        try {
            setLoadingTemplates(true);
            const tpls = await getAllFidelityTemplates(companyId);
            setTemplates(tpls);
        } catch {
            toast.error("Impossible de récupérer les modèles.");
        }
        setLoadingTemplates(false);
    };

    const createCard = async (templateId) => {
        try {
            setCreating(true);
            await createCardForClient(companyId, client.id, templateId);
            toast.success("Carte créée !");
            setExpanded(false);
            onRefresh();
        } catch (err) {
            toast.error(err.message || "Erreur lors de la création.");
        }
        setCreating(false);
    };

    const handleAddStamp = async (card) => {
        try {
            const result = await addStampToCard(companyId, card.publicLink);

            if (result.isFull) {
                toast(`Carte complète (${result.stampCount}/${result.maxStamps})`, {
                    icon: "🏁",
                });
            } else {
                toast.success(`Tampon ajouté (${result.stampCount}/${result.maxStamps})`);
            }

            onRefresh();
        } catch {
            toast.error("Impossible d'ajouter un tampon.");
        }
    };

    const copyLink = (publicLink) => {
        const url = `${window.location.origin}/api/fidelity/view/${publicLink}`;
        navigator.clipboard.writeText(url);
        toast.success("Lien copié !");
    };

    // Aucune permission → rien à afficher
    if (!canManage && !canStamp) return null;

    const hasCards = client.cards?.length > 0;

    return (
        <div className="bg-cca-surface/40 backdrop-blur-xl border border-cca-border rounded-2xl p-6 shadow-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* HEADER */}
            <div className="flex justify-between items-center group cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-brand-primary/10 text-brand-primary shadow-inner">
                        <Stamp size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black font-heading tracking-tight text-cca-textPrimary">
                            Programme de Fidélité
                        </h2>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cca-textSecondary/50">Gestion des récompenses client</p>
                    </div>
                </div>

                <div className="p-2 rounded-full hover:bg-cca-base transition-colors">
                    {expanded ? (
                        <ChevronUp className="text-cca-textSecondary" size={24} />
                    ) : (
                        <ChevronDown className="text-cca-textSecondary" size={24} />
                    )}
                </div>
            </div>

            {/* COLLAPSIBLE CONTENT */}
            {expanded && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-500 space-y-6">

                    {/* Existing Cards */}
                    {hasCards ? (
                        <div className="space-y-6">
                            {client.cards.map((card) => {
                                const max = card.template?.stampZones?.length || 0;
                                const count = card.stampCount;
                                const isFull = count >= max;

                                return (
                                    <div
                                        key={card.id}
                                        className="bg-cca-base/40 border border-cca-border rounded-2xl p-5 shadow-inner space-y-5 relative overflow-hidden"
                                    >
                                        {isFull && (
                                            <div className="absolute top-0 right-0 p-1 bg-amber-500/10 text-amber-500 border-l border-b border-amber-500/20 rounded-bl-xl">
                                                <BadgeCheck size={16} />
                                            </div>
                                        )}

                                        {/* Card Header */}
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm font-bold text-cca-textPrimary uppercase tracking-wider">
                                                {card.template?.name}
                                            </p>

                                            <span className={`
                                                px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border
                                                ${card.status === "COMPLETED"
                                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                : "bg-cca-surface text-cca-textSecondary border-cca-border"}
                                            `}>
                                                {card.status}
                                            </span>
                                        </div>

                                        {/* Stamps progression */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/50 mb-1">Progression</p>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-2xl font-black text-cca-textPrimary">{count}</span>
                                                        <span className="text-sm font-bold text-cca-textSecondary/40">/ {max}</span>
                                                    </div>
                                                </div>

                                                {canStamp && (
                                                    <button
                                                        disabled={creating || isFull}
                                                        onClick={() => handleAddStamp(card)}
                                                        className="p-3 bg-brand-primary hover:bg-brand-dark text-white rounded-2xl shadow-lg shadow-brand-primary/20 disabled:bg-cca-border disabled:shadow-none disabled:text-cca-textSecondary/40 transition-all active:scale-95 animate-in zoom-in duration-300"
                                                        title="Ajouter un tampon"
                                                    >
                                                        <PlusCircle size={20} strokeWidth={2.5} />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Progress bar */}
                                            <div className="w-full bg-cca-base h-2.5 rounded-full overflow-hidden border border-cca-border/50">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-dark transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(var(--brand-primary-rgb),0.4)]"
                                                    style={{ width: `${(count / max) * 100}%` }}
                                                />
                                            </div>

                                            {isFull && (
                                                <p className="text-amber-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 animate-pulse bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                                                    ✨ Cette carte est prête à être consommée
                                                </p>
                                            )}
                                        </div>

                                        {/* Public Link */}
                                        <div className="pt-4 border-t border-cca-border/30">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/50 mb-2">Lien de la carte</p>
                                            <button
                                                onClick={() => copyLink(card.publicLink)}
                                                className="flex items-center gap-2 px-4 py-2 bg-cca-surface hover:bg-cca-base border border-cca-border rounded-xl text-xs font-bold text-cca-textSecondary transition-all active:scale-95 group"
                                            >
                                                <Copy size={14} className="group-hover:text-brand-primary transition-colors" /> Copier le lien
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-8 bg-cca-base/20 border border-dashed border-cca-border rounded-2xl flex flex-col items-center justify-center gap-3">
                            <Stamp size={32} className="text-cca-textSecondary/20" />
                            <p className="text-sm font-bold text-cca-textSecondary/40 uppercase tracking-widest text-center">
                                Aucune carte active
                            </p>
                        </div>
                    )}

                    {/* Create New Card */}
                    {canManage && (
                        <div className="pt-6 border-t border-cca-border">

                            <button
                                onClick={async () => {
                                    if (templates.length === 0) await loadTemplates();
                                    setExpanded("create");
                                }}
                                className="w-full py-3.5 bg-cca-base hover:bg-cca-surface border border-cca-border text-cca-textPrimary rounded-2xl flex items-center justify-center gap-3 font-bold text-sm transition-all active:scale-95 shadow-sm"
                            >
                                <PlusCircle size={20} className="text-brand-primary" /> Nouveau modèle de carte
                            </button>

                            {/* TEMPLATE SELECTION */}
                            {expanded === "create" && (
                                <div className="mt-4 p-4 bg-cca-base/60 backdrop-blur border border-cca-border rounded-2xl space-y-3 animate-in slide-in-from-top-4 duration-500 shadow-xl">

                                    <p className="text-[10px] font-bold uppercase tracking-widest text-cca-textSecondary/60 ml-1">Sélectionnez un programme</p>

                                    {loadingTemplates ? (
                                        <div className="flex items-center justify-center py-4">
                                            <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-2">
                                            {templates.map((tpl) => (
                                                <button
                                                    key={tpl.id}
                                                    disabled={creating}
                                                    onClick={() => createCard(tpl.id)}
                                                    className="w-full px-4 py-3 text-left bg-cca-surface hover:bg-brand-primary/5 border border-cca-border hover:border-brand-primary/30 text-cca-textPrimary rounded-xl flex justify-between items-center transition-all group"
                                                >
                                                    <span className="font-bold text-sm tracking-tight">{tpl.name}</span>
                                                    <div className="p-1.5 rounded-lg bg-cca-base text-cca-textSecondary group-hover:text-brand-primary transition-colors">
                                                        <PlusCircle size={16} />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClientFidelityCardManager;
