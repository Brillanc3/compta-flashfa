import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import toast from "react-hot-toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import Spinner from "@/components/ui/Spinner";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import A4Preview from "@/components/contracts/A4Preview";
import MarkdownToolbar from "@/components/contracts/MarkdownToolbar";
import CopyRenderedHtmlButton from "@/components/contracts/CopyRenderedHtmlButton.jsx";

import {
    getContractTemplateById,
    createContractTemplate,
    updateContractTemplate,
    updateTemplateArticles,
    createTemplateField,
    updateTemplateField,
    deleteTemplateField
} from "@/services/contractService";

/* ============================================================================
   ÉDITEUR DE TEMPLATE DE CONTRAT
   - Reçoit templateId depuis ContractTemplatesPage
   - Fonctionne avec "new" pour créer un modèle
============================================================================ */

const FIELD_TYPES = [
    { value: "TEXT", label: "TEXTE" },
    { value: "NUMBER", label: "NOMBRE" },
    { value: "DATE", label: "DATE" },
    { value: "PRICE", label: "PRIX" },
    { value: "MODULE_SELECTION", label: "SÉLECTION MODULE" }
];

export default function ContractTemplateEditor({ templateId, onTemplateSaved }) {
    // Supporte 2 usages :
    // 1) Intégré dans ContractTemplatesPage via props (templateId)
    // 2) Directement via la route (/.../templates/new | /.../templates/:templateId)
    const params = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const resolvedTemplateId =
        templateId ??
        params.templateId ??
        (location.pathname.endsWith("/new") ? "new" : null);

    const isNew = resolvedTemplateId === "new" || !resolvedTemplateId;

    /* --------------------------------------------------------------------
       STATE LOCAL
    --------------------------------------------------------------------- */
    const [title, setTitle] = useState("");
    const [type, setType] = useState("COMPANY");
    const [content, setContent] = useState("");
    const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
    const [articles, setArticles] = useState([]);

    // 🆕 Fields
    const [fields, setFields] = useState([]);

    const editorRef = useRef(null);

    /* --------------------------------------------------------------------
       CHARGEMENT DU TEMPLATE (si edition)
    --------------------------------------------------------------------- */
    const { data: template, isLoading: isLoadingTemplate } = useQuery({
        queryKey: ["contractTemplate", resolvedTemplateId],
        enabled: !isNew && !!resolvedTemplateId,
        queryFn: async () => {
            const data = await getContractTemplateById(resolvedTemplateId);
            return data;
        }
    });

    /* Réinitialise les champs quand un template est chargé */
    useEffect(() => {
        if (!template) return;

        setTitle(template.title || "");
        setType(template.type || "COMPANY");
        setContent(template.content || "");
        setBackgroundImageUrl(template.backgroundImageUrl || "");
        setArticles(template.articles || []);

        // 🆕 hydrate fields
        setFields(template.fields || []);
    }, [template]);

    /* --------------------------------------------------------------------
       GÉNÉRATION DU MARKDOWN FINAL (injection des articles)
    --------------------------------------------------------------------- */
    const fullMarkdown = useMemo(() => {
        const articlesMarkdown = (articles || [])
            .map((article, index) => {
                const num = index + 1;
                const t = article.title ? ` - ${article.title}` : "";
                const body = article.body || "";
                return `### Article ${num}${t}\n\n${body}`;
            })
            .join("\n\n");

        let base = content || "";

        if (articlesMarkdown) {
            if (base.includes("{{articles}}")) {
                base = base.replace("{{articles}}", articlesMarkdown);
            } else {
                base = `${base}\n\n${articlesMarkdown}`;
            }
        } else {
            base = base.replace("{{articles}}", "");
        }

        return base.trim();
    }, [content, articles]);

    /* --------------------------------------------------------------------
       SAVE TEMPLATE (CREATE vs UPDATE)
    --------------------------------------------------------------------- */
    const saveTemplateMutation = useMutation({
        mutationFn: async () => {
            if (!title.trim()) throw new Error("Le titre est obligatoire.");

            if (isNew) {
                const saved = await createContractTemplate({
                    title,
                    type,
                    content,
                    backgroundImageUrl
                });
                return saved;
            }

            const saved = await updateContractTemplate(resolvedTemplateId, {
                title,
                type,
                content,
                backgroundImageUrl
            });
            return saved;
        },
        onSuccess: (saved) => {
            toast.success("Template sauvegardé !");
            onTemplateSaved?.(saved);

            // Si l'éditeur est utilisé en page standalone (route), on reste cohérent.
            if (!onTemplateSaved) {
                // Si on vient de créer, on bascule sur la route "edit".
                if (isNew && saved?.id) {
                    navigate(`/dashboard/company/contracts/templates/${saved.id}`, { replace: true });
                }
            }
        },
        onError: (err) => toast.error(err?.message || "Erreur lors de la sauvegarde.")
    });

    /* --------------------------------------------------------------------
       SAVE ARTICLES
    --------------------------------------------------------------------- */
    const saveArticlesMutation = useMutation({
        mutationFn: async () => {
            if (isNew) {
                throw new Error("Vous devez d'abord enregistrer le template.");
            }
            await updateTemplateArticles(resolvedTemplateId, articles);
        },
        onSuccess: () => toast.success("Articles sauvegardés !"),
        onError: (err) => toast.error(err?.message || "Erreur lors de la sauvegarde.")
    });

    /* --------------------------------------------------------------------
       TOOLBAR — Transformations Markdown
    --------------------------------------------------------------------- */
    const applyTransform = (fn) => {
        const textarea = editorRef.current;
        if (!textarea) return;

        const { value, selectionStart, selectionEnd } = textarea;
        const selected = value.slice(selectionStart, selectionEnd);

        const { newText, newSelectionStart, newSelectionEnd } = fn({
            value,
            selected,
            selectionStart,
            selectionEnd
        });

        setContent(newText);

        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
        });
    };

    const handleToolbarAction = (action) => {
        switch (action) {
            case "bold":
                return applyTransform(({ value, selected, selectionStart, selectionEnd }) => {
                    const t = selected || "texte";
                    const before = value.slice(0, selectionStart);
                    const after = value.slice(selectionEnd);
                    const insert = `**${t}**`;
                    const s = before.length + 2;
                    return {
                        newText: before + insert + after,
                        newSelectionStart: s,
                        newSelectionEnd: s + t.length
                    };
                });

            case "italic":
                return applyTransform(({ value, selected, selectionStart, selectionEnd }) => {
                    const t = selected || "texte";
                    const before = value.slice(0, selectionStart);
                    const after = value.slice(selectionEnd);
                    const insert = `*${t}*`;
                    const s = before.length + 1;
                    return {
                        newText: before + insert + after,
                        newSelectionStart: s,
                        newSelectionEnd: s + t.length
                    };
                });

            case "h1":
                return applyTransform(({ value, selectionStart, selectionEnd }) => {
                    const before = value.slice(0, selectionStart);
                    const after = value.slice(selectionEnd);
                    const lineStart = before.lastIndexOf("\n") + 1;
                    const line = value.slice(lineStart, selectionEnd);
                    const newLine = line.startsWith("# ") ? line : `# ${line}`;
                    const delta = newLine.length - line.length;
                    return {
                        newText: value.slice(0, lineStart) + newLine + after,
                        newSelectionStart: selectionStart + (delta > 0 ? 2 : 0),
                        newSelectionEnd: selectionEnd + delta
                    };
                });

            case "ul":
                return applyTransform(({ value, selected, selectionStart, selectionEnd }) => {
                    const before = value.slice(0, selectionStart);
                    const after = value.slice(selectionEnd);
                    const block = selected || "élément de liste";
                    const insert = block
                        .split("\n")
                        .map((l) => (l.startsWith("- ") ? l : `- ${l}`))
                        .join("\n");
                    const s = before.length;
                    return {
                        newText: before + insert + after,
                        newSelectionStart: s,
                        newSelectionEnd: s + insert.length
                    };
                });

            case "ol":
                return applyTransform(({ value, selected, selectionStart, selectionEnd }) => {
                    const before = value.slice(0, selectionStart);
                    const after = value.slice(selectionEnd);
                    const block = selected || "élément numéroté";
                    const insert = block
                        .split("\n")
                        .map((l, i) => (l.match(/^\d+\. /) ? l : `${i + 1}. ${l}`))
                        .join("\n");
                    const s = before.length;
                    return {
                        newText: before + insert + after,
                        newSelectionStart: s,
                        newSelectionEnd: s + insert.length
                    };
                });

            case "quote":
                return applyTransform(({ value, selected, selectionStart, selectionEnd }) => {
                    const before = value.slice(0, selectionStart);
                    const after = value.slice(selectionEnd);
                    const block = selected || "Citation...";
                    const insert = block
                        .split("\n")
                        .map((l) => (l.startsWith("> ") ? l : `> ${l}`))
                        .join("\n");
                    const s = before.length;
                    return {
                        newText: before + insert + after,
                        newSelectionStart: s,
                        newSelectionEnd: s + insert.length
                    };
                });

            default:
                return;
        }
    };

    /* --------------------------------------------------------------------
       DRAG & DROP ARTICLES
    --------------------------------------------------------------------- */
    const onDragEndArticles = (result) => {
        if (!result.destination) return;
        const list = Array.from(articles);
        const [moved] = list.splice(result.source.index, 1);
        list.splice(result.destination.index, 0, moved);
        setArticles(list);
    };

    /* --------------------------------------------------------------------
       🆕 FIELDS — actions (create / patch / delete)
    --------------------------------------------------------------------- */
    const createFieldMutation = useMutation({
        mutationFn: async () => {
            if (isNew) throw new Error("Vous devez d'abord enregistrer le template.");
            const created = await createTemplateField(resolvedTemplateId, { label: "Nouveau champ", fieldType: "TEXT" });
            return created;
        },
        onSuccess: (created) => {
            setFields((prev) => [...prev, created]);
            toast.success("Champ ajouté");
        },
        onError: (err) => toast.error(err?.message || "Erreur lors de l’ajout du champ.")
    });

    const patchField = async (fieldId, payload) => {
        const updated = await updateTemplateField(resolvedTemplateId, fieldId, payload);
        setFields((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        return updated;
    };

    const deleteField = async (fieldId) => {
        await deleteTemplateField(resolvedTemplateId, fieldId);
        setFields((prev) => prev.filter((f) => f.id !== fieldId));
    };

    /* --------------------------------------------------------------------
       Mobile UX: sections (édition / aperçu / articles / champs)
    --------------------------------------------------------------------- */
    const [mobileSection, setMobileSection] = useState("edit");

    useEffect(() => {
        setMobileSection("edit");
    }, [resolvedTemplateId]);

    /* --------------------------------------------------------------------
       LOADING TEMPLATE
    --------------------------------------------------------------------- */
    if (!isNew && isLoadingTemplate) {
        return (
            <div className="p-10 flex justify-center">
                <Spinner />
            </div>
        );
    }

    /* --------------------------------------------------------------------
       RENDER
    --------------------------------------------------------------------- */
    return (
        <div className="space-y-6 p-4">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h1 className="text-3xl font-bold text-white">
                    {isNew ? "Nouveau template de contrat" : `Modifier : ${title}`}
                </h1>

                <button
                    onClick={() => saveTemplateMutation.mutate()}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium active:scale-95 transition"
                >
                    💾 Enregistrer le template
                </button>
            </div>

            {/* Nav mobile : sections */}
            <div className="md:hidden -mx-4 px-4 pb-2 overflow-x-auto">
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setMobileSection("edit")}
                        className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition ${
                            mobileSection === "edit"
                                ? "bg-indigo-600 text-white border-indigo-500"
                                : "bg-slate-900/50 text-slate-200 border-slate-700"
                        }`}
                    >
                        Édition
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileSection("preview")}
                        className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition ${
                            mobileSection === "preview"
                                ? "bg-indigo-600 text-white border-indigo-500"
                                : "bg-slate-900/50 text-slate-200 border-slate-700"
                        }`}
                    >
                        Aperçu
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileSection("articles")}
                        className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition ${
                            mobileSection === "articles"
                                ? "bg-indigo-600 text-white border-indigo-500"
                                : "bg-slate-900/50 text-slate-200 border-slate-700"
                        }`}
                    >
                        Articles
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileSection("fields")}
                        className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition ${
                            mobileSection === "fields"
                                ? "bg-indigo-600 text-white border-indigo-500"
                                : "bg-slate-900/50 text-slate-200 border-slate-700"
                        }`}
                    >
                        Champs
                    </button>
                </div>
            </div>

            {/* GRID FORM + PREVIEW (responsive) */}
            <div
                className={`${
                    mobileSection === "edit" || mobileSection === "preview" ? "" : "hidden"
                } md:grid grid-cols-1 lg:grid-cols-2 gap-6`}
            >

                {/* FORMULAIRE */}
                <div
                    className={`${mobileSection === "edit" ? "" : "hidden"} md:block relative p-6 rounded-xl bg-slate-900/70 border border-slate-700/60 backdrop-blur-xl shadow-2xl space-y-4`}
                >

                    {/* Title */}
                    <div>
                        <label className="text-sm text-slate-300">Titre</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 focus:border-indigo-400 outline-none"
                        />
                    </div>

                    {/* Background */}
                    <div>
                        <label className="text-sm text-slate-300">Image de fond (watermark URL)</label>
                        <input
                            value={backgroundImageUrl}
                            onChange={(e) => setBackgroundImageUrl(e.target.value)}
                            placeholder="https://cdn.exemple.com/fond.png"
                            className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 focus:border-indigo-400 outline-none"
                        />
                    </div>

                    {/* MARKDOWN EDITOR */}
                    <div>
                        <MarkdownToolbar onAction={handleToolbarAction} />

                        <textarea
                            ref={editorRef}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full mt-3 min-h-[220px] px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 resize-y focus:border-indigo-400 outline-none"
                            placeholder={`Rédigez le contenu en Markdown...

Utilisez {{articles}} pour insérer automatiquement les articles.`}
                        />
                    </div>
                </div>

                {/* PREVIEW A4 */}
                <div
                    className={`${mobileSection === "preview" ? "" : "hidden"} md:block relative p-6 rounded-xl bg-slate-900/70 border border-slate-700/60 backdrop-blur-xl shadow-2xl h-fit`}
                >
                    <div className="flex items-center justify-between mb-3 gap-2">
                        <h2 className="text-xl font-semibold text-slate-200">Aperçu A4</h2>
                        <CopyRenderedHtmlButton markdown={fullMarkdown} />
                    </div>

                    <A4Preview markdown={fullMarkdown} backgroundImageUrl={backgroundImageUrl} />
                </div>
            </div>

            {/* ARTICLES SECTION */}
            <div
                className={`${mobileSection === "articles" ? "" : "hidden"} md:block p-6 rounded-xl bg-slate-900/70 border border-slate-700/60 backdrop-blur-xl shadow-2xl`}
            >

                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
                    <h2 className="text-xl font-semibold text-slate-200">Articles</h2>

                    <p className="text-xs text-slate-400">
                        Ils peuvent être insérés via le placeholder{" "}
                        <code className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] text-slate-200">
                            {"{{articles}}"}
                        </code>
                    </p>
                </div>

                {/* DRAG/DROP */}
                <DragDropContext onDragEnd={onDragEndArticles}>
                    <Droppable droppableId="articles">
                        {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">

                                {articles.map((article, index) => (
                                    <Draggable
                                        key={article.id ?? `a-${index}`}
                                        draggableId={`${article.id ?? `a-${index}`}`}
                                        index={index}
                                    >
                                        {(drag) => (
                                            <div
                                                ref={drag.innerRef}
                                                {...drag.draggableProps}
                                                {...drag.dragHandleProps}
                                                className="p-4 rounded-lg bg-slate-800/60 border border-slate-700 hover:bg-slate-800 transition"
                                            >
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-sm font-medium text-slate-300">
                                                        Article {index + 1}
                                                    </span>
                                                    <button
                                                        onClick={() =>
                                                            setArticles(articles.filter((_, i) => i !== index))
                                                        }
                                                        className="text-xs text-red-400 hover:text-red-300"
                                                    >
                                                        ❌ Supprimer
                                                    </button>
                                                </div>

                                                <input
                                                    className="w-full mb-2 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 focus:border-indigo-400 outline-none"
                                                    value={article.title || ""}
                                                    onChange={(e) => {
                                                        const updated = [...articles];
                                                        updated[index].title = e.target.value;
                                                        setArticles(updated);
                                                    }}
                                                    placeholder="Titre (optionnel)"
                                                />

                                                <textarea
                                                    className="w-full h-24 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 focus:border-indigo-400 outline-none"
                                                    value={article.body || ""}
                                                    onChange={(e) => {
                                                        const updated = [...articles];
                                                        updated[index].body = e.target.value;
                                                        setArticles(updated);
                                                    }}
                                                    placeholder="Texte de l'article..."
                                                />
                                            </div>
                                        )}
                                    </Draggable>
                                ))}

                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>

                {/* ACTION BUTTONS */}
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                    <button
                        onClick={() =>
                            setArticles([...articles, { title: "", body: "", params: {} }])
                        }
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-sm active:scale-95"
                    >
                        ➕ Ajouter un article
                    </button>

                    <button
                        onClick={() => saveArticlesMutation.mutate()}
                        disabled={isNew}
                        className={`px-4 py-2 rounded-lg text-sm active:scale-95 ${
                            isNew
                                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                : "bg-indigo-600 hover:bg-indigo-500 text-white"
                        }`}
                    >
                        💾 Sauvegarder les articles
                    </button>

                    {isNew && (
                        <p className="text-xs text-yellow-400 mt-1">
                            Enregistrez le template avant de sauvegarder les articles.
                        </p>
                    )}
                </div>

            </div>

            {/* 🆕 FIELDS SECTION */}
            <div
                className={`${mobileSection === "fields" ? "" : "hidden"} md:block p-6 rounded-xl bg-slate-900/70 border border-slate-700/60 backdrop-blur-xl shadow-2xl`}
            >
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
                    <h2 className="text-xl font-semibold text-slate-200">Champs dynamiques</h2>

                    <p className="text-xs text-slate-400">
                        Cliquez sur une variable pour la copier dans le presse-papiers.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                    <button
                        onClick={() => createFieldMutation.mutate()}
                        disabled={isNew || createFieldMutation.isPending}
                        className={`px-4 py-2 rounded-lg text-sm active:scale-95 ${
                            isNew
                                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                        }`}
                    >
                        ➕ Ajouter un champ
                    </button>

                    {isNew && (
                        <p className="text-xs text-yellow-400 mt-1">
                            Enregistrez le template avant d’ajouter des champs dynamiques.
                        </p>
                    )}
                </div>

                <div className="space-y-3 mt-4">
                    {fields.length === 0 ? (
                        <div className="text-sm text-slate-400">
                            Aucun champ pour le moment.
                        </div>
                    ) : (
                        fields
                            .slice()
                            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                            .map((field) => (
                                <TemplateFieldRow
                                    key={field.id}
                                    field={field}
                                    onPatch={patchField}
                                    onDelete={deleteField}
                                />
                            ))
                    )}
                </div>
            </div>

        </div>
    );
}

