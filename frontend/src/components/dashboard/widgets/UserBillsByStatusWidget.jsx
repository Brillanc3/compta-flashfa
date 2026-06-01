// frontend/src/components/widgets/UserBillsByStatusWidget.jsx

import React, { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext.jsx';
import { getWidgetData_UserBillsByStatus } from '@/services/dashboardService';
import Spinner from '@/components/ui/Spinner';

// Un petit composant pour afficher une ligne de statistique
const StatRow = ({ label, value, colorClass = 'text-cca-textPrimary' }) => (
    <div className="flex justify-between items-center py-2 border-b border-cca-border/30 last:border-b-0">
        <span className="text-cca-textSecondary text-sm">{label}</span>
        <span className={`font-bold text-lg ${colorClass}`}>{value}</span>
    </div>
);

const UserBillsByStatusWidget = () => {
    const { selectedCompany } = useCompany();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeframe, setTimeframe] = useState('week'); // 'week' or 'all'

    useEffect(() => {
        if (!selectedCompany) return;

        const fetchStats = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getWidgetData_UserBillsByStatus(selectedCompany.id, { timeframe });
                setStats(data);
            } catch (err) {
                setError("Impossible de charger les statistiques.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [selectedCompany, timeframe]);

    const renderContent = () => {
        if (loading) {
            return <div className="flex justify-center items-center h-full"><Spinner /></div>;
        }
        if (error) {
            return <p className="text-center text-rose-400">{error}</p>;
        }
        if (!stats) {
            return <p className="text-center text-cca-textSecondary">Aucune donnée disponible.</p>;
        }

        // On calcule le total payé "mixte" comme demandé
        const totalPaid = stats.PAID_CASH + stats.PAID_CARD;

        return (
            <div className="space-y-3">
                <StatRow label="Total des factures" value={stats.TOTAL} colorClass="text-brand-primary" />
                <StatRow label="Factures impayées" value={stats.UNPAID} colorClass="text-amber-400" />
                <StatRow label="Payées (Cash + Carte)" value={totalPaid} colorClass="text-emerald-400" />
                <StatRow label="Factures annulées" value={stats.CANCELED} colorClass="text-cca-textSecondary/60" />
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0 mb-4">
                <h3 className="font-bold text-cca-textPrimary text-lg">Mes Factures par Statut</h3>
                {/* Sélecteur de période */}
                <div className="mt-2 w-full bg-cca-base/40 p-1 rounded-md flex border border-cca-border/20">
                    <button
                        onClick={() => setTimeframe('week')}
                        className={`flex-1 text-center text-sm py-1 rounded transition-colors ${timeframe === 'week' ? 'bg-brand-primary text-white' : 'text-cca-textSecondary hover:bg-cca-surface/20'}`}
                    >
                        Cette semaine
                    </button>
                    <button
                        onClick={() => setTimeframe('all')}
                        className={`flex-1 text-center text-sm py-1 rounded transition-colors ${timeframe === 'all' ? 'bg-brand-primary text-white' : 'text-cca-textSecondary hover:bg-cca-surface/20'}`}
                    >
                        Total
                    </button>
                </div>
            </div>
            <div className="flex-grow">
                {renderContent()}
            </div>
        </div>
    );
};

export default UserBillsByStatusWidget;