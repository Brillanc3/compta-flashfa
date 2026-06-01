// frontend/src/pages/dashboard/customPages/CustomPageEditPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import {
    FileText, BookOpen, Link2, Layout, Shield, Timer, Newspaper,
    Info, Star, Settings, Users, Folder, ClipboardList, MessageSquare,
    Bell, Calendar, Tag, Lock, Globe, ChevronDown, X, Eye, PenLine,
} from "lucide-react";

import {
    getCustomPageById,
    updateCustomPageSettings,
    updateCustomPageDraft,
    updateCustomPageAccess,
    publishCustomPage,
    deleteCustomPage,
} from "@/services/customPagesService";
import { queryClient } from "@/utils/queryClient";

import { getUsersAndRanksForChat } from "@/services/companyService";
import EntityMultiSelect from "@/components/common/EntityMultiSelect";
import { useConfirmation } from "@/contexts/ConfirmationContext";

// ── Markdown plugins ──────────────────────────────────────────
function remarkCenterDirective() {
    return (tree) => {
        visit(tree, (node) => {
            if (node.type === "containerDirective" && node.name === "center") {
                node.data = node.data || {};
                node.data.hName = "div";
                node.data.hProperties = { style: "text-align:center" };
            }
        });
    };
}
const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkDirective, remarkCenterDirective];

// ── Toolbar ───────────────────────────────────────────────────
const TOOLBAR_ACTIONS = [
    { label: "G", title: "Gras", before: "**", after: "**", placeholder: "texte en gras" },
    { label: "I", title: "Italique", before: "*", after: "*", placeholder: "texte en italique", italic: true },
    { label: "S", title: "Barré", before: "~~", after: "~~", placeholder: "texte barré", line: true },
    { label: "H1", title: "Titre 1", before: "# ", after: "", placeholder: "Titre principal" },
    { label: "H2", title: "Titre 2", before: "## ", after: "", placeholder: "Titre secondaire" },
    { label: "H3", title: "Titre 3", before: "### ", after: "", placeholder: "Titre tertiaire" },
    { label: "≡", title: "Centré", before: ":::center\n", after: "\n:::", placeholder: "texte centré" },
    { label: "—", title: "Séparateur", before: "\n---\n", after: "", placeholder: "" },
    { label: "•", title: "Liste à puces", before: "- ", after: "", placeholder: "élément" },
    { label: "1.", title: "Liste numérotée", before: "1. ", after: "", placeholder: "élément" },
    { label: "[ ]", title: "Case à cocher", before: "- [ ] ", after: "", placeholder: "tâche" },
    { label: "> ", title: "Citation", before: "> ", after: "", placeholder: "citation" },
    { label: "`", title: "Code inline", before: "`", after: "`", placeholder: "code" },
    { label: "```", title: "Bloc de code", before: "```\n", after: "\n```", placeholder: "code" },
    { label: "🔗", title: "Lien", before: "[", after: "](url)", placeholder: "texte du lien" },
    { label: "🖼", title: "Image", before: "![", after: "](url)", placeholder: "alt" },
];

function insertAtCursor(textarea, before, after, placeholder) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end) || placeholder;
    const newValue =
        textarea.value.substring(0, start) + before + selected + after + textarea.value.substring(end);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, newValue);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    const cursorPos = start + before.length + selected.length + after.length;
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(cursorPos, cursorPos); }, 0);
}

function MarkdownToolbar({ textareaRef }) {
    return (
        <div className="flex flex-wrap gap-1 p-2 bg-slate-800 border border-slate-700 rounded-t-lg border-b-0">
            {TOOLBAR_ACTIONS.map((action) => (
                <button
                    key={action.title}
                    type="button"
                    title={action.title}
                    className="px-2 py-1 rounded text-xs font-mono text-slate-200 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition-colors min-w-[28px] text-center"
                    style={action.italic ? { fontStyle: "italic" } : action.line ? { textDecoration: "line-through" } : {}}
                    onClick={() => { if (textareaRef.current) insertAtCursor(textareaRef.current, action.before, action.after, action.placeholder); }}
                >
                    {action.label}
                </button>
            ))}
        </div>
    );
}

