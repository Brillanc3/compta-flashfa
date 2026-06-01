// frontend/src/components/dashboard/widgets/TransactionLogWidget.jsx

import React, { useState, useEffect, useCallback  } from 'react';
import PropTypes from 'prop-types';
import { useCompany } from '@/contexts/CompanyContext.jsx';
import { getWidgetData_TransactionLog } from '@/services/dashboardService.js';
import Spinner from '../../ui/Spinner';
import { BarChart, LineChart, PieChart } from '@mui/x-charts';
import useWebSocketListener from '../../../hooks/useWebSocketListener';



// --- Sous-composant pour l'affichage en TABLEAU ---
const TransactionTable = ({ transactions }) => {
    if (!Array.isArray(transactions)) {
        return <p className="text-center text-xs text-cca-textSecondary/40 italic py-6">Données corrompues</p>;
    }
    if (transactions.length === 0) {
        return <p className="text-center text-xs text-cca-textSecondary/40 italic py-6">Aucun flux récent</p>;
    }
    return (
        <ul className="space-y-3 overflow-y-auto h-full pr-2 glass-scroll">
            {transactions.map(tx => (
                <li key={tx.id} className="flex justify-between items-center p-3 rounded-xl bg-cca-base/40 border border-cca-border/30 hover:bg-cca-surface/20 transition-all group">
                    <div className="min-w-0">
                        <p className="font-black text-cca-textPrimary truncate text-xs uppercase tracking-tight">{tx.description}</p>
                        <p className="text-[10px] font-bold text-cca-textSecondary/50 uppercase tracking-tighter">
                            {tx.category?.name || 'Inclassable'} • {new Date(tx.date).toLocaleDateString('fr-FR')}
                        </p>
                    </div>
                    <span className={`font-mono font-black text-sm shrink-0 ml-4 ${tx.category?.type === 'REVENUE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tx.category?.type === 'REVENUE' ? '+' : '-'}
                        {parseFloat(tx.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'USD' })}
                    </span>
                </li>
            ))}
        </ul>
    );
};
TransactionTable.propTypes = { transactions: PropTypes.array };

// --- Sous-composant pour l'affichage en GRAPHIQUE ---
const TransactionChart = ({ chartData, config }) => {
    if (!chartData || !Array.isArray(chartData.data) || !Array.isArray(chartData.labels)) {
        return <p className="text-center text-cca-textSecondary/60 italic py-6">Données invalides pour le graphique.</p>;
    }
    if (chartData.data.length === 0) {
        return <p className="text-center text-cca-textSecondary/60 italic py-6">Pas de données pour le graphique.</p>;
    }

    const chartType = config?.chartType || 'BAR';

    const chartStyles = {
        '.MuiChartsAxis-tickLabel': { fill: 'var(--cca-textSecondary)', fontSize: '10px', fontWeight: 'bold' },
        '.MuiChartsAxis-line': { stroke: 'var(--cca-border)' },
        '.MuiChartsGrid-line': { stroke: 'var(--cca-border)', opacity: 0.2 },
        '.MuiChartsLegend-text': { fill: 'var(--cca-textSecondary)', fontSize: '10px' },
    };

    switch (chartType) {
        case 'LINE':
            return <LineChart series={[{ data: chartData.data, color: 'rgb(var(--brand-primary-rgb))', area: true }]} xAxis={[{ scaleType: 'band', data: chartData.labels }]} sx={chartStyles} />;
        case 'DONUT': {
            const pieChartData = chartData.labels.map((label, index) => ({ id: index, value: chartData.data[index], label }));
            return <PieChart series={[{ data: pieChartData, innerRadius: 40, outerRadius: 70 }]} sx={chartStyles} slotProps={{ legend: { hidden: true } }} />;
        }
        case 'BAR':
        default:
            return <BarChart series={[{ data: chartData.data, color: 'rgb(var(--brand-primary-rgb))' }]} xAxis={[{ scaleType: 'band', data: chartData.labels }]} sx={chartStyles} />;
    }
};
TransactionChart.propTypes = { chartData: PropTypes.object, config: PropTypes.object };

// --- Composant Principal "Aiguilleur" ---
const TransactionLogWidget = ({ config }) => {
    const { selectedCompany } = useCompany();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const variantType = config?.variantType || 'TABLE_VIEW';

    const fetchData = useCallback(async () => {
        if (!selectedCompany) return;
        setLoading(true);
        setError(null);
        try {
            const result = await getWidgetData_TransactionLog(selectedCompany.id, config);
            setData(result);
        } catch {
            setError("Impossible de charger les données.");
        } finally {
            setLoading(false);
        }
    }, [selectedCompany, config]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- 2. BRANCHEMENT AU WEBSOCKET ---
    // On s'abonne aux événements en temps réel
    const handleNewTransaction = useCallback((payload) => {
        // payload est directement l'objet transaction envoyé par le backend
        if (!payload || !payload.id) return;
        if (payload.companyId !== selectedCompany?.id) return;

        if (variantType === 'TABLE_VIEW') {
            // Mise à jour optimiste : on ajoute la transaction sans recharger
            setData(prevData => {
                const currentTransactions = Array.isArray(prevData) ? prevData : [];
                // Sécurité pour éviter les doublons
                if (currentTransactions.some(tx => tx.id === payload.id)) {
                    return currentTransactions;
                }
                return [payload, ...currentTransactions];
            });
        } else if (variantType === 'CHART_VIEW') {
            // Pour le graphique, un rafraîchissement complet est nécessaire
            fetchData();
        }
    }, [variantType, fetchData, selectedCompany]);
    useWebSocketListener('TRANSACTION_CREATED', handleNewTransaction);
    // --- FIN DU BRANCHEMENT ---

    const renderContent = () => {
        if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;
        if (error) return <p className="text-center text-xs text-rose-400 font-bold py-6">{error}</p>;

        if (variantType === 'CHART_VIEW') {
            return <TransactionChart chartData={data} config={config} />;
        }
        return <TransactionTable transactions={data} />;
    };

    return (
        <div className="h-full flex flex-col bg-cca-surface/10 backdrop-blur-3xl p-6 rounded-[2rem] border border-cca-border/30 shadow-2xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40 mb-6 border-b border-cca-border/20 pb-4 flex-shrink-0">
                Audit des Flux
            </h3>
            <div className="flex-grow min-h-0">
                {renderContent()}
            </div>
        </div>
    );
};

TransactionLogWidget.propTypes = { config: PropTypes.object };
TransactionLogWidget.defaultProps = { config: { variantType: 'TABLE_VIEW', transactionCount: 10 } };

export default TransactionLogWidget;