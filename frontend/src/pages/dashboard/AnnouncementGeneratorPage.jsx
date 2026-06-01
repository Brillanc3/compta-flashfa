import React, { useState, useRef, useCallback } from "react";
import { Copy, Check, RotateCcw, Megaphone, Type } from "lucide-react";
import toast from "react-hot-toast";

const FIVEM_COLORS = [
    { code: "~r~", label: "Rouge",      hex: "#FF4444" },
    { code: "~b~", label: "Bleu",       hex: "#4488FF" },
    { code: "~g~", label: "Vert",       hex: "#44EE44" },
    { code: "~y~", label: "Jaune",      hex: "#FFEE44" },
    { code: "~o~", label: "Orange",     hex: "#FFAA33" },
    { code: "~p~", label: "Violet",     hex: "#BB55FF" },
    { code: "~w~", label: "Blanc",      hex: "#FFFFFF" },
    { code: "~s~", label: "Défaut",     hex: "#AAAAAA" },
    { code: "~m~", label: "Gris moyen", hex: "#999999" },
    { code: "~c~", label: "Gris",       hex: "#777777" },
    { code: "~u~", label: "Gris foncé", hex: "#555555" },
    { code: "~l~", label: "Noir",       hex: "#1A1A1A" },
];

const FIVEM_FORMATS = [
    { code: "~h~", label: "Gras",           shortLabel: "G" },
    { code: "~n~", label: "Saut de ligne",   shortLabel: "↵" },
    { code: "~z~", label: "Reset couleur",   shortLabel: "✕" },
];

const MAX_CHARS = 256;
const MAX_EMOJIS = 3;

function countChars(text) {
    return [...text].length;
}

function countEmojis(text) {
    return (text.match(/\p{Extended_Pictographic}/gu) || []).length;
}

const COLOR_MAP = {
    r: "#FF4444",
    b: "#4488FF",
    g: "#44EE44",
    y: "#FFEE44",
    o: "#FFAA33",
    p: "#BB55FF",
    w: "#FFFFFF",
    s: "#AAAAAA",
    m: "#999999",
    c: "#777777",
    u: "#555555",
    l: "#1A1A1A",
};

function renderPreview(text) {
    const parts = [];
    const regex = /~([a-zA-Z]+)~/g;
    let lastIndex = 0;
    let currentColor = "#FFFFFF";
    let isBold = false;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ text: text.slice(lastIndex, match.index), color: currentColor, bold: isBold });
        }
        lastIndex = regex.lastIndex;

        const code = match[1].toLowerCase();
        if (code === "n") {
            parts.push({ newline: true });
        } else if (code === "h") {
            isBold = true;
        } else if (code === "z") {
            isBold = false;
            currentColor = "#FFFFFF";
        } else if (COLOR_MAP[code]) {
            currentColor = COLOR_MAP[code];
        }
    }

    if (lastIndex < text.length) {
        parts.push({ text: text.slice(lastIndex), color: currentColor, bold: isBold });
    }

    return parts;
}