/* ============================================================================
   Field row — debounce label + immediate type + copy key
============================================================================ */

function TemplateFieldRow({ field, onPatch, onDelete }) {
    const [label, setLabel] = useState(field.label || "");
    const [fieldType, setFieldType] = useState(field.fieldType || "TEXT");
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    const debounceRef = useRef(null);
    const latestLabelRef = useRef(label);

    useEffect(() => {
        setLabel(field.label || "");
        setFieldType(field.fieldType || "TEXT");
        latestLabelRef.current = field.label || "";
    }, [field.label, field.fieldType]);

    const flushLabel = async () => {
        if (!latestLabelRef.current || latestLabelRef.current === field.label) return;
        await onPatch(field.id, { label: latestLabelRef.current });
    };

    const onChangeLabel = (e) => {
        const v = e.target.value;
        setLabel(v);
        latestLabelRef.current = v;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            flushLabel().catch(() => {});
        }, 500);
    };

    const onBlurLabel = async () => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        try {
            await flushLabel();
        } catch { /* intentional */ }
    };

    const onChangeType = async (e) => {
        const v = e.target.value;
        setFieldType(v);
        await onPatch(field.id, { fieldType: v });
    };

    const copyKey = async () => {
        try {
            await navigator.clipboard.writeText(`{{ ${field.key} }}`);
            toast.success("Variable copiée");
        } catch {
            toast.error("Impossible de copier");
        }
    };

    const onClickDelete = () => {
        setConfirmModal({
            isOpen: true,
            message: "Supprimer ce champ ?",
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await onDelete(field.id);
                    toast.success("Champ supprimé");
                } catch (e) {
                    toast.error(e?.message || "Erreur lors de la suppression");
                }
            },
        });
    };

    return (
        <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700 hover:bg-slate-800 transition">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
                <select
                    value={fieldType}
                    onChange={onChangeType}
                    className="md:w-56 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 focus:border-indigo-400 outline-none text-sm"
                >
                    {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </select>

                <input
                    value={label}
                    onChange={onChangeLabel}
                    onBlur={onBlurLabel}
                    placeholder="Label du champ (ex: Nom de l'employée)"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 focus:border-indigo-400 outline-none text-sm"
                />

                <button
                    onClick={copyKey}
                    className="text-xs text-slate-300 hover:text-white"
                    title="Cliquer pour copier"
                >
                    <code className="bg-slate-900/60 border border-slate-700 px-2 py-1 rounded">
                        {`{{ ${field.key} }}`}
                    </code>
                </button>

                <button
                    onClick={onClickDelete}
                    className="md:ml-auto text-xs text-red-400 hover:text-red-300 px-2 py-2"
                >
                    🗑 Supprimer
                </button>
            </div>
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
            />
        </div>
    );
}
