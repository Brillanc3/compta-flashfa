import React, { useMemo, useRef, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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

import { createCustomPage } from "@/services/customPagesService";
import { getUsersAndRanksForChat } from "@/services/companyService";
import EntityMultiSelect from "@/components/common/EntityMultiSelect";

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
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const selected = ICON_OPTIONS.find((o) => o.value === value);
    const SelectedIcon = value ? ICON_MAP[value] : null;

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                className="w-full flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 hover:border-slate-500 transition-colors"
                onClick={() => setOpen((v) => !v)}
            >
                {SelectedIcon ? (
                    <SelectedIcon size={16} className="text-indigo-400 shrink-0" />
                ) : (
                    <span className="w-4 h-4 shrink-0" />
                )}
                <span className="flex-1 text-left text-sm truncate">
                    {selected?.label || "Aucune icône"}
                </span>
                {value && (
                    <span
                        role="button"
                        className="text-slate-500 hover:text-slate-300"
                        onClick={(e) => { e.stopPropagation(); onChange(""); }}
                    >
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
                            const isSelected = opt.value === value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    className={`flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                                        isSelected
                                            ? "bg-indigo-600 text-white"
                                            : "bg-slate-900 text-slate-200 hover:bg-slate-800"
                                    }`}
                                    onClick={() => { onChange(opt.value); setOpen(false); }}
                                >
                                    {Icon ? (
                                        <Icon size={15} className={isSelected ? "text-white" : "text-indigo-400"} />
                                    ) : (
                                        <span className="w-[15px] h-[15px] rounded border border-slate-600 shrink-0" />
                                    )}
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

const TOOLBAR_ACTIONS = [
    { label: "G", title: "Gras", before: "**", after: "**", placeholder: "texte en gras" },
    { label: "I", title: "Italique", before: "*", after: "*", placeholder: "texte en italique", italic: true },
    { label: "S", title: "Barré", before: "~~", after: "~~", placeholder: "texte barré", line: true },
    { label: "H1", title: "Titre 1", before: "# ", after: "", placeholder: "Titre principal", block: true },
    { label: "H2", title: "Titre 2", before: "## ", after: "", placeholder: "Titre secondaire", block: true },
    { label: "H3", title: "Titre 3", before: "### ", after: "", placeholder: "Titre tertiaire", block: true },
    { label: "≡", title: "Centré", before: ":::center\n", after: "\n:::", placeholder: "texte centré" },
    { label: "—", title: "Séparateur", before: "\n---\n", after: "", placeholder: "", separator: true },
    { label: "•", title: "Liste à puces", before: "- ", after: "", placeholder: "élément", block: true },
    { label: "1.", title: "Liste numérotée", before: "1. ", after: "", placeholder: "élément", block: true },
    { label: "[ ]", title: "Case à cocher", before: "- [ ] ", after: "", placeholder: "tâche", block: true },
    { label: "> ", title: "Citation", before: "> ", after: "", placeholder: "citation", block: true },
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
        textarea.value.substring(0, start) +
        before +
        selected +
        after +
        textarea.value.substring(end);

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    nativeInputValueSetter.call(textarea, newValue);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    const cursorPos = start + before.length + selected.length + after.length;
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
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
                    onClick={() => {
                        if (!textareaRef.current) return;
                        insertAtCursor(textareaRef.current, action.before, action.after, action.placeholder);
                    }}
                >
                    {action.label}
                </button>
            ))}
        </div>
    );
}