export default function AnnouncementGeneratorPage() {
    const [text, setText] = useState("");
    const [copied, setCopied] = useState(false);
    const textareaRef = useRef(null);

    const insertAtCursor = useCallback((code) => {
        const el = textareaRef.current;
        if (!el) return;

        const start = el.selectionStart;
        const end = el.selectionEnd;
        const newText = text.slice(0, start) + code + text.slice(end);
        setText(newText);

        requestAnimationFrame(() => {
            el.focus();
            const pos = start + code.length;
            el.setSelectionRange(pos, pos);
        });
    }, [text]);

    const handleCopy = useCallback(() => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            toast.success("Annonce copiée !");
            setTimeout(() => setCopied(false), 2000);
        });
    }, [text]);

    const handleReset = useCallback(() => {
        setText("");
        textareaRef.current?.focus();
    }, []);

    const visibleChars = countChars(text);
    const emojiCount = countEmojis(text);
    const charsOver = visibleChars > MAX_CHARS;
    const emojisOver = emojiCount > MAX_EMOJIS;
    const hasErrors = charsOver || emojisOver;

    const preview = renderPreview(text);

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20">
                    <Megaphone className="w-5 h-5 text-brand-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-cca-textPrimary">Générateur d'annonce</h1>
                    <p className="text-sm text-cca-textSecondary">Codes couleurs FiveM — aperçu en temps réel</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: editor */}
                <div className="space-y-4">
                    {/* Color palette */}
                    <div className="bg-cca-surface border border-cca-border rounded-xl p-4 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-cca-textSecondary">Couleurs</p>
                        <div className="flex flex-wrap gap-2">
                            {FIVEM_COLORS.map((c) => (
                                <button
                                    key={c.code}
                                    type="button"
                                    title={`${c.label} (${c.code})`}
                                    onClick={() => insertAtCursor(c.code)}
                                    className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cca-border hover:border-brand-primary/40 bg-cca-base hover:bg-brand-primary/5 transition-all text-xs text-cca-textSecondary hover:text-cca-textPrimary active:scale-95"
                                >
                                    <span
                                        className="w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0"
                                        style={{ backgroundColor: c.hex }}
                                    />
                                    <span className="font-mono">{c.code}</span>
                                </button>
                            ))}
                        </div>

                        <p className="text-xs font-semibold uppercase tracking-widest text-cca-textSecondary pt-1">Formatage</p>
                        <div className="flex gap-2">
                            {FIVEM_FORMATS.map((f) => (
                                <button
                                    key={f.code}
                                    type="button"
                                    title={`${f.label} (${f.code})`}
                                    onClick={() => insertAtCursor(f.code)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cca-border hover:border-brand-primary/40 bg-cca-base hover:bg-brand-primary/5 transition-all text-xs text-cca-textSecondary hover:text-cca-textPrimary active:scale-95"
                                >
                                    <span className="font-mono font-bold">{f.shortLabel}</span>
                                    <span>{f.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Textarea */}
                    <div className="bg-cca-surface border border-cca-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-widest text-cca-textSecondary">Texte brut</p>
                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={!text}
                                className="flex items-center gap-1 text-xs text-cca-textSecondary hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Réinitialiser
                            </button>
                        </div>
                        <textarea
                            ref={textareaRef}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Tapez votre annonce ou cliquez sur les codes couleurs…"
                            rows={6}
                            className={`w-full bg-cca-base border rounded-lg px-3 py-2.5 text-sm font-mono text-cca-textPrimary placeholder:text-cca-textSecondary/50 focus:outline-none resize-y transition-colors ${hasErrors ? "border-red-500/60 focus:border-red-500" : "border-cca-border focus:border-brand-primary/50"}`}
                        />
                        <div className="flex items-center justify-between text-xs">
                            <span className={`font-mono ${emojisOver ? "text-red-400 font-semibold" : "text-cca-textSecondary"}`}>
                                Émojis : {emojiCount}/{MAX_EMOJIS}
                                {emojisOver && " — trop d'émojis"}
                            </span>
                            <span className={`font-mono tabular-nums ${charsOver ? "text-red-400 font-semibold" : visibleChars > MAX_CHARS * 0.85 ? "text-amber-400" : "text-cca-textSecondary"}`}>
                                {visibleChars}/{MAX_CHARS}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleCopy}
                            disabled={!text || hasErrors}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary/90 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? "Copié !" : "Copier l'annonce"}
                        </button>
                    </div>
                </div>

                {/* Right: preview */}
                <div className="space-y-4">
                    <div className="bg-cca-surface border border-cca-border rounded-xl p-4 space-y-3 h-full">
                        <p className="text-xs font-semibold uppercase tracking-widest text-cca-textSecondary">Aperçu FiveM</p>
                        <div className="bg-black rounded-xl p-5 min-h-[200px] font-mono text-sm leading-relaxed">
                            {preview.length > 0 ? (
                                <span>
                                    {preview.map((part, i) => {
                                        if (part.newline) return <br key={i} />;
                                        return (
                                            <span
                                                key={i}
                                                style={{
                                                    color: part.color,
                                                    fontWeight: part.bold ? "bold" : "normal",
                                                }}
                                            >
                                                {part.text}
                                            </span>
                                        );
                                    })}
                                </span>
                            ) : (
                                <span className="text-gray-600">L'aperçu apparaît ici…</span>
                            )}
                        </div>

                        {/* Cheat sheet */}
                        <div className="pt-2 border-t border-cca-border">
                            <p className="text-xs font-semibold uppercase tracking-widest text-cca-textSecondary mb-2">Référence rapide</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                {FIVEM_COLORS.map((c) => (
                                    <div key={c.code} className="flex items-center gap-2 text-xs">
                                        <span className="font-mono text-cca-textSecondary w-10">{c.code}</span>
                                        <span
                                            className="font-medium"
                                            style={{ color: c.hex === "#1A1A1A" ? "#888" : c.hex }}
                                        >
                                            {c.label}
                                        </span>
                                    </div>
                                ))}
                                {FIVEM_FORMATS.map((f) => (
                                    <div key={f.code} className="flex items-center gap-2 text-xs">
                                        <span className="font-mono text-cca-textSecondary w-10">{f.code}</span>
                                        <span className="text-cca-textSecondary">{f.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
