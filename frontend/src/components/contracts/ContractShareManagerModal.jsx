import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import toast from "react-hot-toast";
import { Copy, Link2, Lock, RefreshCcw, ShieldCheck, Power, KeyRound, Trash2 } from "lucide-react";

import Modal from "@/components/Modal";
import Spinner from "@/components/ui/Spinner";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { copyText } from "@/utils/clipboard";
import {
    createContractShare,
    getContractShareById,
    regenerateContractShare,
    revokeContractShare,
    activateContractShare,
    updateContractSharePassword,
    deleteContractShare,
} from "@/services/contractService";

function buildAbsoluteShareUrl(publicPath) {
    if (!publicPath) return "";
    if (typeof window === "undefined") return publicPath;
    return `${window.location.origin}${publicPath}`;
}

export default function ContractShareManagerModal({
                                                      isOpen,
                                                      onClose,
                                                      assignedContractIds,
                                                      contractTitle,
                                                      initialShareId = null,
                                                      companyScoped = false,
                                                      onShareChange = null,
                                                  }) {
    const [password, setPassword] = useState("");
    const [share, setShare] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;

        async function loadInitialShare() {
            if (!initialShareId) {
                setShare(null);
                setPassword("");
                return;
            }

            try {
                setIsLoading(true);
                const data = await getContractShareById(initialShareId, { companyScoped });
                if (!isMounted) return;
                setShare(data);
                setPassword("");
            } catch {
                if (!isMounted) return;
                setShare(null);
                toast.error("Impossible de charger le partage existant.");
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        loadInitialShare();

        return () => {
            isMounted = false;
        };
    }, [isOpen, initialShareId, companyScoped]);

    const shareUrl = useMemo(() => {
        return buildAbsoluteShareUrl(share?.publicPath);
    }, [share]);

    const handleCreateShare = async () => {
        try {
            setIsSubmitting(true);

            const createdShare = await createContractShare(
                {
                    assignedContractIds,
                    password,
                },
                { companyScoped }
            );

            setShare(createdShare);
            setPassword("");
            onShareChange?.(createdShare);
            toast.success("Lien de partage créé.");
        } catch (err) {
            toast.error(err?.error || err?.message || "Impossible de créer le lien de partage.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyLink = async () => {
        if (!shareUrl) return;

        const result = await copyText(shareUrl);
        if (result?.ok) {
            toast.success("Lien copié.");
            return;
        }

        toast.error("Impossible de copier le lien.");
    };

    const handleRegenerate = async () => {
        if (!share?.id) return;

        try {
            setIsSubmitting(true);
            const updatedShare = await regenerateContractShare(share.id, { companyScoped });
            setShare(updatedShare);
            onShareChange?.(updatedShare);
            toast.success("Lien régénéré.");
        } catch (err) {
            toast.error(err?.error || err?.message || "Impossible de régénérer le lien.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleActive = async () => {
        if (!share?.id) return;

        try {
            setIsSubmitting(true);

            const updatedShare = share.isRevoked
                ? await activateContractShare(share.id, { companyScoped })
                : await revokeContractShare(share.id, { companyScoped });

            setShare(updatedShare);
            onShareChange?.(updatedShare);
            toast.success(share.isRevoked ? "Partage réactivé." : "Partage désactivé.");
        } catch (err) {
            toast.error(err?.error || err?.message || "Impossible de modifier le statut du partage.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSavePassword = async (nextPassword = password) => {
        if (!share?.id) return;

        try {
            setIsSubmitting(true);
            const updatedShare = await updateContractSharePassword(
                share.id,
                { password: nextPassword },
                { companyScoped }
            );
            setShare(updatedShare);
            setPassword("");
            onShareChange?.(updatedShare);
            toast.success(updatedShare.isPasswordProtected ? "Mot de passe enregistré." : "Mot de passe retiré.");
        } catch (err) {
            toast.error(err?.error || err?.message || "Impossible de modifier le mot de passe.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteShare = () => {
        if (!share?.id) return;

        setConfirmModal({
            isOpen: true,
            message: "Supprimer définitivement ce partage public ?",
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    setIsSubmitting(true);
                    await deleteContractShare(share.id, { companyScoped });
                    onShareChange?.(null, { deletedShareId: share.id });
                    setShare(null);
                    setPassword("");
                    toast.success("Partage supprimé.");
                    onClose();
                } catch (err) {
                    toast.error(err?.error || err?.message || "Impossible de supprimer le partage.");
                } finally {
                    setIsSubmitting(false);
                }
            },
        });
    };

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title="Gérer le partage public" showCloseButton>
            {isLoading ? (
                <div className="py-8 flex items-center justify-center gap-3 text-slate-300">
                    <Spinner />
                    <span>Chargement du partage…</span>
                </div>
            ) : (
                <div className="space-y-5 min-w-[320px] sm:min-w-[560px]">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="flex items-start gap-3">
                            <div className="rounded-full bg-indigo-500/15 p-2 text-indigo-300">
                                <Link2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-white">Contrat(s) concerné(s)</p>
                                <p className="mt-1 text-sm text-slate-400 break-words">
                                    {contractTitle || "Contrat"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {!share ? (
                        <>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
                                    <Lock className="h-4 w-4 text-slate-400" />
                                    Mot de passe optionnel à la création
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Laisser vide pour un accès sans mot de passe"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                                    autoComplete="new-password"
                                />
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleCreateShare}
                                    disabled={isSubmitting || !assignedContractIds?.length}
                                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isSubmitting ? <Spinner /> : <ShieldCheck className="h-4 w-4" />}
                                    Créer le lien public
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-200">Lien public</label>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <input
                                        type="text"
                                        readOnly
                                        value={shareUrl}
                                        className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCopyLink}
                                        disabled={!shareUrl || isSubmitting || !!share?.isRevoked}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Copy className="h-4 w-4" />
                                        Copier
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <span>Protection par mot de passe</span>
                                    <span className={share.isPasswordProtected ? "text-emerald-400" : "text-slate-400"}>
                                        {share.isPasswordProtected ? "Oui" : "Non"}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    <span>Statut</span>
                                    <span className={share.isRevoked ? "text-red-400" : "text-emerald-400"}>
                                        {share.isRevoked ? "Désactivé" : "Actif"}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    <span>Nombre de contrats</span>
                                    <span className="text-slate-200">{share.contracts?.length || 0}</span>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                                    <KeyRound className="h-4 w-4 text-slate-400" />
                                    Mot de passe du partage
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={share.isPasswordProtected ? "Nouveau mot de passe ou laisser vide pour retirer" : "Définir un mot de passe"}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                                    autoComplete="new-password"
                                />
                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => handleSavePassword("")}
                                        disabled={isSubmitting || !share.isPasswordProtected}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Retirer le mot de passe
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSavePassword}
                                        disabled={isSubmitting || (!password.trim() && !share.isPasswordProtected)}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Enregistrer le mot de passe
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={handleDeleteShare}
                                    disabled={isSubmitting}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Supprimer
                                </button>

                                <button
                                    type="button"
                                    onClick={handleToggleActive}
                                    disabled={isSubmitting}
                                    className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm ${share.isRevoked ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15" : "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15"} disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                    <Power className="h-4 w-4" />
                                    {share.isRevoked ? "Réactiver" : "Désactiver"}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleRegenerate}
                                    disabled={isSubmitting}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <RefreshCcw className="h-4 w-4" />
                                    Régénérer le lien
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </Modal>
        <ConfirmationModal
            isOpen={confirmModal.isOpen}
            onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
            onConfirm={confirmModal.onConfirm}
            message={confirmModal.message}
        />
        </>
    );
}

ContractShareManagerModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    assignedContractIds: PropTypes.arrayOf(PropTypes.number).isRequired,
    contractTitle: PropTypes.string,
    initialShareId: PropTypes.number,
    companyScoped: PropTypes.bool,
    onShareChange: PropTypes.func,
};
