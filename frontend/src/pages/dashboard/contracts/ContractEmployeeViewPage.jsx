import React, { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import MarkdownPreview from "@/components/MarkdownPreview";
import Spinner from "@/components/ui/Spinner";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/* --------------------------------------------------------------
   STATUS BADGES
-------------------------------------------------------------- */
const statusStyle = {
    PENDING:  "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40",
    SIGNED:   "bg-green-500/20 text-green-300 border border-green-500/40",
    REJECTED: "bg-red-500/20 text-red-300 border border-red-500/40",
    CANCELED: "bg-gray-500/20 text-gray-300 border border-gray-500/40",
};

export default function ContractEmployeeViewPage() {
    const { assignedContractId } = useParams();
    const navigate = useNavigate();
    const [refusalMessage, setRefusalMessage] = useState("");

    const handleBack = () => {
        try {
            const idx = window.history?.state?.idx;
            if (typeof idx === "number" && idx > 0) {
                navigate(-1);
                return;
            }
        } catch (_) { /* intentional */ }
        navigate("/dashboard/profile");
    };

    /* --------------------------------------------------------------
       LOAD ASSIGNED CONTRACT
    -------------------------------------------------------------- */
    const { data: contract, isLoading, refetch } = useQuery({
        queryKey: ["employeeAssignedContract", assignedContractId],
        queryFn: async () => {
            const res = await api.get(`/contracts/assigned/${assignedContractId}`);
            return res.data;
        }
    });

    /* --------------------------------------------------------------
       GENERATE FINAL MARKDOWN
    -------------------------------------------------------------- */
    const renderedContent = useMemo(() => {
        if (!contract) return "";

        let out = contract.template.content;

        if (contract.fieldValues) {
            Object.entries(contract.fieldValues).forEach(([key, value]) => {
                out = out.replaceAll(`{{${key}}}`, value || "");
            });
        }

        return out;
    }, [contract]);

    /* --------------------------------------------------------------
       SIGN CONTRACT
    -------------------------------------------------------------- */
    const signMutation = useMutation({
        mutationFn: async () => {
            await api.post(`/contracts/assigned/${assignedContractId}/sign`, {
                confirmationText: "Signed through web interface"
            });
        },
        onSuccess: () => {
            toast.success("Contrat signé !");
            refetch();
        },
        onError: () => toast.error("Impossible de signer le contrat.")
    });

    /* --------------------------------------------------------------
       REJECT CONTRACT
    -------------------------------------------------------------- */
    const rejectMutation = useMutation({
        mutationFn: async () => {
            await api.post(`/contracts/assigned/${assignedContractId}/reject`, {
                reason: refusalMessage
            });
        },
        onSuccess: () => {
            toast.error("Contrat refusé.");
            refetch();
        },
        onError: () => toast.error("Impossible de refuser le contrat.")
    });

    /* --------------------------------------------------------------
       LOADING VIEW
    -------------------------------------------------------------- */
    if (isLoading) {
        return (
            <div className="p-10 flex justify-center">
                <Spinner />
            </div>
        );
    }

    if (!contract) {
        return (
            <div className="p-6 text-slate-300">
                Contrat introuvable.
            </div>
        );
    }

    const isSigned = contract.status === "SIGNED";
    const isRejected = contract.status === "REJECTED";

    const companyHint = (() => {
        const name = contract.modifiesCompanyNameSnapshot || contract.generatedCompanyNameSnapshot || null;
        if (name) return name;
        if (contract.modifiesCompanyId) return `#`;
        if (contract.generatedCompanyId) return `#`;
        return null;
    })();

    /* --------------------------------------------------------------
       UI RENDER
    -------------------------------------------------------------- */
    return (
        <div className="space-y-6 p-4">


            {/* ===================== NAV ===================== */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={handleBack}
                    className="
                        inline-flex items-center gap-2
                        px-3 py-2 rounded-lg
                        bg-slate-900/60 border border-slate-700
                        text-slate-200 hover:bg-slate-800/60
                        active:scale-95 transition
                    "
                >
                    <span aria-hidden>←</span>
                    <span>Retour</span>
                </button>
            </div>

            {/* ===================== HEADER ===================== */}
            <div className="
                relative overflow-hidden rounded-xl p-6
                bg-gradient-to-br from-slate-900/70 via-slate-800/70 to-slate-900/70
                border border-slate-700/60 backdrop-blur-xl shadow-2xl
            ">
                {/* Halo */}
                <div className="
                    pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light
                    [background:
                        radial-gradient(circle_at_top_left, rgba(99,102,241,0.18), transparent 55%),
                        radial-gradient(circle_at_bottom_right, rgba(8,47,73,0.40), transparent 55%)
                    ]
                " />

                <div className="relative space-y-3">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white flex flex-wrap items-center gap-3">
                        <span className="min-w-0 break-words">{contract.template.title}</span>

                        <span className={`
                            text-xs px-3 py-1 rounded-full inline-flex items-center whitespace-nowrap leading-none shrink-0
                            ${statusStyle[contract.status]}
                        `}>
                            {contract.status === "PENDING" && "En attente"}
                            {contract.status === "SIGNED" && "Signé"}
                            {contract.status === "REJECTED" && "Refusé"}
                            {contract.status === "CANCELED" && "Annulé"}
                        </span>
                    </h1>

                    <p className="text-slate-300">
                        Assigné le{" "}
                        {format(new Date(contract.assignedAt), "d MMM yyyy HH:mm", { locale: fr })}
                    </p>

                    {companyHint && (
                        <p className="text-slate-400 text-sm">Entreprise : <span className="text-slate-200">{companyHint}</span></p>
                    )}

                    {isSigned && (
                        <p className="text-green-300">
                            ✔ Vous avez signé ce contrat le{" "}
                            {format(new Date(contract.signature.signedAt), "d MMM yyyy HH:mm", { locale: fr })}
                        </p>
                    )}

                    {isRejected && (
                        <p className="text-red-300">
                            ❌ Vous avez refusé ce contrat.
                            {contract.refusalReason && (
                                <span className="text-slate-400">
                                    Raison : {contract.refusalReason}
                                </span>
                            )}
                        </p>
                    )}
                </div>
            </div>

            {/* ===================== CONTRACT BODY ===================== */}
            <div className="
                relative overflow-hidden rounded-xl p-6
                bg-gradient-to-br from-slate-900/70 via-slate-800/70 to-slate-900/70
                border border-slate-700/60 backdrop-blur-xl shadow-2xl
            ">
                {/* Halo */}
                <div className="
                    pointer-events-none absolute inset-0 opacity-20 mix-blend-soft-light
                    [background:
                        radial-gradient(circle_at_top_left, rgba(99,102,241,0.18), transparent 55%),
                        radial-gradient(circle_at_bottom_right, rgba(8,47,73,0.40), transparent 55%)
                    ]
                " />

                <div className="
                    bg-slate-900/40 rounded-lg border border-slate-700 p-4
                    max-h-[75vh] overflow-y-auto
                ">
                    <MarkdownPreview>{renderedContent}</MarkdownPreview>
                </div>
            </div>

            {/* ===================== ACTION BUTTONS ===================== */}
            {contract.status === "PENDING" && (
                <div className="flex flex-col lg:flex-row gap-4">

                    {/* SIGN BUTTON */}
                    <button
                        onClick={() => signMutation.mutate()}
                        className="
                            w-full lg:w-auto px-4 py-2 rounded-lg
                            bg-green-600 hover:bg-green-500 text-white
                            active:scale-95 transition shadow-lg
                        "
                    >
                        ✔ Signer le contrat
                    </button>

                    {/* REFUSE BUTTON */}
                    <button
                        className="
                            w-full lg:w-auto px-4 py-2 rounded-lg
                            bg-red-600 hover:bg-red-500 text-white
                            active:scale-95 transition shadow-lg
                        "
                        onClick={() => {
                            if (!refusalMessage.trim()) {
                                return toast.error("Veuillez indiquer une raison.");
                            }
                            rejectMutation.mutate();
                        }}
                    >
                        ❌ Refuser le contrat
                    </button>

                    {/* REFUSAL MESSAGE FIELD */}
                    <input
                        placeholder="Raison du refus (obligatoire)"
                        value={refusalMessage}
                        onChange={(e) => setRefusalMessage(e.target.value)}
                        className="
                            flex-1 px-3 py-2 rounded-lg
                            bg-slate-900/60 border border-slate-700
                            text-slate-200 focus:border-red-400 outline-none
                        "
                    />
                </div>
            )}
        </div>
    );
}