// ── IconPicker ────────────────────────────────────────────────
const ICON_MAP = {
    FileText, BookOpen, Link2, Layout, Shield, Timer, Newspaper,
    Info, Star, Settings, Users, Folder, ClipboardList, MessageSquare,
    Bell, Calendar, Tag, Lock, Globe,
};
const ICON_OPTIONS = [
    { value: "", label: "Aucune icône" },
    { value: "FileText", label: "Document texte" },
    { value: "BookOpen", label: "Livre ouvert" },
    { value: "Link2", label: "Lien" },
    { value: "Layout", label: "Mise en page" },
    { value: "Shield", label: "Bouclier" },
    { value: "Timer", label: "Minuterie" },
    { value: "Newspaper", label: "Journal" },
    { value: "Info", label: "Information" },
    { value: "Star", label: "Étoile" },
    { value: "Settings", label: "Paramètres" },
    { value: "Users", label: "Utilisateurs" },
    { value: "Folder", label: "Dossier" },
    { value: "ClipboardList", label: "Liste" },
    { value: "MessageSquare", label: "Message" },
    { value: "Bell", label: "Notification" },
    { value: "Calendar", label: "Calendrier" },
    { value: "Tag", label: "Étiquette" },
    { value: "Lock", label: "Verrouillage" },
    { value: "Globe", label: "Monde" },
];

