import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Globe } from "lucide-react";

export default function ExternalLinkPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const targetUrl = searchParams.get("w") || "";

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate("/dashboard");
        }
    };

    if (!targetUrl) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] text-slate-400 space-y-4">
                <Globe className="w-12 h-12 text-slate-600" />
                <p className="text-lg font-medium">Aucun lien spécifié.</p>
                <button
                    onClick={() => navigate("/dashboard")}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition"
                >
                    Retour au Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] -m-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 bg-slate-950/40 border-b border-slate-800/60 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-4 min-w-0">
                    <button
                        onClick={handleBack}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 text-sm font-medium transition active:scale-95"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retour
                    </button>

                    <div className="hidden sm:flex items-center gap-2 min-w-0">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span className="text-xs text-slate-400 truncate max-w-md font-mono">
                            {targetUrl}
                        </span>
                    </div>
                </div>
            </div>

            {/* Frame Area */}
            <div className="flex-1 relative bg-slate-950">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <p className="text-sm text-slate-500 animate-pulse">Chargement de la page...</p>
                </div>
                <iframe
                    src={targetUrl}
                    title="External Content"
                    className="absolute inset-0 w-full h-full border-0 bg-white"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={() => {
                        // On ne peut pas facilement détecter si une iframe est bloquée par X-Frame-Options en JS (sécurité)
                        // Mais l'utilisateur a toujours le bouton "Ouvrir en externe" au cas où.
                    }}
                />

                {/* Fallback Overlay (visible briefly or if site is slow) */}
                <div className="absolute bottom-4 right-4 max-w-xs p-3 bg-slate-900/90 border border-slate-700/50 rounded-lg shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-500 pointer-events-auto">
                    <p className="text-[10px] text-slate-400 leading-tight">
                        Certains sites empêchent l'affichage dans un cadre pour des raisons de sécurité.
                        Si la page reste blanche, utilisez le bouton **Ouvrir en externe**.
                    </p>
                </div>
            </div>
        </div>
    );
}
