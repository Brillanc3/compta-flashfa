// frontend/src/components/dashboard/widgets/ExpenseReportStatsWidget.jsx
import React, { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext.jsx';
// MODIFIÉ : On importe la nouvelle fonction depuis dashboardService
import { getWidgetData_ExpenseReportStats } from '@/services/dashboardService.js';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

const StatCard = ({ icon, label, value, colorClass }) => (
    <div className={`group flex items-center p-4 bg-cca-base/40 border border-cca-border/20 rounded-2xl transition-all hover:bg-cca-surface/30 hover:border-cca-border/40 hover:scale-[1.02] shadow-sm hover:shadow-xl`}>
        <div className={`mr-4 p-3 rounded-xl bg-cca-surface/40 ${colorClass} group-hover:scale-110 transition-transform`}>{icon}</div>
        <div>
            <p className="text-3xl font-black text-cca-textPrimary tracking-tight">{value}</p>
            <p className="text-[10px] uppercase font-bold text-cca-textSecondary/60 tracking-wider mt-1">{label}</p>
        </div>
    </div>
);


const ExpenseReportStatsWidget = () => {
    const { activeCompany } = useCompany();
    const [stats, setStats] = useState({ pending: 0, reimbursed: 0, rejected: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!activeCompany?.id) return;

        const fetchStats = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // MODIFIÉ : On appelle la nouvelle fonction de service
                const data = await getWidgetData_ExpenseReportStats(activeCompany.id);
                setStats(data);
            } catch (err) {
                setError("Impossible de charger les statistiques.");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, [activeCompany]);

    const renderContent = () => {
        if (isLoading) {
            return <p className="text-center text-cca-textSecondary/60 italic py-10">Chargement...</p>;
        }
        if (error) {
            return <p className="text-center text-rose-400 font-bold py-10">{error}</p>;
        }

        return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
                <StatCard
                    icon={<AlertTriangle size={24} />}
                    label="En attente"
                    value={stats.pending}
                    colorClass="text-amber-500"
                />
                <StatCard
                    icon={<CheckCircle2 size={24} />}
                    label="Remboursées"
                    value={stats.reimbursed}
                    colorClass="text-emerald-400"
                />
                <StatCard
                    icon={<XCircle size={24} />}
                    label="Refusées"
                    value={stats.rejected}
                    colorClass="text-rose-400"
                />
            </div>
        );
    };

    return (
        <div className="bg-transparent text-cca-textPrimary h-full flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-widest mb-4 border-b border-cca-border/20 pb-4 opacity-80">
                Synthèse Notes de Frais
            </h3>
            <div className="flex-grow flex items-center justify-center">
                {renderContent()}
            </div>
        </div>
    );
};

export default ExpenseReportStatsWidget;