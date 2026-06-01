// frontend/src/pages/contracts/CompanyContractAssignPage.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import Spinner from "@/components/ui/Spinner";
import A4Preview from "@/components/contracts/A4Preview";
import CopyRenderedHtmlButton from "@/components/contracts/CopyRenderedHtmlButton.jsx";
import { useCompany } from "@/contexts/CompanyContext";

import {
    assignContract,
    getContractTemplates,
    getContractTemplateById
} from "@/services/contractService";

import apiClient from "@/services/api";

/* ============================================================================
   PAGE ENTREPRISE — Assignation de contrat
============================================================================ */

const FIELD_TYPE_INPUT = {
    TEXT: "text",
    NUMBER: "number",
    DATE: "date",
    PRICE: "number"
};

function replaceAllKeys(markdown, values) {
    let md = markdown || "";
    Object.entries(values || {}).forEach(([key, value]) => {
        const safe = value ?? "";
        const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
        md = md.replace(re, safe);
    });
    return md;
}

export default function CompanyContractAssignPage() {
    const { activeCompany, activeCompanyId } = useCompany();

    const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [fieldValues, setFieldValues] = useState({});

    /* ======================================================================
       LOAD EMPLOYEES
    ====================================================================== */
    const { data: employees, isLoading: loadingEmployees } = useQuery({
        queryKey: ["companyEmployeesForContract", activeCompanyId],
        enabled: !!activeCompanyId,
        queryFn: async () => {
            const res = await apiClient.get("/employees", {
                params: { companyId: activeCompanyId }
            });
            return res.data;
        }
    });

    /* ======================================================================
       LOAD TEMPLATES
    ====================================================================== */
    const { data: templates, isLoading: loadingTemplates } = useQuery({
        queryKey: ["companyContractTemplates", activeCompanyId],
        enabled: !!activeCompanyId,
        queryFn: async () => {
            const list = await getContractTemplates();
            return list.filter((t) => t.type === "COMPANY");
        }
    });

    /* ======================================================================
       LOAD TEMPLATE DETAILS
    ====================================================================== */
    const { data: templateDetails, isLoading: _loadingTemplate } = useQuery({
        queryKey: ["companyContractTemplateDetails", selectedTemplateId],
        enabled: !!selectedTemplateId,
        queryFn: async () => getContractTemplateById(selectedTemplateId)
    });

    /* ======================================================================
       INIT FIELDS
    ====================================================================== */
    useEffect(() => {
        if (!templateDetails?.fields) {
            setFieldValues({});
            return;
        }

        const defaults = {};
        templateDetails.fields.forEach((f) => {
            defaults[f.key] = "";
        });
        setFieldValues(defaults);
    }, [templateDetails]);

    /* ======================================================================
       FINAL MARKDOWN (content + articles + fields)
    ====================================================================== */
    const renderedContent = useMemo(() => {
        if (!templateDetails) return "";

        let md = templateDetails.content || "";

        // Articles
        if (templateDetails.articles?.length) {
            const articlesMd = templateDetails.articles
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((a, index) => {
                    const title = (a.title || "").replace(
                        /\{\{article_number\}\}/g,
                        index + 1
                    );
                    return `${title}\n\n${a.body || ""}`;
                })
                .join("\n\n");

            if (md.includes("{{articles}}")) {
                md = md.replace("{{articles}}", articlesMd);
            } else {
                md += `\n\n${articlesMd}`;
            }
        } else {
            md = md.replace("{{articles}}", "");
        }

        // Fields replacement
        md = replaceAllKeys(md, fieldValues);

        return md.trim();
    }, [templateDetails, fieldValues]);

    /* ======================================================================
       ASSIGN CONTRACT
    ====================================================================== */
    const assignMutation = useMutation({
        mutationFn: async () => {
            if (!activeCompanyId) throw new Error("Aucune entreprise active.");
            if (!selectedEmployeeId) throw new Error("Employé requis.");
            if (!selectedTemplateId) throw new Error("Template requis.");

            return assignContract({
                assignedToUserId: Number(selectedEmployeeId),
                templateId: Number(selectedTemplateId),
                fieldValues,
                modifiesCompanyId: activeCompanyId
            });
        },
        onSuccess: () => toast.success("Contrat assigné avec succès."),
        onError: (err) =>
            toast.error(err?.message || err?.error || "Erreur lors de l’assignation")
    });

    /* ======================================================================
       LOADING
    ====================================================================== */
    if (!activeCompany)
        return <p className="text-white">Aucune entreprise active.</p>;

    if (loadingEmployees || loadingTemplates)
        return (
            <div className="flex justify-center mt-10">
                <Spinner />
            </div>
        );

    /* ======================================================================
       RENDER
    ====================================================================== */
    return (
        <div className="space-y-6 p-6">
            <h1 className="text-3xl font-bold text-white">
                Assigner un contrat — {activeCompany.name}
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* ===================== FORM ===================== */}
                <div className="p-6 rounded-xl bg-slate-900/70 border border-slate-700/60 backdrop-blur-xl shadow-2xl space-y-4">

                    {/* EMPLOYEE */}
                    <div>
                        <label className="text-sm text-slate-300">Employé</label>
                        <select
                            className="w-full mt-1 px-3 py-2 rounded bg-slate-900 text-slate-200 border border-slate-700"
                            value={selectedEmployeeId}
                            onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        >
                            <option value="">Choisir…</option>
                            {employees?.map((emp) => (
                                <option key={emp.id} value={emp.userId || emp.id}>
                                    {emp.user?.name || emp.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* TEMPLATE */}
                    <div>
                        <label className="text-sm text-slate-300">Template</label>
                        <select
                            className="w-full mt-1 px-3 py-2 rounded bg-slate-900 text-slate-200 border border-slate-700"
                            value={selectedTemplateId}
                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                        >
                            <option value="">Choisir…</option>
                            {templates?.map((tpl) => (
                                <option key={tpl.id} value={tpl.id}>
                                    {tpl.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* FIELDS */}
                    {templateDetails?.fields?.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-lg font-semibold text-white">
                                Champs dynamiques
                            </h2>

                            {templateDetails.fields
                                .slice()
                                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                                .map((field) => (
                                    <div key={field.id}>
                                        <label className="text-sm text-slate-300">
                                            {field.label}
                                        </label>

                                        <input
                                            type={FIELD_TYPE_INPUT[field.fieldType] || "text"}
                                            className="w-full mt-1 px-3 py-2 rounded bg-slate-900 text-slate-200 border border-slate-700"
                                            value={fieldValues[field.key] || ""}
                                            onChange={(e) =>
                                                setFieldValues((prev) => ({
                                                    ...prev,
                                                    [field.key]: e.target.value
                                                }))
                                            }
                                        />
                                    </div>
                                ))}
                        </div>
                    )}

                    {/* SUBMIT */}
                    <button
                        onClick={() => assignMutation.mutate()}
                        disabled={assignMutation.isPending}
                        className="mt-4 w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50"
                    >
                        Assigner le contrat
                    </button>
                </div>

                {/* ===================== PREVIEW ===================== */}
                <div className="p-6 rounded-xl bg-slate-900/70 border border-slate-700 shadow-xl">

                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xl font-semibold text-slate-200">
                            Aperçu A4
                        </h2>

                        <CopyRenderedHtmlButton markdown={renderedContent} />
                    </div>

                    {selectedTemplateId ? (
                        <A4Preview
                            markdown={renderedContent}
                            backgroundImageUrl={
                                templateDetails?.backgroundImageUrl || ""
                            }
                        />
                    ) : (
                        <p className="text-slate-400 mt-10">
                            Sélectionnez un template…
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
