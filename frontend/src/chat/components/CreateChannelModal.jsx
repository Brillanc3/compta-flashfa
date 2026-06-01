// src/chat/components/CreateChannelModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "@headlessui/react";
import { Lock, Hash, ChevronLeft, Folder } from "lucide-react";
import { createChannel, getCategories } from "@/services/chatService";
import apiClient from "@/services/api";
import { useChatStore } from "@/chat/store/useChatStore";
import toast from "react-hot-toast";

/* ============================================================================
   GLASS PREMIUM WRAPPER
============================================================================ */
const GlassCard = ({ children, className = "" }) => (
    <div
        className={`
            relative rounded-2xl p-6
            bg-cca-surface/60 backdrop-blur-2xl
            border border-cca-border shadow-2xl shadow-black/60
            ${className}
            animate-in zoom-in-95 duration-300
        `}
    >
        <div
            className="
                pointer-events-none absolute inset-0 opacity-10 mix-blend-soft-light
                [background:
                    radial-gradient(circle_at_top_left,rgba(var(--brand-primary-rgb),0.3),transparent_55%),
                    radial-gradient(circle_at_bottom_right,rgba(var(--brand-primary-rgb),0.2),transparent_55%)
                ]
            "
        />
        <div className="relative overflow-hidden">{children}</div>
    </div>
);

