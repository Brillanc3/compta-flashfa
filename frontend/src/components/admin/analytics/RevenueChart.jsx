// frontend/src/components/admin/analytics/RevenueChart.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { LineChart } from '@mui/x-charts/LineChart';

const RevenueChart = ({ data, categories }) => {
    if (!data || data.length === 0) {
        return <div className="text-center text-slate-400 p-8">Aucune donnée de revenu pour aujourd'hui.</div>;
    }

    // Préparation des données pour MUI X Charts
    const xAxisData = data.map(item => item.time);
    const seriesData = categories.map(category => ({
        data: data.map(item => item[category.name] || 0),
        label: category.name.replace(/_/g, ' ').toLowerCase(),
        // On peut ajouter une couleur spécifique par catégorie ici
        // color: category.color,
        area: true, // Pour l'effet de dégradé
        showMark: false,
    }));

    return (
        <div className="bg-slate-800 p-4 rounded-lg shadow-md h-96">
            <h3 className="text-lg font-semibold text-white mb-4">Revenus de la journée (par minute)</h3>
            <LineChart
                xAxis={[{ scaleType: 'point', data: xAxisData }]}
                series={seriesData}
                sx={{
                    '.MuiChartsAxis-tickLabel': { fill: '#94a3b8' },
                    '.MuiChartsAxis-line': { stroke: '#475569' },
                    '.MuiChartsLegend-label': { color: '#cbd5e1' },
                    '.MuiAreaElement-root': {
                        fillOpacity: 0.3,
                    },
                }}
                slotProps={{
                    legend: {
                        labelStyle: {
                            color: '#cbd5e1',
                            fontSize: 12,
                        },
                    },
                }}
            />
        </div>
    );
};

RevenueChart.propTypes = {
    data: PropTypes.array.isRequired,
    categories: PropTypes.array.isRequired, // ex: [{name: 'CHIFFRE_AFFAIRES'}, {name: 'AUTRES_ENTREES'}]
};

export default RevenueChart;