export default function CustomPageCreatePage() {
    const navigate = useNavigate();
    const contentRef = useRef(null);

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

    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [selectedRankIds, setSelectedRankIds] = useState([]);

    const { data: chatData, isLoading: isLoadingChat, isError: isErrorChat } = useQuery({
        queryKey: ["company", "usersRanksForChat"],
        queryFn: () => getUsersAndRanksForChat(),
    });

    const companyUsers = chatData?.users || [];
    const companyRanks = chatData?.ranks || [];

    const payload = useMemo(() => {
        const base = {
            type,
            title: String(title || "").trim(),
            slug: String(slug || "").trim() || undefined,
            isPublic: Boolean(isPublic),
            showInSidebar: Boolean(showInSidebar),
            navTitle: String(navTitle || "").trim() || null,
            navIcon: String(navIcon || "").trim() || null,
            navOrder: Number(navOrder) || 0,
            navGroup: String(navGroup || "").trim() || null,
            accessUserIds: selectedUserIds,
            accessRankIds: selectedRankIds,
        };
        if (type === "CUSTOM") return { ...base, content: String(content ?? "") };
        return { ...base, iframeUrl: String(iframeUrl ?? "") };
    }, [type, title, slug, isPublic, showInSidebar, navTitle, navIcon, navOrder, navGroup, selectedUserIds, selectedRankIds, content, iframeUrl]);

    const createMutation = useMutation({
        mutationFn: async () => createCustomPage(payload),
        onSuccess: (created) => {
            toast.success("Page créée");
            navigate(`/dashboard/custom-pages/${created.id}/edit`);
        },
        onError: (e) => toast.error(e?.response?.data?.message || e?.message || "Erreur création"),
    });

    function validateBeforeCreate() {
        if (!String(title || "").trim()) {
            toast.error("Le titre est requis");
            return false;
        }
        if (type === "IFRAME") {
            const url = String(iframeUrl || "").trim();
            if (!url) { toast.error("iframeUrl est requis pour une page IFRAME"); return false; }
            if (!/^https?:\/\//i.test(url)) { toast.error("iframeUrl doit commencer par http:// ou https://"); return false; }
        }
        return true;
    }

    return (
        <div className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-white">Créer une page</h1>
                    <p className="text-sm text-slate-300">
                        Crée une page CUSTOM (contenu markdown) ou IFRAME (URL externe).
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link
                        to="/dashboard/custom-pages"
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm"
                    >
                        Retour
                    </Link>
                    <button
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
                        disabled={createMutation.isPending}
                        onClick={() => { if (!validateBeforeCreate()) return; createMutation.mutate(); }}
                    >
                        Créer
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* LEFT — Paramètres */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-4">
                        <div className="text-sm font-semibold text-slate-100">Paramètres</div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="space-y-1">
                                <div className="text-xs text-slate-300">Type</div>
                                <select
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                                    value={type}
                                    onChange={(e) => {
                                        const next = e.target.value;
                                        setType(next);
                                        if (next === "CUSTOM") setIframeUrl("");
                                        else setContent("");
                                    }}
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
                                    placeholder="Ex: Règlement intérieur"
                                />
                            </label>

                            <label className="space-y-1">
                                <div className="text-xs text-slate-300">Slug (optionnel)</div>
                                <input
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    placeholder="Ex: reglement-interieur"
                                />
                                <div className="text-[11px] text-slate-400">
                                    Si vide, le backend génère un slug unique basé sur le titre.
                                </div>
                            </label>

                            <label className="flex items-center gap-2 mt-6">
                                <input
                                    type="checkbox"
                                    checked={isPublic}
                                    onChange={(e) => setIsPublic(e.target.checked)}
                                />
                                <span className="text-sm text-slate-200">Public (dans l'entreprise)</span>
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
                                        placeholder="Ex: Règlement"
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
                                        placeholder="Ex: Gestion"
                                    />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Éditeur markdown */}
                    {type === "CUSTOM" && (
                        <div className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden">
                            {/* Header avec onglets */}
                            <div className="flex items-center justify-between px-4 pt-3 pb-0 border-b border-slate-700">
                                <div className="text-sm font-semibold text-slate-100">Contenu (Markdown)</div>
                                <div className="flex">
                                    <button
                                        type="button"
                                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                                            !previewMode
                                                ? "border-indigo-500 text-indigo-400"
                                                : "border-transparent text-slate-400 hover:text-slate-200"
                                        }`}
                                        onClick={() => setPreviewMode(false)}
                                    >
                                        <PenLine size={13} /> Éditer
                                    </button>
                                    <button
                                        type="button"
                                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                                            previewMode
                                                ? "border-indigo-500 text-indigo-400"
                                                : "border-transparent text-slate-400 hover:text-slate-200"
                                        }`}
                                        onClick={() => setPreviewMode(true)}
                                    >
                                        <Eye size={13} /> Aperçu
                                    </button>
                                </div>
                            </div>

                            {/* Mode édition */}
                            {!previewMode && (
                                <div className="p-4 space-y-2">
                                    <MarkdownToolbar textareaRef={contentRef} />
                                    <textarea
                                        ref={contentRef}
                                        rows={18}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-b-lg px-3 py-2 text-slate-100 font-mono text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder={"# Titre de la page\n\nÉcris ton contenu en markdown ici.\n\n:::center\nTexte centré\n:::"}
                                        style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
                                    />
                                    <div className="text-[11px] text-slate-400">
                                        Supporte Markdown — titres, gras, italique, listes, liens, blocs de code, <code className="bg-slate-800 px-1 rounded">:::center</code> pour centrer.
                                    </div>
                                </div>
                            )}

                            {/* Mode aperçu */}
                            {previewMode && (
                                <div className="p-5 min-h-[200px]">
                                    {content.trim() ? (
                                        <div className="prose prose-slate prose-invert max-w-none prose-headings:text-slate-100 prose-p:text-slate-100 prose-strong:text-slate-100 prose-em:text-slate-100 prose-li:text-slate-100 prose-blockquote:text-slate-100 prose-a:text-indigo-300 hover:prose-a:text-indigo-200 prose-code:text-slate-100 prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-hr:border-slate-700 prose-table:text-slate-100 prose-th:text-slate-100 prose-td:text-slate-100">
                                            <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
                                                {content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <div className="text-slate-500 text-sm italic">Aucun contenu à prévisualiser.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT — Brouillon IFRAME + Accès */}
                <div className="space-y-4">
                    {type === "IFRAME" && (
                        <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-3">
                            <div className="text-sm font-semibold text-slate-100">URL externe</div>
                            <label className="space-y-1 block">
                                <div className="text-xs text-slate-300">iframeUrl</div>
                                <input
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                                    value={iframeUrl}
                                    onChange={(e) => setIframeUrl(e.target.value)}
                                    placeholder="https://…"
                                />
                            </label>
                        </div>
                    )}

                    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-3">
                        <div className="text-sm font-semibold text-slate-100">Accès (si non public)</div>

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

                                {isPublic && (
                                    <div className="text-xs text-slate-400">
                                        Public activé — les règles d'accès (users/ranks) ne sont pas utilisées.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
