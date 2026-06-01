// frontend/src/pages/dashboard/RankDetailPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCompanyRanks } from '../../services/rankService'; // Nous allons devoir créer un service pour obtenir un rang par ID
import {useCompany} from "@/contexts/CompanyContext.jsx";

// NOTE: Pour que cette page fonctionne, nous devrons créer une nouvelle route et un nouveau contrôleur
// sur le backend pour récupérer les détails d'un seul rang, y compris les employés.
// Pour l'instant, nous simulons la récupération en filtrant la liste complète.

const RankDetailPage = () => {
    const { rankId } = useParams();
    const {activeCompanyId} = useCompany();
    const companyId = activeCompanyId;
    const [rank, setRank] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            // Idéalement : const rankData = await getRankById(companyId, rankId);
            // Solution temporaire : on charge tous les rangs et on filtre.
            const allRanks = await getCompanyRanks(companyId);
            const currentRank = allRanks.find(r => r.id === parseInt(rankId, 10));

            if (currentRank) {
                // TODO: La liste des employés n'est pas encore dans les données.
                // Il faudra mettre à jour l'API pour l'inclure.
                // Pour l'instant, on simule.
                currentRank.employees = [{ id: 1, name: 'John Doe (Exemple)' }, { id: 2, name: 'Jane Doe (Exemple)' }];
                setRank(currentRank);
            } else {
                setError("Rang non trouvé.");
            }
        } catch (err) {
            setError(err.message || "Erreur lors du chargement des données.");
        } finally {
            setLoading(false);
        }
    }, [companyId, rankId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) return <div>Chargement du rang...</div>;
    if (error) return <div className="text-red-500">Erreur : {error}</div>;
    if (!rank) return <div>Rang non trouvé.</div>;

    return (
        <div className="text-white">
            <Link to={`/dashboard/company/${companyId}/ranks`} className="text-blue-400 hover:underline mb-6 inline-block">
                &larr; Retour à la gestion des rangs
            </Link>

            <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
                <h1 className="text-3xl font-bold text-white">{rank.name}</h1>
                <div className="mt-2 text-gray-400 space-x-4">
                    <span>Position Hiérarchique : <span className="font-semibold text-gray-200">{rank.position}</span></span>
                    <span>Commission : <span className="font-semibold text-gray-200">{rank.commissionRate * 100}%</span></span>
                </div>

                {/* Section des employés rattachés */}
                <div className="mt-8">
                    <h2 className="text-xl font-bold text-white mb-4">Employés ayant ce rang</h2>
                    <div className="bg-slate-900 rounded-md p-4">
                        {rank.employees && rank.employees.length > 0 ? (
                            <ul className="divide-y divide-slate-700">
                                {rank.employees.map(employee => (
                                    <li key={employee.id} className="py-2">
                                        {employee.name}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500">Aucun employé n'est actuellement rattaché à ce rang.</p>
                        )}
                    </div>
                </div>
                {/* Section des permissions */}
                <div className="mt-8">
                    <h2 className="text-xl font-bold text-white mb-4">Permissions Accordées</h2>
                    <div className="bg-slate-900 rounded-md p-4">
                        {rank.permissionTemplates && rank.permissionTemplates.length > 0 ? (
                            <ul className="space-y-1">
                                {rank.permissionTemplates.map(pt => (
                                    <li key={pt.id} className="font-mono text-sm text-green-400">
                                        {pt.action}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500">Aucune permission spécifique n'est définie pour ce rang.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RankDetailPage;