function IconPicker({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);
    const selected = ICON_OPTIONS.find((o) => o.value === value);
    const SelectedIcon = value ? ICON_MAP[value] : null;
    return (
        <div ref={ref} className="relative">
            <button type="button"
                className="w-full flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 hover:border-slate-500 transition-colors"
                onClick={() => setOpen((v) => !v)}
            >
                {SelectedIcon ? <SelectedIcon size={16} className="text-indigo-400 shrink-0" /> : <span className="w-4 h-4 shrink-0" />}
                <span className="flex-1 text-left text-sm truncate">{selected?.label || "Aucune icône"}</span>
                {value && (
                    <span role="button" className="text-slate-500 hover:text-slate-300"
                        onClick={(e) => { e.stopPropagation(); onChange(""); }}>
                        <X size={13} />
                    </span>
                )}
                <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    <div className="grid grid-cols-2 gap-px bg-slate-700 max-h-64 overflow-y-auto">
                        {ICON_OPTIONS.map((opt) => {
                            const Icon = opt.value ? ICON_MAP[opt.value] : null;
                            const isSel = opt.value === value;
                            return (
                                <button key={opt.value} type="button"
                                    className={`flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${isSel ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-200 hover:bg-slate-800"}`}
                                    onClick={() => { onChange(opt.value); setOpen(false); }}
                                >
                                    {Icon ? <Icon size={15} className={isSel ? "text-white" : "text-indigo-400"} /> : <span className="w-[15px] h-[15px] rounded border border-slate-600 shrink-0" />}
                                    <span className="truncate">{opt.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function fmtDate(d) {
    if (!d) return "-";
    try {
        return new Date(d).toLocaleString("fr-FR");
    } catch {
        return String(d);
    }
}

export default function CustomPageEditPage() {
    const { id } = useParams();
    const pageId = Number(id);
    const navigate = useNavigate();
    const { confirmAction } = useConfirmation();

    const { data: page, isLoading, isError, error } = useQuery({
        queryKey: ["customPages", "detail", pageId],
        queryFn: () => getCustomPageById(pageId, { version: "both" }),
        enabled: Number.isFinite(pageId) && pageId > 0,
    });

    const { data: chatData, isLoading: isLoadingChat, isError: isErrorChat } = useQuery({
        queryKey: ["company", "usersRanksForChat"],
        queryFn: () => getUsersAndRanksForChat(),
    });

    const companyUsers = chatData?.users || [];
    const companyRanks = chatData?.ranks || [];

    // Local state (editable)
    const [type, setType] = useState("CUSTOM");
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [isPublic, setIsPublic] = useState(false);

    const [showInSidebar, setShowInSidebar] = useState(false);
    const [navTitle, setNavTitle] = useState("");
    const [navIcon, setNavIcon] = useState("");
    const [navOrder, setNavOrder] = useState(0);
    const [navGroup, setNavGroup] = useState("");

    const [content, setContent] = useState("");
    const [iframeUrl, setIframeUrl] = useState("");
    const [previewMode, setPreviewMode] = useState(false);
    const contentRef = useRef(null);

    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [selectedRankIds, setSelectedRankIds] = useState([]);

    // hydrate from API
    useEffect(() => {
        if (!page) return;

        setType(page.type || "CUSTOM");
        setTitle(page.title || "");
        setSlug(page.slug || "");
        setIsPublic(Boolean(page.isPublic));

        setShowInSidebar(Boolean(page.showInSidebar));
        setNavTitle(page.navTitle || "");
        setNavIcon(page.navIcon || "");
        setNavOrder(Number(page.navOrder || 0));
        setNavGroup(page.navGroup || "");

        setContent(page?.draft?.content ?? "");
        setIframeUrl(page?.draft?.iframeUrl ?? "");

        const u = page?.access?.users || [];
        const r = page?.access?.ranks || [];
        setSelectedUserIds(u);
        setSelectedRankIds(r);
    }, [page]);

    const settingsPayload = useMemo(() => {
        return {
            type,
            title,
            slug,
            showInSidebar,
            navTitle: navTitle || null,
            navIcon: navIcon || null,
            navOrder: Number(navOrder) || 0,
            navGroup: navGroup || null,
        };
    }, [type, title, slug, showInSidebar, navTitle, navIcon, navOrder, navGroup]);

    const draftPayload = useMemo(() => {
        if (type === "CUSTOM") return { content };
        return { iframeUrl };
    }, [type, content, iframeUrl]);

    const accessPayload = useMemo(() => {
        return {
            isPublic,
            accessUserIds: selectedUserIds,
            accessRankIds: selectedRankIds,
        };
    }, [isPublic, selectedUserIds, selectedRankIds]);

    const settingsMutation = useMutation({
        mutationFn: async () => updateCustomPageSettings(pageId, settingsPayload),
        onSuccess: async () => {
            toast.success("Paramètres enregistrés");
            await queryClient.invalidateQueries({ queryKey: ["customPages", "detail", pageId] });
            await queryClient.invalidateQueries({ queryKey: ["customPages", "list"] });
        },
        onError: (e) => toast.error(e?.response?.data?.message || e?.message || "Erreur"),
    });

    const draftMutation = useMutation({
        mutationFn: async () => updateCustomPageDraft(pageId, { ...draftPayload, type, title, slug }),
        onSuccess: async () => {
            toast.success("Brouillon enregistré");
            await queryClient.invalidateQueries({ queryKey: ["customPages", "detail", pageId] });
        },
        onError: (e) => toast.error(e?.response?.data?.message || e?.message || "Erreur"),
    });

    const accessMutation = useMutation({
        mutationFn: async () => updateCustomPageAccess(pageId, accessPayload),
        onSuccess: async () => {
            toast.success("Accès mis à jour");
            await queryClient.invalidateQueries({ queryKey: ["customPages", "detail", pageId] });
            await queryClient.invalidateQueries({ queryKey: ["customPages", "list"] });
        },
        onError: (e) => toast.error(e?.response?.data?.message || e?.message || "Erreur"),
    });

    const publishMutation = useMutation({
        mutationFn: async () => publishCustomPage(pageId),
        onSuccess: async () => {
            toast.success("Page publiée");
            await queryClient.invalidateQueries({ queryKey: ["customPages", "detail", pageId] });
            await queryClient.invalidateQueries({ queryKey: ["customPages", "list"] });
        },
        onError: (e) => toast.error(e?.response?.data?.message || e?.message || "Erreur publication"),
    });

    const deleteMutation = useMutation({
        mutationFn: async () => deleteCustomPage(pageId),
        onSuccess: async () => {
            toast.success("Page supprimée");
            await queryClient.invalidateQueries({ queryKey: ["customPages", "list"] });
            navigate("/dashboard/custom-pages");
        },
        onError: (e) => toast.error(e?.response?.data?.message || e?.message || "Erreur suppression"),
    });

    if (!Number.isFinite(pageId) || pageId <= 0) {
        return <div className="p-6 text-slate-200">ID invalide.</div>;
    }

    if (isLoading) return <div className="p-6 text-slate-200">Chargement…</div>;

    if (isError) {
        return (
            <div className="p-6 text-red-200">
                {error?.response?.data?.message || error?.message || "Erreur"}
            </div>
        );
    }

    const publishedAt = page?.publishedAt;

    return (
        <div className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-white">Modifier la page</h1>
                    <div className="text-sm text-slate-300">
                        ID: {pageId} — Dernière mise à jour: {fmtDate(page?.updatedAt)} — Publié:{" "}
                        {publishedAt ? fmtDate(publishedAt) : "Non"}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                    <Link
                        to="/dashboard/custom-pages"
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm"
                    >
                        Retour
                    </Link>

                    <Link
                        to={`/dashboard/pages/${slug}`}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm"
                        title="Ouvrir"
                    >
                        Ouvrir
                    </Link>

                    <button
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-50"
                        disabled={publishMutation.isPending}
                        onClick={() => publishMutation.mutate()}
                    >
                        Publier
                    </button>

                    <button
                        className="px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm disabled:opacity-50"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                            confirmAction({
                                title: "Supprimer la page",
                                message: `Confirmer la suppression de la page "${title}" ? Cette action est irréversible.`,
                                onConfirm: () => deleteMutation.mutate(),
                            });
                        }}
                    >
                        Supprimer
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* SETTINGS */}
                <div className="lg:col-span-2 bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-100">Paramètres</div>
                        <button
                            className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
                            disabled={settingsMutation.isPending}
                            onClick={() => {
                                if (!title.trim()) return toast.error("Le titre est requis");
                                settingsMutation.mutate();
                            }}
                        >
                            Enregistrer
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="space-y-1">
                            <div className="text-xs text-slate-300">Type</div>
                            <select
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                            >
                                <option value="CUSTOM">CUSTOM</option>
                                <option value="IFRAME">IFRAME</option>
                            </select>
                        </label>

                        <label className="space-y-1">
                            <div className="text-xs text-slate-300">Titre</div>
                            <input
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </label>

                        <label className="space-y-1">
                            <div className="text-xs text-slate-300">Slug</div>
                            <input
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                            />
                            <div className="text-[11px] text-slate-400">
                                Le backend garantit l’unicité (suffixe si besoin).
                            </div>
                        </label>

                        <label className="flex items-center gap-2 mt-6">
                            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                            <span className="text-sm text-slate-200">Public (dans l’entreprise)</span>
                        </label>
                    </div>

                    <div className="border-t border-slate-700 pt-4 space-y-3">
                        <div className="text-sm font-semibold text-slate-100">Sidebar</div>

                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={showInSidebar}
                                onChange={(e) => setShowInSidebar(e.target.checked)}
                            />
                            <span className="text-sm text-slate-200">Afficher dans la sidebar</span>
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="space-y-1">
                                <div className="text-xs text-slate-300">Titre menu (navTitle)</div>
                                <input
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                                    value={navTitle}
                                    onChange={(e) => setNavTitle(e.target.value)}
                                />
                            </label>

                            <label className="space-y-1">
                                <div className="text-xs text-slate-300">Icône (navIcon)</div>
                                <IconPicker value={navIcon} onChange={setNavIcon} />
                            </label>

                            <label className="space-y-1">
                                <div className="text-xs text-slate-300">Ordre (navOrder)</div>
                                <input
                                    type="number"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                                    value={navOrder}
                                    onChange={(e) => setNavOrder(e.target.value)}
                                />
                            </label>

                            <label className="space-y-1">
                                <div className="text-xs text-slate-300">Groupe (navGroup)</div>
                                <input
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                                    value={navGroup}
                                    onChange={(e) => setNavGroup(e.target.value)}
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {/* DRAFT + ACCESS */}
                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-100">Brouillon</div>
                        <button
                            className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
                            disabled={draftMutation.isPending}
                            onClick={() => {
                                if (type === "IFRAME" && !iframeUrl.trim()) {
                                    toast.error("iframeUrl est requis pour une page IFRAME");
                                    return;
                                }
                                draftMutation.mutate();
                            }}
                        >
                            Enregistrer
                        </button>
                    </div>

                    {type === "CUSTOM" ? (
                        <div className="space-y-2">
                            {/* Onglets édition / aperçu */}
                            <div className="flex border-b border-slate-700">
                                <button type="button"
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${!previewMode ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                                    onClick={() => setPreviewMode(false)}
                                >
                                    <PenLine size={13} /> Éditer
                                </button>
                                <button type="button"
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${previewMode ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                                    onClick={() => setPreviewMode(true)}
                                >
                                    <Eye size={13} /> Aperçu
                                </button>
                            </div>

                            {!previewMode && (
                                <>
                                    <MarkdownToolbar textareaRef={contentRef} />
                                    <textarea
                                        ref={contentRef}
                                        rows={14}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-b-lg px-3 py-2 text-slate-100 font-mono text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                    />
                                    <div className="text-[11px] text-slate-400">
                                        Markdown — <code className="bg-slate-800 px-1 rounded">:::center</code> pour centrer.
                                    </div>
                                </>
                            )}

                            {previewMode && (
                                <div className="min-h-[200px] bg-slate-950 border border-slate-700 rounded-lg p-4">
                                    {content.trim() ? (
                                        <div className="prose prose-slate prose-invert max-w-none prose-headings:text-slate-100 prose-p:text-slate-100 prose-strong:text-slate-100 prose-em:text-slate-100 prose-li:text-slate-100 prose-blockquote:text-slate-100 prose-a:text-indigo-300 hover:prose-a:text-indigo-200 prose-code:text-slate-100 prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-hr:border-slate-700 prose-table:text-slate-100 prose-th:text-slate-100 prose-td:text-slate-100">
                                            <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <div className="text-slate-500 text-sm italic">Aucun contenu à prévisualiser.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <label className="space-y-1 block">
                            <div className="text-xs text-slate-300">iframeUrl</div>
                            <input
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                                value={iframeUrl}
                                onChange={(e) => setIframeUrl(e.target.value)}
                                placeholder="https://…"
                            />
                        </label>
                    )}

                    <div className="border-t border-slate-700 pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-100">Accès</div>
                            <button
                                className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
                                disabled={accessMutation.isPending}
                                onClick={() => accessMutation.mutate()}
                            >
                                Enregistrer
                            </button>
                        </div>

                        <div className="text-xs text-slate-400">
                            Si Public = true, les ACL ne sont pas utilisées.
                        </div>

                        {isLoadingChat ? (
                            <div className="text-sm text-slate-300">Chargement des employés et rangs…</div>
                        ) : isErrorChat ? (
                            <div className="text-sm text-red-300">Impossible de charger les employés / rangs.</div>
                        ) : (
                            <div className="space-y-4">
                                <EntityMultiSelect
                                    label="Utilisateurs autorisés"
                                    items={companyUsers}
                                    selectedIds={selectedUserIds}
                                    onChangeSelectedIds={setSelectedUserIds}
                                    disabled={isPublic}
                                    getId={(u) => Number(u.userId)}
                                    renderItem={(u) => `${u.fullName}${u.rankName ? ` — ${u.rankName}` : ""}`}
                                />

                                <EntityMultiSelect
                                    label="Rangs autorisés"
                                    items={companyRanks}
                                    selectedIds={selectedRankIds}
                                    onChangeSelectedIds={setSelectedRankIds}
                                    disabled={isPublic}
                                    getId={(r) => Number(r.id)}
                                    renderItem={(r) => `${r.name} (membres: ${r.membersCount ?? 0})`}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
