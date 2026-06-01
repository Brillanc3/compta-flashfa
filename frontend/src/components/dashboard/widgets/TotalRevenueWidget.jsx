// frontend/src/components/dashboard/widgets/TotalRevenueWidget.jsx

import React, { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext.jsx';
import { getCompanyAnalytics } from '@/services/analyticsService.js';

// On importe les composants depuis Shadcn/UI
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

const TotalRevenueWidget = () => {
    const { activeCompany } = useCompany();
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!activeCompany) return;
        setLoading(true);
        setError(null);
        const fetchData = async () => {
            try {
                const analyticsData = await getCompanyAnalytics(activeCompany.id, 'week');
                if (analyticsData && analyticsData.kpis) {
                    setTotalRevenue(analyticsData.kpis.totalRevenue);
                }
            } catch (err) {
                setError("Impossible de charger les données.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [activeCompany]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
        }).format(value);
    };

    // On utilise la structure de la Card de Shadcn
    if (loading) {
        return (
            <div className="animate-pulse flex flex-col h-full gap-4">
                <div className="h-4 bg-cca-base/40 rounded-lg w-1/3"></div>
                <div className="h-10 bg-cca-base/40 rounded-xl w-2/3"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col h-full gap-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60">Chiffre d'Affaires (7j)</h3>
                <div className="text-xl font-black text-rose-400">ERREUR</div>
                <p className="text-[10px] text-cca-textSecondary/40 italic">{error}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 mb-2">Chiffre d'Affaires (7j)</h3>
            <div className="text-4xl font-black text-cca-textPrimary tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                {formatCurrency(totalRevenue)}
            </div>
        </div>
    );
};

export default TotalRevenueWidget;