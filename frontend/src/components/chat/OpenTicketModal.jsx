// src/components/chat/OpenTicketModal.jsx
import React, { useState } from "react";
import toast from "react-hot-toast";
import * as chatService from "@/services/chatService";

export default function OpenTicketModal({ isOpen, onClose, onCreated }) {
    const [title, setTitle] = useState("");
    const [desc, setDesc] = useState("");
    const [category, setCategory] = useState("GENERAL");
    const [busy, setBusy] = useState(false);

    if (!isOpen) return null;

    const submit = async () => {
        try {
            setBusy(true);
            const conversation = await chatService.createTicket({
                ticketCategory: category,
                title,
                description: desc,
            });
            toast.success("Ticket créé.");
            onCreated?.(conversation);
        } catch (e) {
            toast.error(e?.message || "Erreur création ticket");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm grid place-items-center p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur-xl p-4 space-y-3 shadow-xl">

                <div className="text-slate-200 font-semibold text-lg">Ouvrir un ticket</div>

                {/* Category */}
                <div>
                    <label className="text-xs text-slate-300">Catégorie</label>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 text-sm"
                    >
                        <option value="GENERAL">GENERAL</option>
                        <option value="BILLING">BILLING</option>
                        <option value="TECHNICAL">TECHNICAL</option>
                        <option value="CONTACT">CONTACT</option>
                        <option value="OTHER">OTHER</option>
                    </select>
                </div>

                {/* Title */}
                <div>
                    <label className="text-xs text-slate-300">Titre</label>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="text-xs text-slate-300">Description</label>
                    <textarea
                        rows={4}
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                    ></textarea>
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-2 pt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={submit}
                        disabled={busy}
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                    >
                        {busy ? "Création…" : "Créer"}
                    </button>
                </div>

            </div>
        </div>
    );
}
