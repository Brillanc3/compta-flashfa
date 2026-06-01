// /frontend/src/components/contracts/MarkdownToolbar.jsx

import React from "react";
import {
    Bold,
    Italic,
    Heading1,
    List,
    ListOrdered,
    Quote,
} from "lucide-react";

/**
 * Toolbar Markdown officielle :
 *  - Gras
 *  - Italique
 *  - Titre H1
 *  - Liste
 *  - Liste numérotée
 *  - Citation
 *
 * Elle déclenche simplement onAction("bold"), etc.
 * La logique d'insertion est gérée dans ContractTemplateEditor.jsx
 */

export default function MarkdownToolbar({ onAction }) {
    const btn =
        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs " +
        "bg-slate-800/80 border border-slate-700 text-slate-200 " +
        "hover:bg-slate-700 active:scale-95 transition";

    return (
        <div className="flex flex-wrap gap-2 bg-slate-900/80 border border-slate-700 rounded-lg px-2 py-2">

            {/* GRAS */}
            <button
                type="button"
                className={btn}
                onClick={() => onAction?.("bold")}
                title="Gras (**texte**)"
            >
                <Bold size={14} />
                <span>Gras</span>
            </button>

            {/* ITALIQUE */}
            <button
                type="button"
                className={btn}
                onClick={() => onAction?.("italic")}
                title="Italique (*texte*)"
            >
                <Italic size={14} />
                <span>Italique</span>
            </button>

            {/* TITRE H1 */}
            <button
                type="button"
                className={btn}
                onClick={() => onAction?.("h1")}
                title="# Titre"
            >
                <Heading1 size={14} />
                <span>H1</span>
            </button>

            {/* LISTE */}
            <button
                type="button"
                className={btn}
                onClick={() => onAction?.("ul")}
                title="- élément"
            >
                <List size={14} />
                <span>Liste</span>
            </button>

            {/* LISTE NUMÉROTÉE */}
            <button
                type="button"
                className={btn}
                onClick={() => onAction?.("ol")}
                title="1. élément"
            >
                <ListOrdered size={14} />
                <span>Numérotée</span>
            </button>

            {/* CITATION */}
            <button
                type="button"
                className={btn}
                onClick={() => onAction?.("quote")}
                title="> Citation"
            >
                <Quote size={14} />
                <span>Citation</span>
            </button>

        </div>
    );
}
