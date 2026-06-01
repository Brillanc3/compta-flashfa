// frontend/src/components/chat/CreateChannelModal.jsx

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { useCompany } from "@/contexts/CompanyContext";
import { createConversation } from "@/services/chatService";
import { getUsersAndRanksForChat } from "@/services/companyService";

const CreateChannelModal = ({ isOpen, onClose, onCreated }) => {
    const { selectedCompany } = useCompany();
    const companyId = selectedCompany?.id;
    const queryClient = useQueryClient();

    // Champs du formulaire
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [kind, setKind] = useState("COMPANY");
    const [userIds, setUserIds] = useState([]);
    const [rankIds, setRankIds] = useState([]);

    // Reset à chaque ouverture
    useEffect(() => {
        if (isOpen) {
            setTitle("");
            setDescription("");
            setKind("COMPANY");
            setUserIds([]);
            setRankIds([]);
        }
    }, [isOpen]);

    // Charge users + ranks
    const { data: chatData = {}, isLoading } = useQuery({
        queryKey: ["company", companyId, "users-and-ranks-for-chat"],
        queryFn: () => getUsersAndRanksForChat(),
        enabled: isOpen,
    });

    const users = (chatData.users || []).map((u) => ({
        id: u.userId,
        label: u.fullName || `Utilisateur ${u.userId}`,
    }));

    const ranks = (chatData.ranks || []).map((r) => ({
        id: r.id,
        label: r.name,
    }));

    // Mutation : création du salon
    const createMutation = useMutation({
        mutationFn: () =>
            createConversation({
                kind,
                companyId,
                title,
                description,
                userIds,
                rankIds,
            }),
        onSuccess: (data) => {
            const conversationId = data?.conversation?.id;

            toast.success("Salon créé avec succès ✨");

            queryClient.invalidateQueries(["chat", "conversations", companyId]);

            if (onCreated && conversationId) {
                onCreated(String(conversationId));
            }

            onClose();
        },
        onError: (err) => {
            console.error(err);
            toast.error("Impossible de créer le salon");
        },
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Overlay */}
            <div
                className="flex-1 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* PANEL */}
            <div className="w-[420px] bg-slate-950 border-l border-slate-800 p-4 flex flex-col text-slate-100 shadow-xl animate-slideLeft">

                {/* HEADER */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="text-xs uppercase text-slate-500 tracking-wide">
                            Nouveau salon
                        </div>
                        <div className="font-semibold text-lg">Créer un salon</div>
                    </div>

                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-md">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* FORMULAIRE */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">

                    {/* Nom */}
                    <div>
                        <label className="text-xs text-slate-400">Nom du salon</label>
                        <input
                            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="ex : général, support, annonces…"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-xs text-slate-400">Description</label>
                        <textarea
                            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Description optionnelle…"
                        />
                    </div>

                    {/* Type */}
                    <div>
                        <label className="text-xs text-slate-400">Type de salon</label>
                        <select
                            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
                            value={kind}
                            onChange={(e) => setKind(e.target.value)}
                        >
                            <option value="COMPANY">Salon d’entreprise</option>
                            <option value="GROUP">Salon privé (groupe)</option>
                        </select>
                    </div>

                    {/* Rangs */}
                    <div>
                        <label className="text-xs text-slate-400">Rangs membres</label>

                        <div className="bg-slate-900 border border-slate-700 rounded mt-1 px-3 py-2 max-h-44 overflow-y-auto text-sm space-y-1">
                            {isLoading && <div className="text-slate-500">Chargement…</div>}

                            {ranks.map((rank) => (
                                <label key={rank.id} className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={rankIds.includes(rank.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setRankIds([...rankIds, rank.id]);
                                            } else {
                                                setRankIds(rankIds.filter((r) => r !== rank.id));
                                            }
                                        }}
                                    />
                                    {rank.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Utilisateurs */}
                    <div>
                        <label className="text-xs text-slate-400">Utilisateurs membres</label>

                        <div className="bg-slate-900 border border-slate-700 rounded mt-1 px-3 py-2 max-h-44 overflow-y-auto text-sm space-y-1">
                            {isLoading && <div className="text-slate-500">Chargement…</div>}

                            {users.map((u) => (
                                <label key={u.id} className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={userIds.includes(u.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setUserIds([...userIds, u.id]);
                                            } else {
                                                setUserIds(userIds.filter((x) => x !== u.id));
                                            }
                                        }}
                                    />
                                    {u.label}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="pt-4">
                    <button
                        onClick={() => createMutation.mutate()}
                        disabled={!title || createMutation.isLoading}
                        className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700"
                    >
                        {createMutation.isLoading ? "Création…" : "Créer le salon"}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default CreateChannelModal;