import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FileText, Lock, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";

import Spinner from "@/components/ui/Spinner";
import A4Preview from "@/components/contracts/A4Preview.jsx";
import {
    accessPublicContractShare,
    getPublicContractShareMeta,
} from "@/services/contractService";

const statusMap = {
    PENDING: {
        text: "En attente",
        className: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30",
    },
    SIGNED: {
        text: "Signé",
        className: "bg-green-500/15 text-green-300 border border-green-500/30",
    },
    REJECTED: {
        text: "Refusé",
        className: "bg-red-500/15 text-red-300 border border-red-500/30",
    },
};

function StatusBadge({ status }) {
    const cfg = statusMap[status] || {
        text: status || "Inconnu",
        className: "bg-slate-700/50 text-slate-300 border border-slate-600/50",
    };

    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cfg.className}`}>
            {cfg.text}
        </span>
    );
}

export default function ContractShareViewerPage() {
    const { publicId } = useParams();

    const [meta, setMeta] = useState(null);
    const [share, setShare] = useState(null);

    const [password, setPassword] = useState("");
    const [metaLoading, setMetaLoading] = useState(true);
    const [accessLoading, setAccessLoading] = useState(false);
    const [error, setError] = useState("");

    const [selectedContractId, setSelectedContractId] = useState(null);

    const loadMeta = useCallback(async () => {
        try {
            setMetaLoading(true);
            setError("");

            const data = await getPublicContractShareMeta(publicId);
            setMeta(data);

            if (!data?.isPasswordProtected) {
                setAccessLoading(true);
                const accessData = await accessPublicContractShare({ publicId, password: "" });
                setShare(accessData);

                const firstContractId = accessData?.contracts?.[0]?.id || null;
                setSelectedContractId(firstContractId);
            }
        } catch (err) {
            const message =
                err?.error === "PARTAGE_PUBLIC_INTROUVABLE"
                    ? "Ce lien de partage est introuvable ou a été révoqué."
                    : "Impossible de charger ce lien de partage.";
            setError(message);
        } finally {
            setMetaLoading(false);
            setAccessLoading(false);
        }
    }, [publicId]);

    useEffect(() => {
        loadMeta();
    }, [loadMeta]);

    const submitPassword = async (e) => {
        e.preventDefault();

        try {
            setAccessLoading(true);
            setError("");

            const accessData = await accessPublicContractShare({
                publicId,
                password,
            });

            setShare(accessData);

            const firstContractId = accessData?.contracts?.[0]?.id || null;
            setSelectedContractId(firstContractId);
        } catch (err) {
            if (err?.error === "PARTAGE_PUBLIC_MOT_DE_PASSE_INVALIDE") {
                setError("Mot de passe invalide.");
                return;
            }

            if (err?.error === "PARTAGE_PUBLIC_MOT_DE_PASSE_REQUIS") {
                setError("Veuillez saisir le mot de passe.");
                return;
            }

            setError("Impossible de déverrouiller ce partage.");
            toast.error("Impossible de déverrouiller ce partage.");
        } finally {
            setAccessLoading(false);
        }
    };

    const selectedContract = useMemo(() => {
        if (!share?.contracts?.length || !selectedContractId) return null;
        return share.contracts.find((contract) => contract.id === selectedContractId) || null;
    }, [share, selectedContractId]);

    const previewContract = useMemo(() => {
        if (!selectedContract) return null;

        const hasSignedEvidence = Boolean(
            selectedContract.signature?.id || selectedContract.signature?.signedAt || selectedContract.signedAt
        );

        // En public, on reste strictement en lecture seule :
        // - pas de bloc pending interactif
        // - on affiche le bloc de signature uniquement si le contrat est réellement signé
        if (!hasSignedEvidence) {
            return null;
        }

        return {
            ...selectedContract,
            status: "SIGNED",
        };
    }, [selectedContract]);

    if (metaLoading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
                <div className="flex items-center gap-3 text-slate-200">
                    <Spinner />
                    <span>Chargement du partage…</span>
                </div>
            </div>
        );
    }

    if (error && !meta && !share) {
        return (
            <div className="min-h-screen bg-slate-950 text-white px-4 py-10">
                <div className="mx-auto max-w-2xl rounded-2xl border border-red-500/20 bg-slate-900/80 p-6 shadow-2xl">
                    <div className="flex items-start gap-3">
                        <ShieldAlert className="mt-0.5 h-5 w-5 text-red-400" />
                        <div>
                            <h1 className="text-xl font-semibold text-white">Lien indisponible</h1>
                            <p className="mt-2 text-sm text-slate-300">{error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (meta?.isPasswordProtected && !share) {
        return (
            <div className="min-h-screen bg-slate-950 text-white px-4 py-10">
                <div className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900/85 p-6 shadow-2xl">
                    <div className="flex items-center gap-3">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300">
                            <Lock className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold">Partage protégé</h1>
                            <p className="text-sm text-slate-400">
                                Ce lien contient {meta.contractCount} contrat{meta.contractCount > 1 ? "s" : ""}.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={submitPassword} className="mt-6 space-y-4">
                        <div>
                            <label className="mb-2 block text-sm text-slate-300">
                                Mot de passe
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400"
                                placeholder="Saisir le mot de passe"
                            />
                        </div>

                        {error ? (
                            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                                {error}
                            </div>
                        ) : null}

                        <button
                            type="submit"
                            disabled={accessLoading}
                            className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {accessLoading ? "Vérification…" : "Accéder aux contrats"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (accessLoading && !share) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
                <div className="flex items-center gap-3 text-slate-200">
                    <Spinner />
                    <span>Chargement des contrats…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white px-4 py-6">
            <div className="mx-auto max-w-7xl space-y-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold">Consultation de contrats</h1>
                            <p className="mt-1 text-sm text-slate-400">
                                Accès public en lecture seule.
                            </p>
                        </div>

                        <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300">
                            {share?.contractCount || share?.contracts?.length || meta?.contractCount || 0} contrat
                            {(share?.contractCount || share?.contracts?.length || meta?.contractCount || 0) > 1 ? "s" : ""}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
                    <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl">
                        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-200">
                            <FileText className="h-4 w-4 text-indigo-300" />
                            Contrats partagés
                        </div>

                        <div className="space-y-3">
                            {(share?.contracts || []).map((contract) => {
                                const isActive = contract.id === selectedContractId;

                                return (
                                    <button
                                        key={contract.id}
                                        type="button"
                                        onClick={() => setSelectedContractId(contract.id)}
                                        className={`w-full rounded-xl border p-4 text-left transition ${
                                            isActive
                                                ? "border-indigo-400/60 bg-indigo-500/10"
                                                : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-medium text-white">
                                                    {contract.snapshotTitle || "Contrat sans titre"}
                                                </div>
                                            </div>

                                            <StatusBadge status={contract.status} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl">
                        {!selectedContract ? (
                            <div className="flex min-h-[280px] items-center justify-center text-slate-400">
                                Aucun contrat à afficher.
                            </div>
                        ) : (
                            <>
                                <div className="mb-4 flex flex-col gap-3 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-white">
                                            {selectedContract.snapshotTitle || "Contrat"}
                                        </h2>
                                    </div>

                                    <StatusBadge status={selectedContract.status} />
                                </div>

                                <A4Preview
                                    contract={previewContract}
                                    markdown={selectedContract.snapshotMarkdown || ""}
                                    backgroundImageUrl={selectedContract.template?.backgroundImageUrl || ""}
                                />
                            </>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}