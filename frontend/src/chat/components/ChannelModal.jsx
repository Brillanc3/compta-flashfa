// src/chat/components/ChannelModal.jsx
import React, { useEffect, useState } from "react";
import { Dialog } from "@headlessui/react";
import { Lock, Hash, ChevronLeft } from "lucide-react";
import apiClient from "@/services/api";
import toast from "react-hot-toast";
import { useChatStore } from "@/chat/store/useChatStore";
import * as chatApi from "@/services/chatService";

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
   MAIN COMPONENT
   mode: "create" | "edit"
   initialChannel: { id, name, isPrivate, ... }
============================================================================ */
export default function ChannelModal({
    isOpen,
    onClose,
    mode = "create",
    initialChannel = null,
    preselectedCategoryId = null,
}) {
    const refreshChannels = useChatStore((s) => s.loadInitial);

    // Steps = same as Discord
    const [step, setStep] = useState(1);

    const [channelName, setChannelName] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);

    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState({ users: [], ranks: [] });

    const [selectedRanks, setSelectedRanks] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);

    /* -------------------------------------------------------------------------
       INIT WHEN OPENING
    ------------------------------------------------------------------------- */
    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setChannelName("");
            setIsPrivate(false);
            setEmployees({ users: [], ranks: [] });
            setSelectedRanks([]);
            setSelectedUsers([]);
            return;
        }

        if (mode === "edit" && initialChannel) {
            setChannelName(initialChannel.name || "");
            setIsPrivate(!!initialChannel.isPrivate);

            // Préparer permissions si privé
            if (initialChannel.isPrivate) {
                loadEmployees();
                loadExistingOverrides(initialChannel.id);
                setStep(1);
            }
        }
    }, [isOpen, mode, initialChannel]);

    /* -------------------------------------------------------------------------
       Load employees for private selection
    ------------------------------------------------------------------------- */
    const loadEmployees = async () => {
        try {
            const res = await apiClient.get("/employees/users-for-chat");
            setEmployees({
                ranks: Array.isArray(res.data.ranks) ? res.data.ranks : [],
                users: Array.isArray(res.data.users) ? res.data.users : [],
            });
        } catch (e) {
            console.error(e);
            toast.error("Impossible de charger les employés.");
        }
    };

    /* -------------------------------------------------------------------------
       Load existing overrides (when editing)
    ------------------------------------------------------------------------- */
    const loadExistingOverrides = async (channelId) => {
        try {
            const [rankRes, userRes] = await Promise.all([
                chatApi.getChannelRankOverrides(channelId),
                chatApi.getChannelUserOverrides(channelId),
            ]);

            setSelectedRanks(rankRes.map((r) => r.rankId));
            setSelectedUsers(userRes.map((u) => u.userId));
        } catch (err) {
            console.error(err);
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

        if (!isPrivate) {
            if (mode === "create") return submitCreate();
            if (mode === "edit") return submitEdit();
        }

        // Private → step2
        setLoading(true);
        await loadEmployees();
        setLoading(false);
        setStep(2);
    };

    /* -------------------------------------------------------------------------
       CREATE CHANNEL
    ------------------------------------------------------------------------- */
    const submitCreate = async () => {
        try {
            setLoading(true);
            await chatApi.createChannel({
                name: channelName.trim(),
                isPrivate,
                allowedRanks: selectedRanks,
                allowedUsers: selectedUsers,
                categoryId: preselectedCategoryId,
            });

            toast.success("Salon créé !");
            onClose();
            refreshChannels();
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de la création.");
        } finally {
            setLoading(false);
        }
    };

    /* -------------------------------------------------------------------------
       EDIT CHANNEL
    ------------------------------------------------------------------------- */
    const submitEdit = async () => {
        if (!initialChannel) return;

        try {
            setLoading(true);

            await chatApi.updateChannel(initialChannel.id, {
                name: channelName.trim(),
                isPrivate,
                allowedRanks: selectedRanks,
                allowedUsers: selectedUsers,
            });

            toast.success("Salon modifié !");
            onClose();
            refreshChannels();
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de la modification.");
        } finally {
            setLoading(false);
        }
    };

    /* -------------------------------------------------------------------------
       STEP 1 UI
    ------------------------------------------------------------------------- */
    const renderStep1 = () => (
        <GlassCard className="w-full max-w-md space-y-6">
            <h2 className="text-2xl font-bold font-heading text-cca-textPrimary flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cca-base border border-cca-border">
                    <Hash className="w-6 h-6 text-brand-primary" />
                </div>
                {mode === "create" ? "Créer un salon" : "Modifier le salon"}
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
                {isPrivate
                    ? "Suivant"
                    : mode === "create"
                        ? "Créer le salon"
                        : "Enregistrer"}
            </button>
        </GlassCard>
    );

    /* -------------------------------------------------------------------------
       STEP 2 UI — Roles and Users selection
    ------------------------------------------------------------------------- */
    const toggleRank = (id) =>
        setSelectedRanks((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );

    const toggleUser = (id) =>
        setSelectedUsers((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );

    const renderStep2 = () => (
        <GlassCard className="w-full max-w-md space-y-6">
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
                    {/* Roles */}
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

                    {/* Users */}
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
                onClick={mode === "create" ? submitCreate : submitEdit}
                className="
                    w-full mt-6 py-3 rounded-xl bg-brand-primary hover:bg-brand-dark
                    text-white font-bold transition-all active:scale-95 shadow-lg shadow-brand-primary/20
                "
            >
                {mode === "create" ? "Créer le salon" : "Enregistrer les modifications"}
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
