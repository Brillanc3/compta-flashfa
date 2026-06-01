// /frontend/src/pages/contracts/ContractTemplatesPage.jsx

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";

import Spinner from "@/components/ui/Spinner";
import { FileText, Plus, Edit3 } from "lucide-react";
import ContractTemplateEditor from "./ContractTemplateEditor";

/* ============================================================================
   PAGE DE GESTION DES TEMPLATES DE CONTRATS — THEME GLASS UI PREMIUM
============================================================================ */

export default function ContractTemplatesPage() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);

    // Mobile UX: éviter d'afficher liste + éditeur en même temps.
    const [mobileShowList, setMobileShowList] = useState(true);

    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("ALL");

    const editorAnchorRef = useRef(null);

    /* ---------------------------------------------------------
       📨 CHARGEMENT DES TEMPLATES
    --------------------------------------------------------- */
    const loadTemplates = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get("/contracts/templates");
            setTemplates(res.data);

            if (res.data.length === 0) {
                toast("Nouveau modèle créé ✨", { icon: "✨" });
                setSelectedId("new");
            }
        } catch {
            toast.error("Impossible de charger les templates.");
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    const handleTemplateSaved = (saved) => {
        loadTemplates();
        setSelectedId(saved.id);
    };

    const templateTypes = useMemo(() => {
        const set = new Set((templates || []).map((t) => String(t?.type || "").trim()).filter(Boolean));
        return ["ALL", ...Array.from(set).sort()];
    }, [templates]);

    const filteredTemplates = useMemo(() => {
        const q = String(search || "").trim().toLowerCase();
        return (templates || []).filter((tpl) => {
            if (typeFilter !== "ALL" && tpl.type !== typeFilter) return false;
            if (!q) return true;
            const hay = `${tpl?.title || ""} ${tpl?.type || ""}`.toLowerCase();
            return hay.includes(q);
        });
    }, [templates, search, typeFilter]);

    const selectTemplate = (id) => {
        setSelectedId(id);
        setMobileShowList(false);

        requestAnimationFrame(() => {
            editorAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    };

    /* ---------------------------------------------------------
       LOADING SPINNER
    --------------------------------------------------------- */
    if (loading) {
        return (
            <div className="py-20 flex justify-center">
                <Spinner />
            </div>
        );
    }

    /* ---------------------------------------------------------
       🎨 STYLES GLASS UI
    --------------------------------------------------------- */
    const glassCard =
        "rounded-xl p-6 bg-gradient-to-br from-slate-900/60 via-slate-800/40 to-slate-900/60 " +
        "border border-slate-700/50 backdrop-blur-xl shadow-2xl relative overflow-hidden";

    const halo =
        "pointer-events-none absolute inset-0 opacity-20 mix-blend-soft-light " +
        "[background:radial-gradient(circle_at_top_left,rgba(99,102,241,0.25),transparent_55%)," +
        "radial-gradient(circle_at_bottom_right,rgba(8,47,73,0.35),transparent_55%)]";

    /* ---------------------------------------------------------
       RENDER
    --------------------------------------------------------- */
    return (
        <div className="space-y-10 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">

            {/* ------------------------------------------------------------------ */}
            {/* HEADER */}
            {/* ------------------------------------------------------------------ */}
            <div className={glassCard}>
                <div className={halo} />

                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 relative">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                        <FileText size={28} className="text-indigo-400" />
                        Modèles de Contrats
                    </h1>

                    <button
                        onClick={() => selectTemplate("new")}
                        className="
                            px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
                            text-white font-semibold active:scale-95 transition flex items-center gap-2
                            w-full sm:w-auto justify-center
                        "
                    >
                        <Plus size={18} />
                        Nouveau Template
                    </button>
                </div>

                {/* Recherche / filtre */}
                <div className="relative mt-4 flex flex-col sm:flex-row gap-3">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un template..."
                        className="w-full sm:flex-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 focus:border-indigo-400 outline-none"
                    />

                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="w-full sm:w-56 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 focus:border-indigo-400 outline-none"
                    >
                        {templateTypes.map((t) => (
                            <option key={t} value={t}>
                                {t === "ALL" ? "Tous les types" : t}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={() => {
                            setSearch("");
                            setTypeFilter("ALL");
                        }}
                        className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-800/70 hover:bg-slate-700/70 text-slate-200 text-sm active:scale-95 transition"
                    >
                        Réinitialiser
                    </button>
                </div>

                {/* Toggle liste / éditeur (mobile) */}
                {selectedId && (
                    <div className="mt-4 md:hidden">
                        <button
                            type="button"
                            onClick={() => setMobileShowList((v) => !v)}
                            className="w-full px-4 py-2 rounded-lg bg-slate-800/70 hover:bg-slate-700/70 text-slate-200 text-sm active:scale-95 transition"
                        >
                            {mobileShowList ? "Masquer la liste" : "Afficher la liste"}
                        </button>
                    </div>
                )}
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* LISTE DES MODELES */}
            {/* ------------------------------------------------------------------ */}
            <div className={`${glassCard} ${selectedId && !mobileShowList ? "hidden md:block" : ""}`}>
                <div className={halo} />

                <h2 className="text-xl font-semibold text-slate-200 mb-4">
                    Templates Actuels ({filteredTemplates.length})
                </h2>

                {filteredTemplates.length === 0 ? (
                    <p className="text-slate-400">Aucun modèle disponible.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

                        {filteredTemplates.map((tpl) => {
                            const isActive = selectedId === tpl.id;

                            return (
                                <div
                                    key={tpl.id}
                                    onClick={() => selectTemplate(tpl.id)}
                                    className={`
                                        cursor-pointer rounded-xl p-5 transition relative overflow-hidden
                                        bg-slate-900/50 border backdrop-blur-xl shadow-xl

                                        ${
                                        isActive
                                            ? "border-indigo-500 ring-2 ring-indigo-400/40"
                                            : "border-slate-700 hover:border-indigo-400/60 hover:bg-slate-800/60"
                                    }
                                    `}
                                >
                                    <div className={halo} />

                                    <div className="relative">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-semibold text-white break-words">
                                                {tpl.title}
                                            </h3>

                                            <Edit3
                                                size={18}
                                                className="text-indigo-300 opacity-80"
                                            />
                                        </div>

                                        <p className="text-slate-400 text-sm mt-2">
                                            Type : {tpl.type}
                                        </p>

                                        <p className="text-slate-500 text-xs mt-1">
                                            {tpl.articles?.length ?? 0} articles
                                        </p>
                                    </div>
                                </div>
                            );
                        })}

                    </div>
                )}
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* SECTION EDITEUR */}
            {/* ------------------------------------------------------------------ */}
            {selectedId && (
                <div className={glassCard}>
                    <div className={halo} />

                    <div ref={editorAnchorRef} />

                    <ContractTemplateEditor
                        key={selectedId}
                        templateId={selectedId}
                        onTemplateSaved={handleTemplateSaved}
                    />
                </div>
            )}
        </div>
    );
}
