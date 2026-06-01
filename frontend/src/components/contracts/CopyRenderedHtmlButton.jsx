// /frontend/src/components/contracts/CopyRenderedHtmlButton.jsx

import { Copy } from "lucide-react";
import toast from "react-hot-toast";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { renderToString } from "react-dom/server";
import { copyHtml } from "@/utils/clipboard";

export default function CopyRenderedHtmlButton({ markdown }) {

    const copy = async () => {
        try {
            const html = renderHtml(markdown);

            const res = await copyHtml({ html, text: markdown });
            if (res.ok) toast.success("Contenu mis en forme copié !");
            else toast.error("Impossible de copier le rendu.");
        } catch (err) {
            console.error(err);
            toast.error("Impossible de copier le rendu.");
        }
    };

    return (
        <button
            type="button"
            onClick={copy}
            className="px-3 py-1.5 flex items-center gap-2 bg-slate-700 hover:bg-slate-600
                       text-white rounded-md text-sm active:scale-95 transition"
        >
            <Copy size={16} />
            Copier le rendu
        </button>
    );
}

/* ---------------------------------------------------------
   Génère du HTML complet compatible Word
--------------------------------------------------------- */
function renderHtml(markdown) {
    const jsx = (
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: "14px" }}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                    h1: ({ children }) => <h1 style={{ fontSize: "24px", marginBottom: "12px" }}>{children}</h1>,
                    h2: ({ children }) => <h2 style={{ fontSize: "20px", marginBottom: "10px" }}>{children}</h2>,
                    h3: ({ children }) => <h3 style={{ fontSize: "18px", marginBottom: "8px" }}>{children}</h3>,
                    p: ({ children }) => <p style={{ marginBottom: "10px" }}>{children}</p>,
                    li: ({ children }) => <li style={{ marginBottom: "4px" }}>{children}</li>,
                    blockquote: ({ children }) => (
                        <blockquote
                            style={{
                                borderLeft: "4px solid #ccc",
                                paddingLeft: "10px",
                                color: "#555",
                                margin: "10px 0"
                            }}
                        >
                            {children}
                        </blockquote>
                    )
                }}
            >
                {markdown}
            </ReactMarkdown>
        </div>
    );

    return renderToString(jsx);
}
