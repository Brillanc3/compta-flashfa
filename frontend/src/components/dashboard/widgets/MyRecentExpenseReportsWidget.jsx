// frontend/src/components/dashboard/widgets/MyRecentExpenseReportsWidget.jsx
import React, { useState, useEffect } from 'react';
import { useCompany } from '../../../contexts/CompanyContext';
// MODIFIÉ : On importe la nouvelle fonction depuis dashboardService
import { getWidgetData_MyRecentExpenseReports } from '@/services/dashboardService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const StatusBadge = ({ status }) => {
    const statusStyles = {
        PENDING: { text: 'EN ATTENTE', class: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
        REIMBURSED: { text: 'REMBOURSÉ', class: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
        REJECTED: { text: 'REFUSÉ', class: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
    };
    const style = statusStyles[status] || { text: 'INCONNU', class: 'bg-cca-base/40 text-cca-textSecondary border-cca-border/10' };
    return (
        <span className={`px-2 py-0.5 text-[9px] font-black rounded-full border ${style.class}`}>
            {style.text}
        </span>
    );
};

const MyRecentExpenseReportsWidget = () => {
    const { selectedCompany } = useCompany();
    const [reports, setReports] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!selectedCompany?.id) return;

        const fetchReports = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // MODIFIÉ : On appelle la nouvelle fonction de service
                const userReports = await getWidgetData_MyRecentExpenseReports(selectedCompany.id);
                setReports(userReports); // La nouvelle route ne renvoie que les 5 plus récentes
            } catch (err) {
                setError("Impossible de charger les notes de frais.");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReports();
    }, [selectedCompany]);

    const renderContent = () => {
        if (isLoading) {
            return <p className="text-center text-cca-textSecondary/60 italic py-10">Chargement...</p>;
        }
        if (error) {
            return <p className="text-center text-rose-400 py-10 font-bold">{error}</p>;
        }
        if (reports.length === 0) {
            return <p className="text-center text-cca-textSecondary/60 italic py-10">Aucune note de frais récente.</p>;
        }

        return (
            <ul className="space-y-2">
                {reports.map(report => (
                    <li key={report.id} className="flex justify-between items-center bg-cca-base/40 border border-cca-border/20 p-3 rounded-xl hover:bg-cca-surface/20 transition-all group">
                        <div>
                            <p className="font-black text-cca-textPrimary text-sm group-hover:text-brand-primary transition-colors">
                                {parseFloat(report.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                            </p>
                            <p className="text-[10px] text-cca-textSecondary/50 font-bold uppercase tracking-tighter">
                                {format(new Date(report.date), 'd MMM yyyy', { locale: fr })}
                            </p>
                        </div>
                        <StatusBadge status={report.status} />
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <div className="bg-transparent text-cca-textPrimary h-full flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-widest mb-4 border-b border-cca-border/20 pb-4 flex-shrink-0 opacity-80">
                Notes de Frais
            </h3>
            <div className="overflow-y-auto flex-grow">
                {renderContent()}
            </div>
        </div>
    );
};

export default MyRecentExpenseReportsWidget;