/* ============================================================================
   MAIN COMPONENT — Discord-like Workflow
============================================================================ */
export default function CreateChannelModal({ isOpen, onClose, defaultCategoryId = null }) {
    const refreshChannels = useChatStore((s) => s.loadInitial);

    // Step = 1 : name + category + private toggle
    // Step = 2 : select roles/users (only if private)
    const [step, setStep] = useState(1);

    const [channelName, setChannelName] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");
    const [categories, setCategories] = useState([]);

    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState({ users: [], ranks: [] });

    // Selections on step 2
    const [selectedRanks, setSelectedRanks] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);

    /* -------------------------------------------------------------------------
       LOAD categories on open + reset on close
    ------------------------------------------------------------------------- */
    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setChannelName("");
            setIsPrivate(false);
            setCategoryId(defaultCategoryId ?? "");
            setEmployees({ users: [], ranks: [] });
            setSelectedRanks([]);
            setSelectedUsers([]);
            return;
        }
        getCategories()
            .then((cats) => setCategories(Array.isArray(cats) ? cats : []))
            .catch(() => setCategories([]));
    }, [isOpen, defaultCategoryId]);

    const sortedCategories = useMemo(
        () => [...categories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
        [categories]
    );

    const loadEmployees = async () => {
        try {
            const res = await apiClient.get("/employees/users-for-chat");
            setEmployees({
                users: Array.isArray(res.data.users) ? res.data.users : [],
                ranks: Array.isArray(res.data.ranks) ? res.data.ranks : [],
            });
        } catch (e) {
            console.error(e);
            toast.error("Impossible de charger les employés.");
            setEmployees({ users: [], ranks: [] });
        }
    };

    /* -------------------------------------------------------------------------
       NEXT STEP
    ------------------------------------------------------------------------- */
    const next = async () => {
        if (!channelName.trim()) {
            toast.error("Le nom du salon est requis.");
            return;
        }

        if (isPrivate) {
            setLoading(true);
            await loadEmployees();
            setLoading(false);
            setStep(2);
        } else {
            // Direct create: public channel
            await submitCreate();
        }
    };

    /* -------------------------------------------------------------------------
       CREATE CHANNEL
    ------------------------------------------------------------------------- */
    const submitCreate = async () => {
        try {
            setLoading(true);

            const payload = {
                name: channelName.trim(),
                isPrivate,
                allowedRanks: selectedRanks,
                allowedUsers: selectedUsers,
                categoryId: categoryId ? String(categoryId) : null,
            };

            await createChannel(payload);
            toast.success("Salon créé !");
            onClose();
            refreshChannels();
        } catch (e) {
            console.error(e);
            toast.error(e?.message || "Erreur lors de la création.");
        } finally {
            setLoading(false);
        }
    };

    /* -------------------------------------------------------------------------
       RENDER STEP 1
    ------------------------------------------------------------------------- */
    const renderStep1 = () => (
        <GlassCard className="w-full space-y-6">
            <h2 className="text-2xl font-bold font-heading text-cca-textPrimary flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cca-base border border-cca-border">
                    <Hash className="w-6 h-6 text-brand-primary" />
                </div>
                Créer un salon
            </h2>

            <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-cca-textSecondary mb-1.5 ml-1">
                    Nom du salon
                </label>
                <input
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    className="
                        w-full px-4 py-3 rounded-xl bg-cca-base border border-cca-border
                        focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 outline-none text-cca-textPrimary transition-all
                    "
                    placeholder="ex: général"
                />
            </div>

            <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-cca-textSecondary mb-1.5 ml-1">
                    Catégorie
                </label>
                <div className="relative">
                    <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cca-textSecondary pointer-events-none" />
                    <select
                        value={categoryId ?? ""}
                        onChange={(e) => setCategoryId(e.target.value || "")}
                        className="
                            w-full pl-10 pr-4 py-3 rounded-xl bg-cca-base border border-cca-border
                            focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 outline-none
                            text-cca-textPrimary transition-all appearance-none
                        "
                    >
                        <option value="">— Aucune catégorie —</option>
                        {sortedCategories.map((c) => (
                            <option key={String(c.id)} value={String(c.id)}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>
                {categoryId && !isPrivate && (
                    <p className="text-[11px] text-cca-textSecondary/70 mt-1.5 ml-1">
                        Le salon héritera des permissions de la catégorie (synchronisé).
                    </p>
                )}
            </div>

            <div className="flex items-center gap-3 mt-2">
                <input
                    id="privateToggle"
                    type="checkbox"
                    checked={isPrivate}
                    onChange={() => setIsPrivate(!isPrivate)}
                />
                <label
                    htmlFor="privateToggle"
                    className="text-sm font-semibold text-cca-textPrimary flex items-center gap-2 cursor-pointer"
                >
                    <div className={`p-1.5 rounded-lg border transition-all ${isPrivate ? "bg-red-500/10 border-red-500/30" : "bg-cca-base border-cca-border"}`}>
                        <Lock className={`w-4 h-4 ${isPrivate ? "text-red-400" : "text-cca-textSecondary"}`} />
                    </div>
                    Salon privé
                </label>
            </div>

            <button
                onClick={next}
                className="
                    w-full mt-6 py-3 rounded-xl bg-brand-primary hover:bg-brand-dark
                    text-white font-bold transition-all active:scale-95 shadow-lg shadow-brand-primary/20
                "
            >
                {isPrivate ? "Suivant" : "Créer le salon"}
            </button>
        </GlassCard>
    );

    /* -------------------------------------------------------------------------
       RENDER STEP 2 — Select roles + users
    ------------------------------------------------------------------------- */
    const toggleRank = (id) => {
        setSelectedRanks((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const toggleUser = (id) => {
        setSelectedUsers((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const renderStep2 = () => (
        <GlassCard className="w-full space-y-6">
            <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-cca-textSecondary hover:text-cca-textPrimary text-sm font-semibold transition-colors"
            >
                <ChevronLeft className="w-4 h-4" /> Retour au nom du salon
            </button>

            <h2 className="text-2xl font-bold font-heading text-cca-textPrimary flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                    <Lock className="w-6 h-6 text-red-400" />
                </div>
                Accès au salon privé
            </h2>

            {loading && <p className="text-slate-400">Chargement...</p>}

            {!loading && (
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                    {/* RANKS */}
                    <div>
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-cca-textSecondary mb-3 ml-1">
                            Rôles autorisés
                        </h3>
                        <div className="space-y-2">
                            {employees.ranks.map((r) => (
                                <label
                                    key={r.id}
                                    className="
                                        flex items-center gap-3 p-3 rounded-xl
                                        bg-cca-base border border-cca-border
                                        hover:bg-cca-surface transition-all cursor-pointer
                                    "
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedRanks.includes(r.id)}
                                        onChange={() => toggleRank(r.id)}
                                    />
                                    <span className="text-sm font-semibold text-cca-textPrimary">
                                        {r.name}{" "}
                                        <span className="text-cca-textSecondary text-xs font-normal">
                                            ({r.membersCount} membres)
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* USERS */}
                    <div>
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-cca-textSecondary mb-3 mt-4 ml-1">
                            Utilisateurs autorisés
                        </h3>
                        <div className="space-y-2">
                            {employees.users.map((u) => (
                                <label
                                    key={u.userId}
                                    className="
                                        flex items-center gap-3 p-3 rounded-xl
                                        bg-cca-base border border-cca-border
                                        hover:bg-cca-surface transition-all cursor-pointer
                                    "
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedUsers.includes(u.userId)}
                                        onChange={() => toggleUser(u.userId)}
                                    />
                                    <span className="text-sm font-semibold text-cca-textPrimary">
                                        {u.fullName}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={submitCreate}
                className="
                    w-full mt-6 py-3 rounded-xl bg-brand-primary hover:bg-brand-dark
                    text-white font-bold transition-all active:scale-95 shadow-lg shadow-brand-primary/20
                "
            >
                Créer le salon
            </button>
        </GlassCard>
    );

    /* -------------------------------------------------------------------------
       RENDER MODAL
    ------------------------------------------------------------------------- */
    return (
        <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

            <div className="flex items-center justify-center min-h-screen p-4">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
            </div>
        </Dialog>
    );
}
