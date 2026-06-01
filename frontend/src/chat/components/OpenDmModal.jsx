import React, { useEffect, useState } from "react";
import { Dialog } from "@headlessui/react";
import { MessageSquare, Search } from "lucide-react";
import apiClient from "@/services/api";
import toast from "react-hot-toast";
import { useDmStore } from "../store/useDmStore";

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
        <div className="relative overflow-hidden flex flex-col h-full">{children}</div>
    </div>
);

export default function OpenDmModal({ onClose }) {
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");
    const openConversationWithUser = useDmStore((s) => s.openConversationWithUser);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get("/employees/users-for-chat");
            setUsers(Array.isArray(res.data.users) ? res.data.users : []);
        } catch (e) {
            console.error(e);
            toast.error("Impossible de charger les employés.");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectUser = async (userId) => {
        try {
            await openConversationWithUser(userId);
            onClose();
        } catch {
            toast.error("Erreur lors de l'ouverture du DM");
        }
    };

    const filteredUsers = users.filter((u) => u.fullName?.toLowerCase().includes(search.toLowerCase()));

    return (
        <Dialog open={true} onClose={onClose} className="fixed inset-0 z-50">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="flex items-center justify-center min-h-screen p-4">
                <GlassCard className="w-full max-w-md h-[70vh] flex flex-col">
                    <h2 className="text-xl font-bold font-heading text-cca-textPrimary flex items-center gap-3 shrink-0 mb-4">
                        <div className="p-2 rounded-xl bg-cca-base border border-cca-border">
                            <MessageSquare className="w-5 h-5 text-brand-primary" />
                        </div>
                        Nouveau Message Privé
                    </h2>

                    <div className="relative shrink-0 mb-4">
                        <Search className="w-4 h-4 text-cca-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Rechercher un collègue..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="
                                w-full pl-9 pr-4 py-2.5 rounded-xl bg-cca-base border border-cca-border
                                focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 
                                outline-none text-cca-textPrimary text-sm transition-all
                            "
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-cca-border scrollbar-track-transparent pr-2">
                        {loading && <p className="text-sm text-cca-textSecondary p-2">Chargement...</p>}
                        
                        {!loading && filteredUsers.length === 0 && (
                            <p className="text-sm text-cca-textSecondary p-2 text-center mt-4">Aucun collègue trouvé.</p>
                        )}

                        {!loading && filteredUsers.map((u) => (
                            <button
                                key={u.userId}
                                onClick={() => handleSelectUser(u.userId)}
                                className="
                                    w-full flex items-center text-left gap-3 p-3 rounded-xl
                                    bg-cca-base/50 border border-transparent
                                    hover:bg-cca-base hover:border-brand-primary/30 transition-all
                                "
                            >
                                <div className="w-8 h-8 rounded-full bg-cca-surface flex items-center justify-center font-bold text-cca-textSecondary text-xs">
                                    {u.fullName?.charAt(0)}
                                </div>
                                <span className="text-sm font-semibold text-cca-textPrimary">
                                    {u.fullName}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="shrink-0 pt-4 mt-2 border-t border-cca-border">
                        <button
                            onClick={onClose}
                            className="w-full py-2.5 rounded-xl bg-cca-base hover:bg-cca-surface border border-cca-border font-semibold text-cca-textPrimary transition-all"
                        >
                            Annuler
                        </button>
                    </div>
                </GlassCard>
            </div>
        </Dialog>
    );
}
