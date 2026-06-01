import React, { useState, useEffect, useRef } from 'react';

import {
    getAllFidelityTemplates,
    setupFidelityTemplate,
    toggleFidelityTemplateActive,
} from '@/services/clientsService';

import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';

import {
    Edit3,
    Eye,
    Upload,
    Image as ImageIcon,
    PlusCircle,
    RefreshCcw,
    CheckCircle2,
    XCircle,
} from 'lucide-react';
import {useCompany} from "@/contexts/CompanyContext.jsx";


const FidelitySetupPage = () => {
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;

    // Templates
    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);

    // Editor
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [templateName, setTemplateName] = useState("");

    const [baseImage, setBaseImage] = useState({ file: null, preview: "", id: null });
    const [stampImage, setStampImage] = useState({ file: null, preview: "", id: null });

    const [stampZones, setStampZones] = useState([]);
    const [mode, setMode] = useState("edit");
    const [selectedZoneIndex, setSelectedZoneIndex] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const canvasRef = useRef(null);

    /* ---------------------------------------------------------
        LOAD ALL TEMPLATES + INITIAL MODEL
    --------------------------------------------------------- */
    useEffect(() => {
        const load = async () => {
            try {
                const all = await getAllFidelityTemplates(companyId);
                setTemplates(all);

                // Charger le modèle actif ou le premier disponible s'il y en a
                const active = all.find(t => t.isActive);
                if (active) loadTemplateIntoEditor(active);
                else if (all.length > 0) loadTemplateIntoEditor(all[0]);
                else resetToNewModel();

            } catch {
                toast.error("Impossible de charger les modèles.");
            }

            setLoadingTemplates(false);
        };

        load();
    }, [companyId]);

    const fetchTemplates = async () => {
        try {
            const all = await getAllFidelityTemplates(companyId);
            setTemplates(all);
        } catch {
            toast.error("Impossible de charger les modèles.");
        }
    };
    
    const handleToggleActive = async (tpl, e) => {
        e.stopPropagation();
        try {
            await toggleFidelityTemplateActive(companyId, tpl.id, !tpl.isActive);
            toast.success(`Modèle ${!tpl.isActive ? 'activé' : 'désactivé'} !`);
            
            // Sync editor if editing this template
            if (editingTemplate?.id === tpl.id) {
                setEditingTemplate(prev => ({ ...prev, isActive: !tpl.isActive }));
            }
            
            fetchTemplates();
        } catch (err) {
            toast.error(err.message || "Erreur lors du changement d'état.");
        }
    };


    /* ---------------------------------------------------------
        LOAD TEMPLATE INTO EDITOR
    --------------------------------------------------------- */
    const loadTemplateIntoEditor = (tpl) => {
        setEditingTemplate(tpl);
        setTemplateName(tpl.name);

        setBaseImage({
            id: tpl.baseImageId,
            file: null,
            preview: `/api/images/${tpl.baseImageId}`
        });

        setStampImage({
            id: tpl.stampImageId,
            file: null,
            preview: `/api/images/${tpl.stampImageId}`
        });

        setStampZones(tpl.stampZones);
        setSelectedZoneIndex(null);
    };


    /* ---------------------------------------------------------
        RESET FOR NEW TEMPLATE
    --------------------------------------------------------- */
    const resetToNewModel = () => {
        setEditingTemplate(null);
        setTemplateName(`Modèle ${new Date().getFullYear()}`);

        setBaseImage({ file: null, preview: "", id: null });
        setStampImage({ file: null, preview: "", id: null });

        setStampZones([]);
        setSelectedZoneIndex(null);

        toast("Nouveau modèle créé", { icon: "✨" });
    };


    /* ---------------------------------------------------------
        FILE CHANGES
    --------------------------------------------------------- */
    const onPickFile = (e, setter) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setter({
            file,
            preview: URL.createObjectURL(file),
            id: null,
        });
    };


    /* ---------------------------------------------------------
        PLACE OR MOVE ZONE
    --------------------------------------------------------- */
    const handleCanvasClick = (e) => {
        if (mode !== "edit" || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);

        if (selectedZoneIndex !== null) {
            setStampZones(z =>
                z.map((zone, i) => i === selectedZoneIndex ? { ...zone, x, y } : zone)
            );
            setSelectedZoneIndex(null);
            toast.success("Zone déplacée");
        } else {
            const order = stampZones.length + 1;
            setStampZones([...stampZones, { x, y, order }]);
            toast.success(`Tampon #${order} ajouté`);
        }
    };


    /* ---------------------------------------------------------
        RESET ZONES
    --------------------------------------------------------- */
    const resetZones = () => {
        setStampZones([]);
        setSelectedZoneIndex(null);
        toast("Zones réinitialisées", { icon: "↺" });
    };


    /* ---------------------------------------------------------
        SUBMIT TEMPLATE
    --------------------------------------------------------- */
    const onSubmit = async (e) => {
        e.preventDefault();

        if ((!baseImage.file && !baseImage.id) ||
            (!stampImage.file && !stampImage.id) ||
            stampZones.length === 0) {
            return toast.error("Veuillez fournir les 2 images et au moins une zone.");
        }

        setIsSubmitting(true);

        const form = new FormData();
        if (baseImage.file) form.append("baseImage", baseImage.file);
        if (stampImage.file) form.append("stampImage", stampImage.file);

        form.append("setupData", JSON.stringify({
            name: templateName,
            zones: stampZones.map(({ id: _id, templateId: _templateId, ...z }) => z),
            baseImageId: baseImage.id,
            stampImageId: stampImage.id,
        }));

        try {
            const saved = await setupFidelityTemplate(companyId, form);
            toast.success("Modèle sauvegardé !");
            loadTemplateIntoEditor(saved);
        } catch (err) {
            toast.error(err.message || "Erreur lors de la sauvegarde");
        }

        setIsSubmitting(false);
    };


    /* ---------------------------------------------------------
        RENDER
    --------------------------------------------------------- */
    if (loadingTemplates) {
        return (
            <div className="py-20 flex justify-center">
                <Spinner />
            </div>
        );
    }


    return (
        <form onSubmit={onSubmit} className="space-y-10 animate-fadeIn">

            {/* -------------------------------------- */}
            {/*   HEADER + TEMPLATE SELECTOR            */}
            {/* -------------------------------------- */}

            <div className="bg-cca-surface border border-cca-border rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-3xl font-bold text-cca-textPrimary flex items-center gap-2">
                        Configuration des modèles
                    </h1>

                    <button
                        onClick={resetToNewModel}
                        type="button"
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm flex items-center gap-2"
                    >
                        <PlusCircle size={18} /> Nouveau modèle
                    </button>
                </div>

                {templates.length === 0 ? (
                    <p className="text-cca-textSecondary">Aucun modèle existant.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {templates.map(tpl => (
                            <div
                                key={tpl.id}
                                onClick={() => loadTemplateIntoEditor(tpl)}
                                className={`
                                    cursor-pointer p-4 rounded-lg border
                                    transition bg-cca-base hover:border-indigo-500
                                    ${editingTemplate?.id === tpl.id ? "border-indigo-400" : "border-cca-border"}
                                `}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-cca-textPrimary font-semibold">{tpl.name}</p>
                                        <p className="text-cca-textSecondary text-sm mt-1">
                                            {tpl.stampZones.length} tampons
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => handleToggleActive(tpl, e)}
                                        className={`p-1 rounded-full hover:bg-cca-border transition ${tpl.isActive ? 'text-green-500' : 'text-cca-textSecondary'}`}
                                        title={tpl.isActive ? 'Désactiver' : 'Activer'}
                                    >
                                        {tpl.isActive ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                                    </button>
                                </div>
                                {tpl.isActive && (
                                    <p className="text-xs mt-2 px-2 py-1 rounded bg-green-700/30 text-green-400 border border-green-700/50 inline-block">
                                        Modèle actif
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>


            {/* EDITOR SECTION */}
            <div className="space-y-8 animate-fadeIn">
                
                {editingTemplate && !editingTemplate.isActive && (
                    <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-xl flex items-center gap-3 text-orange-400">
                        <XCircle size={20} />
                        <div>
                            <p className="font-bold">Modèle désactivé</p>
                            <p className="text-xs">Ce modèle ne sera pas proposé lors de la création de nouvelles cartes clients.</p>
                        </div>
                    </div>
                )}

                {/* NAME */}
                <div>
                    <label className="text-sm text-cca-textSecondary">Nom du modèle</label>
                    <input
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="mt-1 bg-cca-surface border border-cca-border text-cca-textPrimary px-4 py-2 rounded-lg w-full max-w-md"
                    />
                </div>

                {/* IMAGES */}
                <div className="grid md:grid-cols-2 gap-6">

                    {/* Base image */}
                    <div className="bg-cca-surface p-4 rounded-xl border border-cca-border">
                        <p className="text-cca-textPrimary font-semibold mb-2 flex items-center gap-2">
                            <ImageIcon size={18} /> Image de fond
                        </p>

                        <label className="cursor-pointer flex items-center gap-2 bg-cca-base hover:bg-cca-surface px-3 py-2 rounded text-cca-textPrimary text-sm w-fit border border-cca-border">
                            <Upload size={18} /> Importer
                            <input type="file" accept="image/*" className="hidden"
                                   onChange={(e) => onPickFile(e, setBaseImage)} />
                        </label>

                        <div className="mt-3 bg-cca-base rounded-xl overflow-hidden border border-cca-border">
                            {baseImage.preview ? (
                                <img src={baseImage.preview} className="w-full max-h-64 object-contain p-2" />
                            ) : (
                                <div className="h-40 flex items-center justify-center text-cca-textSecondary">
                                    Aucune image
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stamp image */}
                    <div className="bg-cca-surface p-4 rounded-xl border border-cca-border">
                        <p className="text-cca-textPrimary font-semibold mb-2 flex items-center gap-2">
                            <ImageIcon size={18} /> Image du tampon
                        </p>

                        <label className="cursor-pointer flex items-center gap-2 bg-cca-base hover:bg-cca-surface px-3 py-2 rounded text-cca-textPrimary text-sm w-fit border border-cca-border">
                            <Upload size={18} /> Importer PNG
                            <input type="file" accept="image/png" className="hidden"
                                   onChange={(e) => onPickFile(e, setStampImage)} />
                        </label>

                        <div className="mt-3 bg-cca-base rounded-xl overflow-hidden border border-cca-border">
                            {stampImage.preview ? (
                                <img src={stampImage.preview} className="w-full max-h-64 object-contain p-2" />
                            ) : (
                                <div className="h-40 flex items-center justify-center text-cca-textSecondary">
                                    Aucune image
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* EDITOR CANVAS */}
                <div className="bg-cca-surface p-4 rounded-xl border border-cca-border">

                    {/* Mode selector */}
                    <div className="flex items-center gap-2 mb-4">
                        <button
                            type="button"
                            className={`px-3 py-1 rounded transition ${mode === "edit" ? "bg-indigo-600 text-white" : "bg-cca-base text-cca-textSecondary hover:bg-cca-border"}`}
                            onClick={() => setMode("edit")}
                        >
                            <Edit3 size={16} className="inline mr-1" /> Édition
                        </button>

                        <button
                            type="button"
                            className={`px-3 py-1 rounded transition ${mode === "preview" ? "bg-indigo-600 text-white" : "bg-cca-base text-cca-textSecondary hover:bg-cca-border"}`}
                            onClick={() => setMode("preview")}
                        >
                            <Eye size={16} className="inline mr-1" /> Aperçu
                        </button>

                        {stampZones.length > 0 && mode === "edit" && (
                            <button
                                type="button"
                                onClick={resetZones}
                                className="ml-auto flex items-center gap-2 text-red-400 hover:text-red-300 text-sm"
                            >
                                <RefreshCcw size={16} /> Réinitialiser
                            </button>
                        )}
                    </div>

                    {/* Canvas */}
                    <div
                        ref={canvasRef}
                        onClick={handleCanvasClick}
                        className={`
                            relative border border-cca-border bg-cca-base rounded-lg mx-auto
                            ${mode === "edit" ? "cursor-crosshair" : "cursor-default"}
                            max-w-xl overflow-hidden
                        `}
                    >
                        {baseImage.preview ? (
                            <img
                                src={baseImage.preview}
                                className="w-full object-contain max-h-[450px] mx-auto"
                            />
                        ) : (
                            <div className="h-64 flex items-center justify-center text-cca-textSecondary">
                                Importez une image de fond pour commencer
                            </div>
                        )}

                        {/* Zones */}
                        {stampZones.map((zone, index) => {

                            if (mode === "edit") {
                                return (
                                    <div
                                        key={index}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedZoneIndex(index);
                                        }}
                                        className={`
                                            absolute w-8 h-8 rounded-full flex items-center justify-center border-2 text-white font-bold
                                            bg-indigo-600 border-indigo-300 transition
                                            ${selectedZoneIndex === index && "scale-125 bg-green-500 border-white"}
                                        `}
                                        style={{ left: zone.x - 16, top: zone.y - 16 }}
                                    >
                                        {index + 1}
                                    </div>
                                );
                            }

                            return (
                                stampImage.preview && (
                                    <img
                                        key={index}
                                        src={stampImage.preview}
                                        className="absolute w-10 h-10 object-contain pointer-events-none opacity-90"
                                        style={{ left: zone.x - 20, top: zone.y - 20 }}
                                    />
                                )
                            );
                        })}
                    </div>
                </div>

                {/* SUBMIT BUTTON */}
                <div className="pt-6 border-t border-cca-border">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:bg-slate-500 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "Enregistrement..." : "Enregistrer le modèle"}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default FidelitySetupPage;
