// /frontend/src/components/dashboard/profile/EmploymentHistoryCard.jsx

import React, { useState } from "react";
import { Calendar, ChevronRight } from "lucide-react";
import EmploymentHistoryModal from "./EmploymentHistoryModal";

const statusLabels = {
    ACTIVE: "Actif",
    RESIGNED: "Démissionné",
    FIRE: "Licencié",
    PENDING_LINK: "En attente",
};

// --- Badges statut ---
const statusBadge = {
    ACTIVE: "bg-green-600/30 text-green-400 border-green-600/40",
    RESIGNED: "bg-orange-600/30 text-orange-400 border-orange-600/40",
    FIRE: "bg-red-600/30 text-red-400 border-red-600/40",
    PENDING_LINK: "bg-cca-base text-cca-textSecondary border-cca-border shadow-sm",
};

// Safe date
const safeDate = (v) => (v ? new Date(v) : null);

// FR format
const formatDate = (v) => {
    const d = safeDate(v);
    if (!d || isNaN(d.getTime())) return "Date inconnue";
    return d.toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
};

// --- Calcul durée ---
const getDuration = (start, end) => {
    const s = safeDate(start);
    const e = end ? safeDate(end) : new Date();
    if (!s || !e || isNaN(s) || isNaN(e)) return "";

    const ms = Math.abs(e - s);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    if (days < 1) return "— moins d’un jour";
    if (days < 30) return `— ${days} jour${days > 1 ? "s" : ""}`;

    const months = Math.floor(days / 30);
    if (months < 12) return `— ${months} mois`;

    const years = Math.floor(months / 12);
    return `— ${years} an${years > 1 ? "s" : ""}`;
};

export default function EmploymentHistoryCard({ employmentData = [], user }) {
    const [open, setOpen] = useState(false);

    if (!employmentData || employmentData.length === 0) {
        return (
            <div className="bg-cca-surface border border-cca-border p-6 rounded-lg shadow">
                <h3 className="text-xl font-bold text-cca-textPrimary mb-4">Parcours Professionnel</h3>
                <p className="text-cca-textSecondary">Aucune donnée disponible.</p>
            </div>
        );
    }

    // --- TRIER LES ENTREPRISES ---
    const sortedEmployment = [...employmentData].sort((a, b) => {
        const prio = (s) => (s === "ACTIVE" ? 0 : 1);
        const pa = prio(a.status);
        const pb = prio(b.status);
        if (pa !== pb) return pa - pb;

        // Tri des résignées par ancienneté (récentes → anciennes)
        return new Date(b.hiredAt) - new Date(a.hiredAt);
    });

    // MULTIPLES ENTREPRISES ACTIVES
    const activeCompanies = sortedEmployment.filter((c) => c.status === "ACTIVE");

    // HISTORIQUE GLOBAL
    const globalHistory = sortedEmployment
        .flatMap((c) =>
            (c.history || []).map((h) => ({
                ...h,
                companyName: c.companyName,
            }))
        )
        .sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt));

    const lastThree = globalHistory.slice(0, 3);

    return (
        <div className="bg-cca-surface border border-cca-border p-6 rounded-lg shadow">
            <h3 className="text-xl font-bold text-cca-textPrimary mb-4">Parcours Professionnel</h3>

            {/* ENTREPRISES ACTUELLES */}
            <div className="mb-6">
                <p className="text-cca-textSecondary font-medium mb-2">Entreprises actuelles :</p>

                {activeCompanies.length === 0 && (
                    <p className="text-cca-textSecondary/70 text-sm">Aucune entreprise active.</p>
                )}

                {activeCompanies.map((company, index) => (
                    <div key={index} className="mb-3 border-l-2 border-cca-border pl-3">
                        <div className="flex items-center gap-2">
                            <p className="text-cca-textPrimary font-semibold">{company.companyName}</p>

                            <span
                                className={`text-xs px-2 py-0.5 rounded border ${statusBadge[company.status]}`}
                            >
                                {statusLabels[company.status]}
                            </span>
                        </div>

                        <p className="text-brand-primary text-sm font-medium">{company.currentRank}</p>

                        <p className="text-xs text-cca-textSecondary flex items-center mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            Depuis le {formatDate(company.hiredAt)}
                        </p>
                    </div>
                ))}
            </div>

            {/* 3 derniers rangs */}
            <div className="space-y-3">
                <p className="text-cca-textSecondary font-medium">Derniers rangs</p>
                {lastThree.length === 0 && (
                    <p className="text-cca-textSecondary/70 text-sm">Aucun historique.</p>
                )}

                {lastThree.map((h) => (
                    <div key={h.id} className="border-l-2 border-cca-border pl-3">
                        <p className="text-cca-textPrimary font-semibold">
                            {h.rankName}{" "}
                            <span className="text-brand-primary text-xs font-medium">– {h.companyName}</span>
                        </p>

                        <p className="text-xs text-cca-textSecondary">
                            Du {formatDate(h.assignedAt)}
                            {h.leaveAt && ` au ${formatDate(h.leaveAt)}`}
                            <span className="ml-1 text-cca-textSecondary/70 font-mono">
                                {getDuration(h.assignedAt, h.leaveAt)}
                            </span>
                        </p>
                    </div>
                ))}
            </div>

            {/* Voir plus */}
            <button
                onClick={() => setOpen(true)}
                className="mt-6 flex items-center text-brand-primary hover:text-brand-primary/80 transition-colors text-sm font-medium"
            >
                Voir plus <ChevronRight className="h-4 w-4 ml-1" />
            </button>

            {open && (
                <EmploymentHistoryModal
                    user={user}
                    employmentData={sortedEmployment}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
}
