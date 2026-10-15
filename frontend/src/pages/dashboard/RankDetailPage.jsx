// frontend/src/pages/dashboard/RankDetailPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRankDetails } from '../../services/employeesService';
import {useCompany} from "@/contexts/CompanyContext.jsx";

const RankDetailPage = () => {
    const { rankId } = useParams();
    const {activeCompanyId} = useCompany();
    const [rank, setRank] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        if (!activeCompanyId) return;
        try {
            setLoading(true);
            setError(null);
            setRank(await getRankDetails(rankId));
        } catch (err) {
            setError(err?.message || "Erreur lors du chargement des données.");
        } finally {
            setLoading(false);
        }
    }, [activeCompanyId, rankId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) return <div>Chargement du rang...</div>;
    if (error) return <div className="text-red-500">Erreur : {error}</div>;
    if (!rank) return <div>Rang non trouvé.</div>;

    return (
        <div className="text-white">
            <Link to="/dashboard/company/ranks" className="text-blue-400 hover:underline mb-6 inline-block">
                &larr; Retour à la gestion des rangs
            </Link>

            <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
                <h1 className="text-3xl font-bold text-white">{rank.name}</h1>
                <div className="mt-2 text-gray-400 space-x-4">
                    <span>Position Hiérarchique : <span className="font-semibold text-gray-200">{rank.position}</span></span>
                    {rank.salaryCap != null && (
                        <span>Plafond de salaire : <span className="font-semibold text-gray-200">{Number(rank.salaryCap).toLocaleString('fr-FR')} $</span></span>
                    )}
                </div>

                {/* Section des employés rattachés */}
                <div className="mt-8">
                    <h2 className="text-xl font-bold text-white mb-4">Employés ayant ce rang</h2>
                    <div className="bg-slate-900 rounded-md p-4">
                        {rank.employees && rank.employees.length > 0 ? (
                            <ul className="divide-y divide-slate-700">
                                {rank.employees.map(employee => (
                                    <li key={employee.id} className="py-2">
                                        {employee.user?.name}
                                        {employee.user?.username && (
                                            <span className="ml-2 text-sm text-gray-500">@{employee.user.username}</span>
                                        )}
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