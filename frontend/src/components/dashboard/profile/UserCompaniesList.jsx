// frontend/src/components/dashboard/profile/UserCompaniesList.jsx

import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Affiche un badge de statut avec une couleur conditionnelle.
 * @param {{ status: string }} props
 */
const StatusBadge = ({ status }) => {
    const baseClasses = "text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full";
    // ✅ CORRECTION : Mappage des statuts de l'enum Prisma vers des libellés et couleurs.
    const statusConfig = {
        'ACTIVE': { label: 'Actif', classes: 'bg-green-200 text-green-900' },
        'RESIGNED': { label: 'Démissionné', classes: 'bg-slate-200 text-slate-900' },
        'FIRED': { label: 'Viré', classes: 'bg-red-200 text-red-900' },
        'PENDING_LINK': { label: 'En attente', classes: 'bg-yellow-200 text-yellow-900' },
    };
    const config = statusConfig[status] || { label: status, classes: 'bg-gray-200 text-gray-900' };

    return (
        <span className={`${baseClasses} ${config.classes}`}>
            {config.label}
        </span>
    );
};


/**
 * Affiche la liste des entreprises et des rangs associés à un utilisateur.
 * @param {{ employments: Array<object> }} props
 */
const UserCompaniesList = ({ employments }) => {
    // ✅ NOUVEAUTÉ : État pour suivre quel historique est actuellement ouvert.
    const [openHistoryId, setOpenHistoryId] = useState(null);

    // Fonction pour ouvrir/fermer l'historique d'un emploi.
    const toggleHistory = (employmentId) => {
        setOpenHistoryId(prevId => (prevId === employmentId ? null : employmentId));
    };

    if (!employments || employments.length === 0) {
        return (
            <div className="bg-slate-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-white mb-4">Mes Entreprises</h2>
                <p className="text-slate-400">Vous n'êtes actuellement lié à aucune entreprise.</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-white mb-4">Mes Entreprises</h2>
            <ul className="space-y-2">
                {employments.map((job) => (
                    <li key={job.id} className="bg-slate-700 rounded-md transition-all duration-300">
                        <div className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center">
                            <div>
                                <p className="font-bold text-white">{job.company.name}</p>
                                <p className="text-sm text-slate-400">Rang actuel : {job.rank.name}</p>
                            </div>
                            <div className="flex items-center space-x-4 mt-2 sm:mt-0">
                                {/* ✅ CORRECTION : On utilise `job.status` au lieu de `job.role`. */}
                                <StatusBadge status={job.status} />
                                <button
                                    onClick={() => toggleHistory(job.id)}
                                    className="text-sm text-blue-400 hover:text-blue-300 font-semibold"
                                >
                                    {openHistoryId === job.id ? 'Masquer' : 'Historique'}
                                </button>
                            </div>
                        </div>

                        {/* ✅ NOUVEAUTÉ : Section de l'historique qui s'affiche conditionnellement */}
                        {openHistoryId === job.id && (
                            <div className="p-4 border-t border-slate-600">
                                <h4 className="font-semibold text-slate-300 mb-2">Historique des rangs :</h4>
                                {job.rankHistory && job.rankHistory.length > 0 ? (
                                    <ul className="space-y-1 text-sm">
                                        {job.rankHistory.map(historyEntry => (
                                            <li key={historyEntry.id} className="flex justify-between text-slate-400">
                                                <span>{historyEntry.rank.name}</span>
                                                <span>
                                                    {new Date(historyEntry.assignedAt).toLocaleDateString('fr-FR', {
                                                        year: 'numeric', month: 'long', day: 'numeric'
                                                    })}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-slate-500 text-sm">Aucun historique de rang disponible.</p>
                                )}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

// ✅ MISE À JOUR : Ajout de `status` et `rankHistory` aux PropTypes.
UserCompaniesList.propTypes = {
    employments: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            status: PropTypes.string.isRequired,
            company: PropTypes.shape({
                id: PropTypes.number.isRequired,
                name: PropTypes.string.isRequired,
            }).isRequired,
            rank: PropTypes.shape({
                name: PropTypes.string.isRequired,
            }).isRequired,
            rankHistory: PropTypes.arrayOf(
                PropTypes.shape({
                    id: PropTypes.number.isRequired,
                    assignedAt: PropTypes.string.isRequired,
                    rank: PropTypes.shape({
                        name: PropTypes.string.isRequired,
                    }).isRequired
                })
            )
        })
    ),
};

export default UserCompaniesList;