// frontend/src/components/dashboard/widgets/SendNotificationWidget.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Select from "react-select";

import {
    Send,
    Users,
    User,
    ShieldCheck,
    Bold,
    Italic,
    Strikethrough,
    List,
    Link as LinkIcon,
    ChevronDown,
} from "lucide-react";

/* -------------------- SLATE (same pattern as ChatInput) -------------------- */
import { createEditor, Editor, Node, Range, Text, Transforms } from "slate";
import { Slate, Editable, ReactEditor, withReact } from "slate-react";
import { withHistory } from "slate-history";
/* -------------------------------------------------------------------------- */

import { getUsersAndRanksForChat } from "@/services/companyService";
import { sendNotification } from "@/services/notificationService";
import { useCompany } from "@/contexts/CompanyContext";

/* -------------------------------------------------------------------------- */
/* SLATE DEFAULTS / HELPERS                                                   */
/* -------------------------------------------------------------------------- */

const EMPTY_VALUE = [{ type: "paragraph", children: [{ text: "" }] }];

function safeValue(v) {
    return Array.isArray(v) && v.length > 0 ? v : EMPTY_VALUE;
}

function serialize(value) {
    const v = safeValue(value);
    return v.map((n) => Node.string(n)).join("\n");
}

function isHotkey(e, combo) {
    const key = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const alt = e.altKey;
    const shift = e.shiftKey;

    if (combo === "ctrl+b") return ctrl && !alt && !shift && key === "b";
    if (combo === "ctrl+i") return ctrl && !alt && !shift && key === "i";
    if (combo === "ctrl+shift+x") return ctrl && !alt && shift && key === "x";
    if (combo === "ctrl+k") return ctrl && !alt && !shift && key === "k";
    return false;
}

function wrapWithToken(editor, token) {
    const sel = editor.selection;
    if (!sel) return;

    if (Range.isCollapsed(sel)) {
        Transforms.insertText(editor, token + token);
        Transforms.move(editor, { distance: token.length, unit: "character", reverse: true });
        return;
    }

    const [start, end] = Range.edges(sel);
    Transforms.insertText(editor, token, { at: end });
    Transforms.insertText(editor, token, { at: start });
}

/* -------------------------------------------------------------------------- */
/* SLATE RENDER                                                               */
/* -------------------------------------------------------------------------- */

function Element({ attributes, children }) {
    return (
        <div {...attributes} className="whitespace-pre-wrap break-words">
            {children}
        </div>
    );
}

// Optional: keep minimal styling. We are not using decorateMarkdown here because we are inserting tokens.
function Leaf({ attributes, children, leaf }) {
    // If you later add decorateMarkdown, you can color syntax etc.
    let className = "text-cca-textPrimary";
    if (leaf.bold) className += " font-semibold";
    if (leaf.italic) className += " italic";
    if (leaf.strike) className += " line-through";

    return (
        <span {...attributes} className={className}>
            {children}
        </span>
    );
}

/* -------------------------------------------------------------------------- */
/* SELECT STYLES                                                              */
/* -------------------------------------------------------------------------- */

