// frontend/src/components/admin/analytics/KpiCard.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { LineChart } from '@mui/x-charts'; // Pour la petite ligne de tendance

const KpiCard = ({ title, value, icon, _data = [] }) => {
    const IconComponent = icon;
    const displayValue = typeof value === 'number' ? value.toLocaleString('fr-FR') : 'N/A';

    return (
        <div className="bg-slate-800 p-4 rounded-lg shadow-md flex justify-between items-center">
            <div>
                <p className="text-sm font-medium text-slate-400">{title}</p>
                <p className="text-3xl font-bold text-white">{displayValue}</p>
            </div>
            <div className="w-24 h-12">
                {IconComponent && <IconComponent className="h-8 w-8 text-indigo-400 mb-2" />}
                {/* Exemple de petit graphique de tendance si des données sont fournies */}
                {/* <LineChart
                    series={[{ data, showMark: false, color: '#818cf8' }]}
                    width={100}
                    height={50}
                    margin={{ top: 10, right: 0, bottom: 0, left: 0 }}
                    sx={{ '.MuiLineElement-root': { strokeWidth: 2 }, '.MuiChartsAxis-root': { display: 'none' } }}
                /> */}
            </div>
        </div>
    );
};

KpiCard.propTypes = {
    title: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    icon: PropTypes.elementType,
};

export default KpiCard;