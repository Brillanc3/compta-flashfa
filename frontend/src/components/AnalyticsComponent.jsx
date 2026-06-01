// frontend/src/components/AnalyticsComponent.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { getAnalyticsData } from '../services/analyticsService';
import { LineChart } from '@mui/x-charts/LineChart';
import { ThemeProvider, createTheme } from '@mui/material/styles';
// On importe les fonctions de date-fns dont nous avons besoin
import { format, startOfWeek, endOfWeek, addDays, subDays, isFuture, isThisWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

const darkTheme = createTheme({ palette: { mode: 'dark' } });

const AnalyticsComponent = ({ companyId }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [period, _setPeriod] = useState('week');

    const weekRange = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return { start, end };
    }, [currentDate]);

    useEffect(() => {
        if (!companyId) return;
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);
                const params = { period, date: currentDate.toISOString() };
                const analyticsData = await getAnalyticsData(companyId, params);
                setData(analyticsData);
            } catch (err) {
                setError(err.message || 'Erreur lors de la récupération des données.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [companyId, currentDate, period]);

    const goToPreviousWeek = () => setCurrentDate(prev => subDays(prev, 7));
    const goToNextWeek = () => setCurrentDate(prev => addDays(prev, 7));

    if (loading) return <div className="text-center p-8">Chargement des statistiques...</div>;
    if (error) return <div className="text-red-500 text-center p-8">Erreur : {error}</div>;
    if (!data) return null;

    // --- NOUVELLE LOGIQUE POUR LES MESSAGES CONDITIONNELS ---
    const hasData = data.kpis.totalRevenue > 0 || data.kpis.totalExpenses > 0;

    // Si aucune donnée n'existe pour la période sélectionnée
    if (!hasData) {
        const isFutureWeek = isFuture(weekRange.start);
        const isCurrentWeek = isThisWeek(weekRange.start, { weekStartsOn: 1 });

        let message = "Aucune donnée enregistrée pour cette période.";
        if (isFutureWeek) {
            message = "La semaine n'a pas encore commencé.";
        } else if (isCurrentWeek) {
            message = "En attente d'une transaction pour la semaine en cours.";
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-center space-x-4 p-4 bg-white rounded-lg shadow-md">
                    <button onClick={goToPreviousWeek} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">‹ Sem. Préc.</button>
                    <div className="font-semibold text-lg text-slate-700 text-center">
                        {format(weekRange.start, 'd MMM', { locale: fr })} - {format(weekRange.end, 'd MMM yyyy', { locale: fr })}
                    </div>
                    <button onClick={goToNextWeek} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Sem. Suiv. ›</button>
                </div>
                <div className="bg-white text-center p-12 rounded-lg shadow-md">
                    <p className="text-gray-500 font-medium">{message}</p>
                </div>
            </div>
        );
    }

    // Si on a des données, on affiche le dashboard complet
    return (
        <ThemeProvider theme={darkTheme}>
            <div className="space-y-6">
                <div className="flex items-center justify-center space-x-4 p-4 bg-white rounded-lg shadow-md">
                    <button onClick={goToPreviousWeek} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">‹ Sem. Préc.</button>
                    <div className="font-semibold text-lg text-slate-700 text-center">
                        {format(weekRange.start, 'd MMM', { locale: fr })} - {format(weekRange.end, 'd MMM yyyy', { locale: fr })}
                    </div>
                    <button onClick={goToNextWeek} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Sem. Suiv. ›</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <p className="text-sm font-medium text-gray-500">Revenus Totaux (semaine)</p>
                        <p className="text-3xl font-bold text-green-600 mt-1">${data.kpis.totalRevenue.toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <p className="text-sm font-medium text-gray-500">Dépenses Totales (semaine)</p>
                        <p className="text-3xl font-bold text-red-600 mt-1">${data.kpis.totalExpenses.toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <p className="text-sm font-medium text-gray-500">Bénéfice Net (semaine)</p>
                        <p className={`text-3xl font-bold mt-1 ${data.kpis.netProfit >= 0 ? 'text-slate-800' : 'text-orange-500'}`}>
                            ${data.kpis.netProfit.toLocaleString('fr-FR')}
                        </p>
                    </div>
                </div>

                <div className="bg-slate-800 p-6 rounded-lg shadow-md h-96">
                    <LineChart
                        xAxis={[{ scaleType: 'point', data: data.timeSeries.labels }]}
                        series={[
                            { data: data.timeSeries.revenue, label: 'Revenus', color: '#4ade80' },
                            { data: data.timeSeries.expenses, label: 'Dépenses', color: '#f87171' },
                        ]}
                    />
                </div>
            </div>
        </ThemeProvider>
    );
};

export default AnalyticsComponent;