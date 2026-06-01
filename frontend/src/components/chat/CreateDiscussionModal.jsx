// src/components/chat/CreateDiscussionModal.jsx
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import apiClient from "@/services/api";

const TICKET_CATEGORIES = ["GENERAL", "BILLING", "TECHNICAL", "CONTACT", "OTHER"];

export default function CreateDiscussionModal({
                                                  isOpen,
                                                  onClose,
                                                  onCreated,
                                                  companyId,
                                              }) {
    const [title, setTitle] = useState("");
    const [desc, setDesc] = useState("");
    const [members, setMembers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [pickedUsers, setPickedUsers] = useState([]);
    const [pickedRoles, setPickedRoles] = useState([]);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState("");

    // Fetch des membres & rôles
    useEffect(() => {
        if (!isOpen || !companyId) return;

        (async () => {
            setLoading(true);
            try {
                const res = await apiClient.get("/employees/users-for-chat");
                const data = res?.data || {};

                const users = (data.users || []).map((u) => ({
                    id: u.userId,
                    label: u.fullName || `Utilisateur ${u.userId}`,
                })).sort((a, b) => a.label.localeCompare(b.label));

                const ranks = (data.ranks || []).map((r) => ({
                    id: r.id,
                    label: r.name,
                })).sort((a, b) => a.label.localeCompare(b.label));

                setMembers(users);
                setRoles(ranks);
            } catch {
                toast.error("Impossible de charger les membres.");
            } finally {
                setLoading(false);
            }
        })();
    }, [isOpen, companyId]);

    if (!isOpen) return null;

    // Toggle dans listes
    const toggle = (id, setter) =>
        setter((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );

    // Envoi création
    const submit = async () => {
        if (!title.trim() && pickedUsers.length === 0 && pickedRoles.length === 0) {
            toast.error("Ajoutez un titre, un membre ou un rôle.");
            return;
        }

        try {
            setBusy(true);

            const res = await apiClient.post("/chat/conversations", {
                title: title || undefined,
                description: desc || undefined,
                userIds: pickedUsers,
                roleIds: pickedRoles,
            });

            const conversation = res?.data;

            toast.success("Discussion créée !");
            onCreated?.(conversation);
        } catch {
            toast.error("Erreur : impossible de créer la discussion.");
        } finally {
            setBusy(false);
        }
    };

    const filteredMembers = !query
        ? members
        : members.filter((m) => m.label.toLowerCase().includes(query.toLowerCase()));

    const filteredRoles = !query
        ? roles
        : roles.filter((r) => r.label.toLowerCase().includes(query.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-slate-900/70 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4">

                <h2 className="text-lg font-semibold text-white">Créer une discussion</h2>

                {/* Champ Titre */}
                <div>
                    <label className="text-xs text-slate-400">Titre</label>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="text-xs text-slate-400">Description</label>
                    <textarea
                        rows={3}
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none"
                    ></textarea>
                </div>

                {/* Recherche */}
                <div>
                    <label className="text-xs text-slate-400">Recherche</label>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher un membre ou un rôle…"
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none"
                    />
                </div>

                {/* Membres */}
                <div>
                    <label className="text-xs text-slate-400">Membres</label>
                    <div className="max-h-32 overflow-auto grid grid-cols-2 gap-2 mt-1">
                        {loading ? (
                            <div className="col-span-2 text-center text-slate-400 text-sm py-4">
                                Chargement…
                            </div>
                        ) : (
                            filteredMembers.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => toggle(m.id, setPickedUsers)}
                                    className={`px-2 py-1 rounded-lg text-xs border ${
                                        pickedUsers.includes(m.id)
                                            ? "bg-emerald-700 text-white border-emerald-600"
                                            : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                                    }`}
                                >
                                    {m.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Rôles */}
                <div>
                    <label className="text-xs text-slate-400">Rôles</label>
                    <div className="max-h-24 overflow-auto grid grid-cols-2 gap-2 mt-1">
                        {loading ? (
                            <div className="col-span-2 text-center text-slate-400 text-sm py-4">
                                Chargement…
                            </div>
                        ) : (
                            filteredRoles.map((r) => (
                                <button
                                    key={r.id}
                                    onClick={() => toggle(r.id, setPickedRoles)}
                                    className={`px-2 py-1 rounded-lg text-xs border ${
                                        pickedRoles.includes(r.id)
                                            ? "bg-indigo-700 text-white border-indigo-600"
                                            : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                                    }`}
                                >
                                    {r.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Sélection affichée */}
                {(pickedUsers.length > 0 || pickedRoles.length > 0) && (
                    <div className="flex flex-wrap gap-2 text-xs">
                        {pickedUsers.map((id) => {
                            const label = members.find((m) => m.id === id)?.label || id;
                            return (
                                <span
                                    key={`user-${id}`}
                                    className="px-2 py-1 rounded-full bg-emerald-700 text-white"
                                >
                                    {label}
                                </span>
                            );
                        })}

                        {pickedRoles.map((id) => {
                            const label = roles.find((r) => r.id === id)?.label || id;
                            return (
                                <span
                                    key={`role-${id}`}
                                    className="px-2 py-1 rounded-full bg-indigo-700 text-white"
                                >
                                    {label}
                                </span>
                            );
                        })}
                    </div>
                )}

                {/* Boutons */}
                <div className="flex justify-end gap-3 pt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm hover:bg-slate-700"
                    >
                        Annuler
                    </button>

                    <button
                        onClick={submit}
                        disabled={busy}
                        className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm hover:bg-emerald-600 disabled:opacity-50"
                    >
                        {busy ? "Création..." : "Créer"}
                    </button>
                </div>
            </div>
        </div>
    );
}
