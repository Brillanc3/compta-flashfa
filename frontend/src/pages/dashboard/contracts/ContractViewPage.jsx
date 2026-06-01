import React, { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import Spinner from "@/components/ui/Spinner";
import MarkdownPreview from "@/components/MarkdownPreview";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/* --------------------------------------------------------------
   STATUS STYLES
-------------------------------------------------------------- */
const statusStyle = {
    PENDING:  "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40",
    SIGNED:   "bg-green-500/20 text-green-300 border border-green-500/40",
    REJECTED: "bg-red-500/20 text-red-300 border border-red-500/40",
    CANCELED: "bg-gray-500/20 text-gray-300 border border-gray-500/40",
};


export default function ContractViewPage() {
    const { assignedContractId } = useParams();

    /* --------------------------------------------------------------
       LOAD CONTRACT
    -------------------------------------------------------------- */
    const { data: contract, isLoading } = useQuery({
        queryKey: ["assignedContract", assignedContractId],
        queryFn: async () => {
            const res = await api.get(`/contracts/assigned/${assignedContractId}`);
            return res.data;
        }
    });

    /* --------------------------------------------------------------
       BUILD FINAL MARKDOWN WITH FIELD VALUES
    -------------------------------------------------------------- */
    const renderedContent = useMemo(() => {
        if (!contract) return "";

        let out = contract.template.content;

        if (contract.fieldValues) {
            Object.entries(contract.fieldValues).forEach(([key, value]) => {
                const token = `{{${key}}}`;
                out = out.replaceAll(token, value || "");
            });
        }

        return out;
    }, [contract]);

    /* --------------------------------------------------------------
       LOADING
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

    /* --------------------------------------------------------------
       CONTRACT INFO
    -------------------------------------------------------------- */
    return (
        <div className="space-y-6 p-4">

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

                <div className="relative">

                    <h1 className="text-3xl font-bold text-white flex items-center gap-4">
                        {contract.template.title}

                        <span
                            className={`
                                inline-flex w-fit max-w-full items-center whitespace-nowrap leading-none
                                text-xs px-3 py-1 rounded-full
                                ${statusStyle[contract.status]}
                            `}
                        >
                            {contract.status === "PENDING" && "En attente"}
                            {contract.status === "SIGNED" && "Signé"}
                            {contract.status === "REJECTED" && "Refusé"}
                            {contract.status === "CANCELED" && "Annulé"}
                        </span>
                    </h1>

                    <div className="mt-4 text-slate-300 space-y-1">
                        <p>
                            <span className="text-slate-400">Assigné à :</span>{" "}
                            {contract.assignedToUser?.name}
                        </p>

                        <p>
                            <span className="text-slate-400">Assigné le :</span>{" "}
                            {format(new Date(contract.assignedAt), "d MMM yyyy HH:mm", { locale: fr })}
                        </p>

                        {contract.signature && (
                            <p>
                                <span className="text-slate-400">Signé le :</span>{" "}
                                {format(new Date(contract.signature.signedAt), "d MMM yyyy HH:mm", { locale: fr })}
                            </p>
                        )}

                        {contract.status === "REJECTED" && contract.refusalReason && (
                            <p className="text-red-300">
                                ❌ Raison du refus : {contract.refusalReason}
                            </p>
                        )}
                    </div>

                </div>
            </div>

            {/* ===================== CONTENT ===================== */}
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

        </div>
    );
}
