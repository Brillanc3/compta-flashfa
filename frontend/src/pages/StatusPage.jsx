// /frontend/src/pages/StatusPage.jsx

import React, { useState, useEffect } from 'react';
import { getSystemStatus } from '@/services/statusService';
import Spinner from '@/components/ui/Spinner'; // Assure-toi que le chemin est correct

// Sous-composant pour l'indicateur de statut (pastille clignotante)
const StatusIndicator = ({ status }) => {
    const statusConfig = {
        operational: {
            color: 'green',
            text: 'Opérationnel',
        },
        degraded_performance: {
            color: 'orange',
            text: 'Performance Dégradée',
        },
        outage: {
            color: 'red',
            text: 'En Panne',
        },
    };

    const config = statusConfig[status] || { color: 'gray', text: 'Inconnu' };

    return (
        <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-${config.color}-400 opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 bg-${config.color}-500`}></span>
            </span>
            <span className={`text-${config.color}-400`}>{config.text}</span>
        </div>
    );
};


const StatusPage = () => {
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const data = await getSystemStatus();
                setModules(data);
            } catch (_err) {
                setError("Impossible de charger le statut du système. Veuillez réessayer plus tard.");
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
    }, []); // Le tableau vide assure que l'effet ne s'exécute qu'une seule fois au montage

    if (loading) {
        return <div className="flex justify-center items-center h-screen bg-slate-900"><Spinner /></div>;
    }

    if (error) {
        return <div className="flex justify-center items-center h-screen bg-slate-900 text-red-400">{error}</div>;
    }

    return (
        <div className="bg-slate-900 min-h-screen p-8 text-white">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold mb-2">Statut des Services</h1>
                <p className="text-slate-400 mb-8">Vue d'ensemble de la disponibilité de nos modules.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modules.map((module) => (
                        <div key={module.name} className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                            <h2 className="text-xl font-semibold capitalize mb-4">{module.name}</h2>
                            <StatusIndicator status={module.status} />
                        </div>
                    ))}
                </div>
                <div className="text-center mt-8 text-xs text-slate-500">
                    Dernière mise à jour : {new Date().toLocaleString('fr-FR')}
                </div>
            </div>
        </div>
    );
};

export default StatusPage;