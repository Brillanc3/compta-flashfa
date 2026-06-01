import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { getCustomPageBySlug } from "@/services/customPagesService";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";

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

function isHttpUrl(s) {
    const v = String(s || "").trim();
    return /^https?:\/\//i.test(v);
}

export default function CustomPageViewPage() {
    const { slug } = useParams();

    const { data: page, isLoading, isError, error } = useQuery({
        queryKey: ["customPages", "slug", slug],
        queryFn: async () => getCustomPageBySlug(String(slug || "").trim(), { version: "published" }),
        enabled: Boolean(String(slug || "").trim()),
        retry: false,
    });

    if (!slug) {
        return (
            <div className="p-6 text-slate-200">
                Slug invalide. <Link to="/dashboard">Retour</Link>
            </div>
        );
    }

    if (isLoading) return <div className="p-6 text-slate-200">Chargement…</div>;

    if (isError) {
        const msg = error?.response?.data?.message || error?.message || "Erreur";
        return (
            <div className="p-6 space-y-3">
                <div className="text-red-300">{msg}</div>
                <Link
                    to="/dashboard"
                    className="inline-block px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm"
                >
                    Retour
                </Link>
            </div>
        );
    }

    // backend renvoie { published: {...} } si version=published
    const type = page?.type || "CUSTOM";
    const title = page?.title || page?.navTitle || slug;

    const published = page?.published || null;
    const content = published?.content ?? "";
    const iframeUrl = published?.iframeUrl ?? "";

    const hasPublished =
        (type === "CUSTOM" && typeof content === "string") ||
        (type === "IFRAME" && typeof iframeUrl === "string" && iframeUrl.length > 0);

    if (!hasPublished) {
        return (
            <div className="p-6 space-y-3">
                <div className="text-slate-100 text-lg font-semibold">{title}</div>
                <div className="text-slate-300">Cette page n’est pas publiée.</div>
                <div className="flex gap-2">
                    <Link
                        to="/dashboard"
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm"
                    >
                        Retour
                    </Link>
                    <Link
                        to="/dashboard/custom-pages"
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
                    >
                        Gestion des pages
                    </Link>
                </div>
            </div>
        );
    }

    if (type === "IFRAME") {
        const url = String(iframeUrl || "").trim();
        if (!isHttpUrl(url)) {
            toast.error("URL iframe invalide");
        }

        return (
            <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold text-white">{title}</h1>
                    </div>

                    <div className="flex gap-2">
                        <Link
                            to="/dashboard"
                            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm"
                        >
                            Retour
                        </Link>
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden">
                    <iframe
                        title={title}
                        src={url}
                        className="w-full h-[80vh]"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                    />
                </div>
            </div>
        );
    }

    // CUSTOM
    return (
        <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-white">{title}</h1>
                </div>

                <div className="flex gap-2">
                    <Link
                        to="/dashboard"
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm"
                    >
                        Retour
                    </Link>
                </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
                <div
                    className="
    prose prose-slate prose-invert
    max-w-none
    prose-headings:text-slate-100
    prose-p:text-slate-100
    prose-strong:text-slate-100
    prose-em:text-slate-100
    prose-li:text-slate-100
    prose-blockquote:text-slate-100
    prose-a:text-indigo-300 hover:prose-a:text-indigo-200
    prose-code:text-slate-100
    prose-pre:bg-slate-950 prose-pre:text-slate-100
    prose-hr:border-slate-700
    prose-table:text-slate-100
    prose-th:text-slate-100
    prose-td:text-slate-100
    prose-headings:scroll-mt-24
  "
                >
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks, remarkDirective, remarkCenterDirective]}>
                        {String(content || "")}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
}
