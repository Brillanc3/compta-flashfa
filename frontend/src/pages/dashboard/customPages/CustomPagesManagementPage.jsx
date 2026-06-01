// frontend/src/pages/dashboard/customPages/CustomPagesManagementPage.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { listCustomPages, deleteCustomPage } from "@/services/customPagesService";
import { queryClient } from "@/utils/queryClient";
import { useConfirmation } from "@/contexts/ConfirmationContext";

function fmtDate(d) {
    if (!d) return "-";
    try {
        return new Date(d).toLocaleString("fr-FR");
    } catch {
        return String(d);
    }
}

export default function CustomPagesManagementPage() {
    const navigate = useNavigate();
    const { confirmAction } = useConfirmation();

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["customPages", "list"],
        queryFn: () => listCustomPages({ version: "published" }),
    });

    const delMutation = useMutation({
        mutationFn: async (id) => deleteCustomPage(id),
        onSuccess: async () => {
            toast.success("Page supprimée");
            await queryClient.invalidateQueries({ queryKey: ["customPages", "list"] });
        },
        onError: (e) => toast.error(e?.response?.data?.message || e?.message || "Erreur suppression"),
    });

    const pages = data?.data || [];

    return (
        <div className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-white">Pages personnalisées</h1>
                    <p className="text-sm text-slate-300">
                        Crée, modifie, publie et configure l’affichage sidebar (titre, icône, ordre).
                    </p>
                </div>

                <div className="flex gap-2">
                    <Link
                        to="/dashboard/custom-pages/new"
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
                    >
                        Créer une page
                    </Link>
                </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                    <div className="text-sm text-slate-200">Liste</div>
                </div>

                {isLoading && <div className="p-4 text-slate-300">Chargement…</div>}

                {isError && (
                    <div className="p-4 text-red-300">
                        {error?.response?.data?.message || error?.message || "Erreur"}
                    </div>
                )}

                {!isLoading && !isError && pages.length === 0 && (
                    <div className="p-4 text-slate-300">Aucune page.</div>
                )}

                {!isLoading && !isError && pages.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-800/50 text-slate-200">
                            <tr>
                                <th className="text-left px-4 py-3">Titre</th>
                                <th className="text-left px-4 py-3">Slug</th>
                                <th className="text-left px-4 py-3">Type</th>
                                <th className="text-left px-4 py-3">Sidebar</th>
                                <th className="text-left px-4 py-3">Publié</th>
                                <th className="text-left px-4 py-3">MAJ</th>
                                <th className="text-right px-4 py-3">Actions</th>
                            </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-800">
                            {pages.map((p) => (
                                <tr key={p.id} className="text-slate-200">
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{p.title}</div>
                                        {p.navTitle ? (
                                            <div className="text-xs text-slate-400">Menu: {p.navTitle}</div>
                                        ) : null}
                                    </td>

                                    <td className="px-4 py-3 text-slate-300">{p.slug}</td>
                                    <td className="px-4 py-3 text-slate-300">{p.type}</td>

                                    <td className="px-4 py-3 text-slate-300">
                                        {p.showInSidebar ? (
                                            <span className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-200">
                          Oui
                        </span>
                                        ) : (
                                            <span className="px-2 py-1 rounded bg-slate-700/40 text-slate-300">
                          Non
                        </span>
                                        )}
                                    </td>

                                    <td className="px-4 py-3 text-slate-300">
                                        {p.hasPublished ? "Oui" : "Non"}
                                        {p.publishedAt ? (
                                            <div className="text-xs text-slate-400">{fmtDate(p.publishedAt)}</div>
                                        ) : null}
                                    </td>

                                    <td className="px-4 py-3 text-slate-300">{fmtDate(p.updatedAt)}</td>

                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100"
                                                onClick={() => navigate(`/dashboard/custom-pages/${p.id}/edit`)}
                                            >
                                                Modifier
                                            </button>

                                            <button
                                                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 disabled:opacity-50"
                                                onClick={() => navigate(`/dashboard/pages/${p.slug}`)}
                                                disabled={!p.hasPublished}
                                                title={p.hasPublished ? "Ouvrir" : "Non publié"}
                                            >
                                                Ouvrir
                                            </button>

                                            <button
                                                className="px-3 py-1.5 rounded bg-red-600/80 hover:bg-red-600 text-white disabled:opacity-50"
                                                disabled={delMutation.isPending}
                                                onClick={() => {
                                                    confirmAction({
                                                        title: "Supprimer la page",
                                                        message: `Confirmer la suppression de la page "${p.title}" ? Cette action est irréversible.`,
                                                        onConfirm: () => delMutation.mutate(p.id),
                                                    });
                                                }}
                                            >
                                                Supprimer
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
