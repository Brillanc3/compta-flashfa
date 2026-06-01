// frontend/src/components/dashboard/profile/EmploymentHistoryModal.jsx

import React from "react";
import { X, Calendar } from "lucide-react";

const safeDate = (v) => (v ? new Date(v) : null);
const formatDate = (v) => {
    const d = safeDate(v);
    if (!d || isNaN(d.getTime())) return "Date inconnue";
    return d.toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
};

export default function EmploymentHistoryModal({ user, employmentData = [], onClose }) {
    const sortedEmployment = [...employmentData].sort((a, b) => {
        const prio = (status) => (status === "ACTIVE" ? 0 : 1);
        const pa = prio(a.status);
        const pb = prio(b.status);
        if (pa !== pb) return pa - pb;

        const da = safeDate(a.hiredAt)?.getTime() || 0;
        const db = safeDate(b.hiredAt)?.getTime() || 0;
        return db - da;
    });

    const handleCopy = () => {
        let text = `=== CV Professionnel ===

Nom : ${user.name}
Téléphone : ${user.phoneNumber || "N/A"}
IBAN : ${user.iban || "N/A"}

`;

        sortedEmployment.forEach((emp) => {
            text += `
Entreprise : ${emp.companyName}
Rang actuel : ${emp.currentRank}
Statut : ${emp.status}
Embauché le : ${formatDate(emp.hiredAt)}

Historique :
`;
            const histSorted = [...(emp.history || [])].sort(
                (a, b) => new Date(a.assignedAt) - new Date(b.assignedAt) // ancien → récent
            );

            histSorted.forEach((h) => {
                text += ` - ${h.rankName} (${formatDate(h.assignedAt)} → ${
                    h.leaveAt ? formatDate(h.leaveAt) : "Présent"
                })\n`;
            });

            text += `\n`;
        });

        navigator.clipboard.writeText(text);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
            <div className="bg-slate-900 rounded-lg p-6 w-full max-w-3xl relative">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-slate-400 hover:text-white"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="flex items-center space-x-4 mb-6">
                    <img
                        src={user.imageUrl || "/default-profile.png"}
                        alt="Profil"
                        className="w-20 h-20 rounded-full object-cover border border-slate-700"
                    />
                    <div>
                        <h2 className="text-2xl text-white font-bold">{user.name}</h2>
                        <p className="text-slate-400">{user.phoneNumber || "Sans numéro"}</p>
                        <p className="text-slate-400 text-sm">{user.iban || "Sans IBAN"}</p>
                    </div>
                </div>

                <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-2">
                    {sortedEmployment.map((emp, i) => (
                        <div key={i}>
                            <h3 className="text-xl text-indigo-400 font-semibold">
                                {emp.companyName}
                            </h3>
                            <p className="text-slate-300">Rang actuel : {emp.currentRank}</p>

                            <div className="mt-3 border-l-2 border-slate-700 pl-4 space-y-4">
                                {[...(emp.history || [])]
                                    .sort(
                                        (a, b) =>
                                            new Date(b.assignedAt) - new Date(a.assignedAt)
                                    )
                                    .map((h) => (
                                        <div key={h.id}>
                                            <p className="text-white font-semibold">
                                                {h.rankName}
                                            </p>
                                            <p className="text-xs text-slate-500 flex items-center">
                                                <Calendar className="h-3 w-3 mr-1" />
                                                {formatDate(h.assignedAt)}
                                                {h.leaveAt &&
                                                    ` → ${formatDate(h.leaveAt)}`}
                                            </p>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleCopy}
                    className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-md"
                >
                    Copier le CV
                </button>
            </div>
        </div>
    );
}
