// frontend/src/components/chat/ChatInput.jsx
import React, { useRef, useState } from "react";
import {
    BoldIcon,
    Italic,
    Underline,
    Code,
    Quote,
    Send,
    Loader2,
} from "lucide-react";

/* -------------------------------------------------------------------
 * ChatInput : zone d’écriture + toolbar Markdown
 * ------------------------------------------------------------------- */
export default function ChatInput({
                                      activeConversation,
                                      pendingText,
                                      setPendingText,
                                      onSend,
                                      aiBusy,
                                      isAIVisible,
                                      selfCanWrite, // false si ticket fermé
                                  }) {
    const textareaRef = useRef(null);

    /* --------------------------------------------------------------
     * Suivi de la sélection pour afficher la mini-toolbar
     * -------------------------------------------------------------- */
    const [selection, setSelection] = useState({
        start: 0,
        end: 0,
    });

    const updateSelection = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        setSelection({
            start: ta.selectionStart,
            end: ta.selectionEnd,
        });
    };

    const hasSelection = selection.end > selection.start;

    /* --------------------------------------------------------------
     * Fonction d'insertion Markdown
     * -------------------------------------------------------------- */
    const wrapSelection = (before, after, placeholder = "") => {
        const ta = textareaRef.current;
        if (!ta) return;

        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? 0;

        const selected = pendingText.slice(start, end) || placeholder;
        const newText =
            pendingText.slice(0, start) +
            before +
            selected +
            after +
            pendingText.slice(end);

        setPendingText(newText);

        // repositionner le curseur
        const caretStart = start + before.length;
        const caretEnd = caretStart + selected.length;

        requestAnimationFrame(() => {
            ta.focus();
            ta.setSelectionRange(caretStart, caretEnd);
            updateSelection();
        });
    };

    /* --------------------------------------------------------------
     * Shortcuts clavier
     * -------------------------------------------------------------- */
    const onKeyDown = (e) => {
        if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "b") {
            e.preventDefault();
            wrapSelection("**", "**");
        }
        if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "i") {
            e.preventDefault();
            wrapSelection("*", "*");
        }
        if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "u") {
            e.preventDefault();
            wrapSelection("__", "__");
        }
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
            e.preventDefault();
            wrapSelection("```\n", "\n```", "code");
        }

        // Envoi avec entrée simple
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (selfCanWrite && (!activeConversation || activeConversation.kind !== "AI" || !aiBusy)) {
                onSend();
            }
        }
    };

    /* --------------------------------------------------------------
     * Placeholder dynamique
     * -------------------------------------------------------------- */
    const resolvedPlaceholder = !activeConversation
        ? ""
        : activeConversation.kind === "AI"
            ? isAIVisible
                ? "Demandez quelque chose à l’Assistant IA…"
                : "Assistant IA indisponible (entreprise requise)"
            : !selfCanWrite
                ? "Ticket fermé — lecture seule"
                : "Écrire un message… (Markdown: **bold**, *italic*, > quote, ```code``` )";

    /* --------------------------------------------------------------
     * Désactivation
     * -------------------------------------------------------------- */
    const disabled =
        !selfCanWrite ||
        (activeConversation?.kind === "AI" && (!isAIVisible || aiBusy));

    /* --------------------------------------------------------------
     * Rendu
     * -------------------------------------------------------------- */
    return (
        <div className="p-3 border-t border-cca-border bg-cca-surface/30 backdrop-blur-xl space-y-2">

            {/* Toolbar sélection */}
            {hasSelection && (
                <div className="
                    inline-flex items-center gap-1 px-2 py-1
                    rounded-lg bg-cca-surface border border-cca-border shadow
                ">
                    <button
                        className="p-1 rounded hover:bg-cca-base text-cca-textSecondary hover:text-cca-textPrimary"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => wrapSelection("**", "**")}
                        title="Gras (Ctrl+B)"
                    >
                        <BoldIcon size={16} />
                    </button>

                    <button
                        className="p-1 rounded hover:bg-cca-base text-cca-textSecondary hover:text-cca-textPrimary"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => wrapSelection("*", "*")}
                        title="Italique (Ctrl+I)"
                    >
                        <Italic size={16} />
                    </button>

                    <button
                        className="p-1 rounded hover:bg-cca-base text-cca-textSecondary hover:text-cca-textPrimary"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => wrapSelection("__", "__")}
                        title="Souligné (Ctrl+U)"
                    >
                        <Underline size={16} />
                    </button>

                    <button
                        className="p-1 rounded hover:bg-cca-base text-cca-textSecondary hover:text-cca-textPrimary"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                            wrapSelection("```\n", "\n```", "code")
                        }
                        title="Code block (Ctrl+Shift+C)"
                    >
                        <Code size={16} />
                    </button>

                    <button
                        className="p-1 rounded hover:bg-cca-base text-cca-textSecondary hover:text-cca-textPrimary"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => wrapSelection("> ", "")}
                        title="Citation"
                    >
                        <Quote size={16} />
                    </button>
                </div>
            )}

            {/* Input + bouton d’envoi */}
            <div className="flex items-end gap-2">
                <textarea
                    ref={textareaRef}
                    className="
                        flex-1 px-3 py-2 rounded-lg
                        bg-cca-base border border-cca-border
                        text-cca-textPrimary outline-none min-h-[44px] max-h-40 resize-y
                        placeholder:text-cca-textSecondary/50
                        disabled:opacity-50
                    "
                    placeholder={resolvedPlaceholder}
                    value={pendingText}
                    onChange={(e) => setPendingText(e.target.value)}
                    onKeyDown={onKeyDown}
                    onSelect={updateSelection}
                    onFocus={updateSelection}
                    rows={1}
                    disabled={disabled}
                />

                <button
                    onClick={onSend}
                    disabled={!pendingText.trim() || disabled}
                    className="
                        px-3 py-2 rounded-lg
                        bg-brand-primary hover:bg-brand-dark
                        text-white disabled:opacity-40
                    "
                    title="Envoyer"
                >
                    {activeConversation?.kind === "AI" && aiBusy ? (
                        <Loader2 className="animate-spin" size={16} />
                    ) : (
                        <Send size={16} />
                    )}
                </button>
            </div>
        </div>
    );
}