const selectStyles = {
    control: (styles) => ({
        ...styles,
        backgroundColor: "rgb(var(--bg-base-rgb) / 0.4)",
        borderColor: "rgb(var(--border-color-rgb) / 0.2)",
        minHeight: 40,
        boxShadow: 'none',
        '&:hover': {
            borderColor: "rgb(var(--brand-primary-rgb) / 0.5)",
        }
    }),
    menu: (styles) => ({ ...styles, backgroundColor: "rgb(var(--bg-surface-rgb))", border: "1px solid rgb(var(--border-color-rgb) / 0.2)" }),
    option: (styles, { isFocused }) => ({
        ...styles,
        backgroundColor: isFocused ? "rgb(var(--brand-primary-rgb) / 0.2)" : "transparent",
        color: "rgb(var(--text-primary-rgb))",
        '&:active': {
            backgroundColor: "rgb(var(--brand-primary-rgb) / 0.4)",
        }
    }),
    multiValue: (styles) => ({ ...styles, backgroundColor: "rgb(var(--brand-primary-rgb) / 0.2)", borderRadius: '6px' }),
    multiValueLabel: (styles) => ({ ...styles, color: "rgb(var(--text-primary-rgb))" }),
    singleValue: (styles) => ({ ...styles, color: "rgb(var(--text-primary-rgb))" }),
    input: (styles) => ({ ...styles, color: "rgb(var(--text-primary-rgb))" }),
    multiValueRemove: (styles) => ({
        ...styles,
        color: "rgb(var(--text-secondary-rgb))",
        '&:hover': {
            backgroundColor: 'transparent',
            color: "rgb(var(--brand-primary-rgb))",
        }
    }),
};

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function SendNotificationWidget() {
    const { activeCompany, activeCompanyId } = useCompany();

    const editor = useMemo(() => withHistory(withReact(createEditor())), []);

    // Same pattern as ChatInput: keep state for serialization, but provide initialValue and remount with key.
    const [value, setValue] = useState(EMPTY_VALUE);
    const [slateKey, setSlateKey] = useState(0);

    const [ranks, setRanks] = useState([]);
    const [users, setUsers] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // Targeting
    const [targetType, setTargetType] = useState("ALL"); // ALL | RANKS | USERS
    const [selectedRanks, setSelectedRanks] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);

    // Compact: collapse target selector on mobile
    const [targetOpen, setTargetOpen] = useState(false);

    // Form
    const [title, setTitle] = useState("");
    const [behavior, setBehavior] = useState("PERMANENT");
    const [submitting, setSubmitting] = useState(false);

    const text = useMemo(() => serialize(value), [value]);
    const canSend = title.trim().length > 0 && text.trim().length > 0;

    /* ------------------------------------------------------------------ */
    /* LOAD USERS + RANKS                                                  */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
        if (!activeCompanyId) return;

        (async () => {
            setLoadingData(true);
            try {
                const data = await getUsersAndRanksForChat(); // no params
                setRanks(data?.ranks || []);
                setUsers(data?.users || []);
            } catch (err) {
                console.error("[SendNotificationWidget] load error", err);
                toast.error("Impossible de charger les employés et les rangs.");
            } finally {
                setLoadingData(false);
            }
        })();
    }, [activeCompanyId]);

    // When company changes: reset content + remount slate (same as ChatInput channel change)
    useEffect(() => {
        setValue(EMPTY_VALUE);
        setTitle("");
        setSelectedRanks([]);
        setSelectedUsers([]);
        setTargetType("ALL");
        setSlateKey((k) => k + 1);
    }, [activeCompanyId]);

    // Focus when (re)mounted (same as ChatInput)
    useEffect(() => {
        requestAnimationFrame(() => {
            try {
                ReactEditor.focus(editor);
            } catch (_) { /* empty */ }
        });
    }, [editor, slateKey]);

    /* ------------------------------------------------------------------ */
    /* OPTIONS                                                             */
    /* ------------------------------------------------------------------ */

    const rankOptions = useMemo(
        () =>
            ranks.map((r) => ({
                value: r.id,
                label: `${r.name} (${r.membersCount})`,
            })),
        [ranks]
    );

    const userOptions = useMemo(
        () =>
            users.map((u) => ({
                value: u.userId,
                label: u.fullName,
            })),
        [users]
    );

    /* ------------------------------------------------------------------ */
    /* VALIDATION                                                          */
    /* ------------------------------------------------------------------ */

    const targetsValid = useMemo(() => {
        if (targetType === "ALL") return true;
        if (targetType === "RANKS") return selectedRanks.length > 0;
        if (targetType === "USERS") return selectedUsers.length > 0;
        return false;
    }, [targetType, selectedRanks, selectedUsers]);

    const isFormValid = canSend && targetsValid;

    /* ------------------------------------------------------------------ */
    /* SEND                                                                */
    /* ------------------------------------------------------------------ */

    const buildTargets = () => {
        if (targetType === "ALL") return [{ type: "ALL" }];
        if (targetType === "RANKS") return [{ type: "RANKS", ids: selectedRanks.map((r) => r.value) }];
        if (targetType === "USERS") return [{ type: "USERS", ids: selectedUsers.map((u) => u.value) }];
        return [];
    };

    const resetForm = useCallback(() => {
        setTitle("");
        setValue(EMPTY_VALUE);
        setSelectedRanks([]);
        setSelectedUsers([]);
        setTargetType("ALL");
        setTargetOpen(false);
        setSlateKey((k) => k + 1);
    }, []);

    const submit = useCallback(async () => {
        if (!isFormValid || submitting) return;

        try {
            setSubmitting(true);

            await sendNotification({
                targets: buildTargets(),
                content: { title: title.trim(), body: text }, // backend unchanged
                behavior,
            });

            toast.success("Notification envoyée");
            resetForm();
        } catch (err) {
            toast.error(err?.response?.data?.message || "Erreur lors de l’envoi");
        } finally {
            setSubmitting(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFormValid, submitting, title, text, behavior, resetForm, targetType, selectedRanks, selectedUsers]);

    /* ------------------------------------------------------------------ */
    /* SLATE KEYDOWN (same philosophy as ChatInput)                         */
    /* ------------------------------------------------------------------ */

    const onKeyDown = useCallback(
        (e) => {
            if (e.isComposing || e.nativeEvent?.isComposing) return;

            // Shift+Enter => newline (default)
            // Enter alone => send (like chat), but keep it optional for widget:
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                // In widget, sending on Enter is generally OK; if you prefer Ctrl+Enter, change here.
                e.preventDefault();
                submit();
                return;
            }

            // Formatting hotkeys
            if (isHotkey(e, "ctrl+b")) {
                e.preventDefault();
                wrapWithToken(editor, "**");
                return;
            }
            if (isHotkey(e, "ctrl+i")) {
                e.preventDefault();
                wrapWithToken(editor, "*");
                return;
            }
            if (isHotkey(e, "ctrl+shift+x")) {
                e.preventDefault();
                wrapWithToken(editor, "~~");
                return;
            }
            if (isHotkey(e, "ctrl+k")) {
                e.preventDefault();
                wrapWithToken(editor, "`");
                return;
            }
        },
        [editor, submit]
    );

    /* ------------------------------------------------------------------ */
    /* UI HELPERS                                                           */
    /* ------------------------------------------------------------------ */

    const insertList = () => {
        // Insert "- " at line start; simple and effective
        Transforms.insertText(editor, "\n- ");
        requestAnimationFrame(() => {
            try {
                ReactEditor.focus(editor);
            } catch (_) { /* empty */ }
        });
    };

    const insertLinkTemplate = () => {
        // Minimal template
        wrapWithToken(editor, "[");
        // Note: wrapWithToken inserts "[][]" when collapsed; not ideal. We'll do a cleaner insertion:
        // We'll replace selection with [texte](url)
        const sel = editor.selection;
        if (!sel) return;

        if (Range.isCollapsed(sel)) {
            Transforms.insertText(editor, "[texte](url)");
            Transforms.move(editor, { distance: 4, unit: "character", reverse: true });
            return;
        }

        const selected = Editor.string(editor, sel);
        Transforms.delete(editor);
        Transforms.insertText(editor, `[${selected}](url)`);
    };

    if (!activeCompany) {
        return <div className="p-4 text-center text-cca-textSecondary/60 italic">Aucune entreprise sélectionnée.</div>;
    }

    if (loadingData) {
        return <div className="p-4 text-center text-cca-textSecondary/60 italic">Chargement…</div>;
    }

    return (
        <div className="bg-transparent text-cca-textPrimary rounded-lg h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-cca-border/20">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-black uppercase tracking-tight">
                            Diffuser une Alerte
                        </h3>
                        <p className="text-[10px] text-cca-textSecondary font-bold uppercase tracking-tighter opacity-50">
                            {activeCompany.name}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setTargetOpen((v) => !v)}
                        className="sm:hidden flex items-center gap-2 px-3 py-2 rounded-md bg-cca-base/40 border border-cca-border/20 text-xs font-bold"
                        title="Choisir les destinataires"
                    >
                        Cible <ChevronDown size={14} className={targetOpen ? "rotate-180 transition" : "transition"} />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col gap-3 flex-1 min-h-0">
                {/* Target selector (desktop always visible, mobile collapsible) */}
                <div className={`${targetOpen ? "block" : "hidden"} sm:block`}>
                    <label className="text-[10px] uppercase font-black text-cca-textSecondary/40 mb-1 block">Ciblage Destinataires</label>

                    <div className="grid grid-cols-3 gap-1 bg-cca-base/40 p-1 rounded-lg border border-cca-border/20">
                        {[
                            ["ALL", "Tous", <Users size={14} />],
                            ["RANKS", "Rangs", <ShieldCheck size={14} />],
                            ["USERS", "Privé", <User size={14} />],
                        ].map(([k, l, icon]) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => {
                                    setTargetType(k);
                                    setSelectedRanks([]);
                                    setSelectedUsers([]);
                                }}
                                className={`flex items-center justify-center gap-2 py-2 rounded text-[11px] font-bold uppercase transition-all ${
                                    targetType === k ? "bg-brand-primary text-white shadow-lg" : "text-cca-textSecondary hover:bg-cca-surface/20"
                                }`}
                            >
                                {icon} <span className="hidden sm:inline">{l}</span>
                                <span className="sm:hidden">{l}</span>
                            </button>
                        ))}
                    </div>

                    {targetType === "RANKS" && (
                        <div className="mt-2">
                            <Select
                                isMulti
                                options={rankOptions}
                                value={selectedRanks}
                                onChange={setSelectedRanks}
                                styles={selectStyles}
                                placeholder="Sélectionner des rangs…"
                            />
                        </div>
                    )}

                    {targetType === "USERS" && (
                        <div className="mt-2">
                            <Select
                                isMulti
                                options={userOptions}
                                value={selectedUsers}
                                onChange={setSelectedUsers}
                                styles={selectStyles}
                                placeholder="Sélectionner des employés…"
                            />
                        </div>
                    )}
                </div>

                {/* Title */}
                <div>
                    <label className="text-[10px] uppercase font-black text-cca-textSecondary/40 mb-1 block">Sujet de l'Alerte</label>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Quoi de neuf ?"
                        className="w-full bg-cca-base/40 border border-cca-border/20 rounded-lg px-3 py-2 text-xs text-cca-textPrimary outline-none focus:ring-1 focus:ring-brand-primary placeholder:text-cca-textSecondary/30 transition-all font-bold"
                    />
                </div>

                {/* Editor + toolbar (compact) */}
                <div className="flex flex-col min-h-0">
                    <div className="flex items-center justify-between gap-2">
                        <label className="text-[10px] uppercase font-black text-cca-textSecondary/40">Contenu du Message</label>
                        <div className="text-[9px] text-cca-textSecondary/30 font-black uppercase hidden sm:block">
                            ENTER = TRANSMETTRE · SHIFT+ENTER = LIGNE
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="mt-2 flex flex-wrap gap-1 p-1 rounded-lg bg-cca-base/60 border border-cca-border/20 backdrop-blur-md">
                        <button type="button" onClick={() => wrapWithToken(editor, "**")} className="p-2 rounded hover:bg-cca-surface/30 text-cca-textSecondary hover:text-cca-textPrimary transition-all" title="Gras (Ctrl+B)">
                            <Bold size={14} />
                        </button>
                        <button type="button" onClick={() => wrapWithToken(editor, "*")} className="p-2 rounded hover:bg-cca-surface/30 text-cca-textSecondary hover:text-cca-textPrimary transition-all" title="Italique (Ctrl+I)">
                            <Italic size={14} />
                        </button>
                        <button type="button" onClick={() => wrapWithToken(editor, "~~")} className="p-2 rounded hover:bg-cca-surface/30 text-cca-textSecondary hover:text-cca-textPrimary transition-all" title="Barré (Ctrl+Shift+X)">
                            <Strikethrough size={14} />
                        </button>
                        <button type="button" onClick={() => wrapWithToken(editor, "`")} className="p-2 rounded hover:bg-cca-surface/30 text-cca-textSecondary hover:text-cca-textPrimary transition-all" title="Code (Ctrl+K)">
                            <span className="text-xs font-black tracking-tighter">{`</>`}</span>
                        </button>
                        <button type="button" onClick={insertList} className="p-2 rounded hover:bg-cca-surface/30 text-cca-textSecondary hover:text-cca-textPrimary transition-all" title="Liste">
                            <List size={14} />
                        </button>
                        <button type="button" onClick={insertLinkTemplate} className="p-2 rounded hover:bg-cca-surface/30 text-cca-textSecondary hover:text-cca-textPrimary transition-all" title="Lien">
                            <LinkIcon size={14} />
                        </button>
                    </div>

                    {/* Slate input (same initialValue pattern) */}
                    <div className="mt-2 flex-1 min-h-[96px]">
                        <Slate
                            key={slateKey}
                            editor={editor}
                            initialValue={safeValue(value)}
                            onChange={(v) => setValue(safeValue(v))}
                        >
                            <Editable
                                placeholder="Instructions de diffusion…"
                                className="
                                    w-full h-full
                                    bg-cca-base/40 border border-cca-border/20
                                    rounded-lg px-3 py-2
                                    text-xs leading-5 italic
                                    text-cca-textPrimary
                                    outline-none
                                    max-h-40 overflow-y-auto
                                    whitespace-pre-wrap break-words
                                    focus:ring-1 focus:ring-brand-primary/30
                                    transition-all
                                "
                                spellCheck
                                autoCorrect="off"
                                renderLeaf={(props) => <Leaf {...props} />}
                                renderElement={(props) => <Element {...props} />}
                                onKeyDown={onKeyDown}
                            />
                        </Slate>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-cca-border/20 flex items-center justify-between gap-3 bg-cca-base/20">
                <select
                    value={behavior}
                    onChange={(e) => setBehavior(e.target.value)}
                    className="bg-cca-base/60 border border-cca-border/20 rounded-lg px-3 py-2 text-[11px] font-bold uppercase text-cca-textPrimary outline-none focus:ring-1 focus:ring-brand-primary/40"
                >
                    <option value="PERMANENT">PERMANENT</option>
                    <option value="TEMPORARY">TEMPORAIRE</option>
                    <option value="BLOCKING">URGENCE MAX</option>
                </select>

                <button
                    type="button"
                    onClick={submit}
                    disabled={!isFormValid || submitting}
                    className={`
                        flex items-center gap-2
                        px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest
                        transition-all shadow-xl
                        ${
                        isFormValid && !submitting
                            ? "bg-brand-primary text-white hover:bg-brand-light hover:scale-105 active:scale-95"
                            : "bg-cca-base/40 text-cca-textSecondary/30 cursor-not-allowed border border-cca-border/10"
                    }
                    `}
                    title="Envoyer"
                >
                    <Send size={14} />
                    DIFFUSER
                </button>
            </div>
        </div>
    );
}
