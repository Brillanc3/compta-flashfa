import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import MarkdownPreview from "@/components/MarkdownPreview";
import Spinner from "@/components/ui/Spinner";
import toast from "react-hot-toast";

/* ============================================================================
   CONTRACT ASSIGN PAGE
   - Choix employé
   - Choix template
   - Remplissage champs dynamiques
   - Preview markdown final
   - Assignation
============================================================================ */

export default function ContractAssignPage() {

    /* ============================================
     * LOAD EMPLOYEES (company filtered automatically)
     * ============================================ */
    const { data: employees, isLoading: loadingEmployees } = useQuery({
        queryKey: ["employeesForContract"],
        queryFn: async () => {
            const res = await api.get("/employees"); // ton endpoint interne employees
            return res.data;
        }
    });

    /* ============================================
     * LOAD TEMPLATES
     * ============================================ */
    const { data: templates, isLoading: loadingTemplates } = useQuery({
        queryKey: ["contractTemplatesForAssign"],
        queryFn: async () => {
            const res = await api.get("/contracts/templates");
            return res.data;
        }
    });

    const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState("");

    /* ============================================
     * LOAD TEMPLATE DETAILS WHEN SELECTED
     * ============================================ */
    const { data: templateDetails } = useQuery({
        queryKey: ["contractTemplateDetailsAssign", selectedTemplateId],
        enabled: !!selectedTemplateId,
        queryFn: async () => {
            const res = await api.get(`/contracts/templates/${selectedTemplateId}`);
            return res.data;
        }
    });

    const [fieldValues, setFieldValues] = useState({});

    useEffect(() => {
        if (templateDetails?.fields) {
            const defaults = {};
            templateDetails.fields.forEach(f => {
                defaults[f.key] = "";
            });
            setFieldValues(defaults);
        }
    }, [templateDetails]);

    /* ============================================
     * LIVE RENDER MARKDOWN WITH VARIABLES
     * ============================================ */
    const renderedContent = useMemo(() => {
        if (!templateDetails) return "";

        let out = templateDetails.content;

        Object.entries(fieldValues).forEach(([key, value]) => {
            const token = `{{${key}}}`;
            out = out.replaceAll(token, value || "");
        });

        return out;
    }, [templateDetails, fieldValues]);

    /* ============================================
     * ASSIGN CONTRACT MUTATION
     * ============================================ */
    const assignContract = useMutation({
        mutationFn: async () => {
            await api.post("/contracts/assign", {
                userId: parseInt(selectedEmployeeId),
                templateId: parseInt(selectedTemplateId),
                fieldValues
            });
        },
        onSuccess: () => {
            toast.success("Contrat assigné !");
        },
        onError: () => toast.error("Impossible d’assigner le contrat.")
    });

    /* ============================================
     * RENDER UI
     * ============================================ */

    return (
        <div className="space-y-6 p-4">
            <h1 className="text-3xl font-bold text-white">Assigner un contrat</h1>

            {/* ===================== LOADING ===================== */}
            {(loadingEmployees || loadingTemplates) ? (
                <div className="flex justify-center py-10">
                    <Spinner />
                </div>
            ) : (

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* =====================================================
                       LEFT PANEL – FORMULAIRE
                    ===================================================== */}
                    <div className="
                        relative p-6 rounded-xl
                        bg-gradient-to-br from-slate-900/70 via-slate-800/70 to-slate-900/70
                        border border-slate-700/60 backdrop-blur-xl shadow-2xl
                    ">
                        {/* H A L O */}
                        <div className="
                            pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light
                            [background:
                                radial-gradient(circle_at_top_left, rgba(99,102,241,0.18), transparent 55%),
                                radial-gradient(circle_at_bottom_right, rgba(8,47,73,0.40), transparent 55%)
                            ]
                        " />

                        <div className="relative space-y-6">

                            {/* EMPLOYEE SELECT */}
                            <div>
                                <label className="text-sm text-slate-300">
                                    Sélectionner un employé
                                </label>
                                <select
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    className="
                                        w-full mt-1 px-3 py-2 rounded-lg
                                        bg-slate-900/60 border border-slate-700
                                        text-slate-200 focus:border-indigo-400 outline-none
                                    "
                                >
                                    <option value="">Choisir...</option>
                                    {employees?.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.user?.name || emp.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* TEMPLATE SELECT */}
                            <div>
                                <label className="text-sm text-slate-300">
                                    Template
                                </label>
                                <select
                                    value={selectedTemplateId}
                                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                                    className="
                                        w-full mt-1 px-3 py-2 rounded-lg
                                        bg-slate-900/60 border border-slate-700
                                        text-slate-200 focus:border-indigo-400 outline-none
                                    "
                                >
                                    <option value="">Choisir un template...</option>
                                    {templates?.map(tpl => (
                                        <option key={tpl.id} value={tpl.id}>
                                            {tpl.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* FIELDS */}
                            {templateDetails?.fields?.length > 0 && (
                                <div className="space-y-4">
                                    <h2 className="text-lg font-semibold text-slate-200">
                                        Champs du contrat
                                    </h2>

                                    {templateDetails.fields.map(field => (
                                        <div key={field.id}>
                                            <label className="text-sm text-slate-300">
                                                {field.label}
                                            </label>
                                            <input
                                                value={fieldValues[field.key] || ""}
                                                onChange={(e) =>
                                                    setFieldValues(prev => ({
                                                        ...prev,
                                                        [field.key]: e.target.value
                                                    }))
                                                }
                                                className="
                                                    w-full mt-1 px-3 py-2 rounded-lg
                                                    bg-slate-900/60 border border-slate-700
                                                    text-slate-200 focus:border-indigo-400 outline-none
                                                "
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ASSIGN BUTTON */}
                            <button
                                onClick={() => {
                                    if (!selectedEmployeeId || !selectedTemplateId) {
                                        return toast.error("Sélectionnez un employé et un template.");
                                    }
                                    assignContract.mutate();
                                }}
                                className="
                                    w-full px-4 py-2 rounded-lg
                                    bg-indigo-600 hover:bg-indigo-500
                                    text-white active:scale-95 transition
                                "
                            >
                                📄 Assigner le contrat
                            </button>
                        </div>
                    </div>

                    {/* =====================================================
                       RIGHT PANEL – LIVE MARKDOWN PREVIEW
                    ===================================================== */}
                    <div className="
                        relative p-6 rounded-xl
                        bg-gradient-to-br from-slate-900/70 via-slate-800/70 to-slate-900/70
                        border border-slate-700/60 backdrop-blur-xl shadow-2xl h-fit
                    ">
                        {/* H A L O */}
                        <div className="
                            pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light
                            [background:
                                radial-gradient(circle_at_top_left, rgba(99,102,241,0.18), transparent 55%),
                                radial-gradient(circle_at_bottom_right, rgba(8,47,73,0.40), transparent 55%)
                            ]
                        " />

                        <h2 className="text-xl font-semibold text-slate-200 mb-4">
                            Aperçu du contrat
                        </h2>

                        <div className="
                            bg-slate-900/40 rounded-lg border border-slate-700 p-4
                            max-h-[70vh] overflow-y-auto
                        ">
                            {selectedTemplateId ? (
                                <MarkdownPreview>{renderedContent}</MarkdownPreview>
                            ) : (
                                <p className="text-slate-400">Choisissez un template…</p>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
