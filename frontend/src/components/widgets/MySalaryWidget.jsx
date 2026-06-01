// /frontend/src/components/widgets/MySalaryWidget.jsx
import React, { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { getWidgetData_MySalary } from '@/services/dashboardService';
import Spinner from '@/components/ui/Spinner';
import { Eye, EyeOff, List } from 'lucide-react';

// Helper pour formater le template de détail
const formatTemplate = (template, variables) => {
    return template.replace(/{(\w+)}/g, (placeholder, key) => {
        return variables[key] !== undefined ? variables[key] : placeholder;
    });
};

const MySalaryWidget = () => {
    const { activeCompany } = useCompany();
    const companyId = Number(activeCompany?.id);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('simple'); // 'simple', 'min', 'max'

    useEffect(() => {
        if (!activeCompany) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await getWidgetData_MySalary(companyId, {}); // Config vide pour le moment
                setData(result);
            } catch (err) {
                setError("Impossible de charger les données du salaire.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [activeCompany, companyId]);

    const renderContent = () => {
        if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;
        if (error) return <p className="text-center text-rose-400 font-bold">{error}</p>;
        if (!data) return <p className="text-center text-cca-textSecondary/60 italic">Aucune donnée de salaire disponible pour cette entreprise.</p>;

        switch (viewMode) {
            case 'min':
                return (
                    <ul className="space-y-2 text-[11px] uppercase tracking-tight">
                        {data.breakdown.map((item, index) => (
                            <li key={index} className="flex justify-between items-center py-1 border-b border-cca-border/10 last:border-b-0">
                                <span className="text-cca-textSecondary/60 font-bold">{item.label}</span>
                                <span className="font-black text-cca-textPrimary">{item.value.toFixed(2)} $</span>
                            </li>
                        ))}
                        <li className="flex justify-between border-t border-cca-border/30 pt-3 mt-2">
                            <span className="text-cca-textSecondary font-black uppercase tracking-widest text-[9px]">TOTAL NET</span>
                            <span className="font-black text-emerald-400 text-sm">{data.finalSalary.toFixed(2)} $</span>
                        </li>
                    </ul>
                );
            case 'max':
                return (
                    <ul className="space-y-2 text-[10px]">
                        {data.breakdown.map((item, index) => (
                            <li key={index} className="p-3 bg-cca-base/40 border border-cca-border/20 rounded-xl">
                                <p className="text-cca-textSecondary font-black uppercase tracking-tighter mb-1">{item.label}</p>
                                <p className="font-mono text-brand-primary font-bold">{formatTemplate(item.template, { ...item.templateVariables, calculatedValue: item.value.toFixed(2) })}</p>
                            </li>
                        ))}
                        <li className="flex justify-between border-t border-cca-border/30 pt-3 mt-2">
                            <span className="text-cca-textSecondary font-black uppercase tracking-widest text-[9px]">TOTAL CALCULÉ</span>
                            <span className="font-black text-emerald-400 text-sm">{data.finalSalary.toFixed(2)} $</span>
                        </li>
                    </ul>
                );
            case 'simple':
            default:
                return (
                    <div className="text-center py-6">
                        <p className="text-5xl font-black font-mono text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]">{data.finalSalary.toFixed(2)} $</p>
                        {data.isCapped && (
                            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Plafonné à {data.salaryCap.toFixed(2)} $</p>
                            </div>
                        )}
                    </div>
                );
        }
    };

    const viewOptions = [
        { key: 'simple', icon: <Eye size={14}/>, label: 'Simple' },
        { key: 'min', icon: <List size={14}/>, label: 'Détail' },
        { key: 'max', icon: <EyeOff size={14}/>, label: 'Calcul' },
    ];

    return (
        <div className="h-full flex flex-col">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40 mb-4 border-b border-cca-border/20 pb-4 flex-shrink-0">
                AUDIT DU SALAIRE HEBDOMADAIRE
            </h3>
            <div className="flex-shrink-0 mb-6 p-1 bg-cca-base/40 border border-cca-border/20 rounded-xl flex justify-around">
                {viewOptions.map(opt => (
                    <button
                        key={opt.key}
                        onClick={() => setViewMode(opt.key)}
                        className={`flex-1 text-center text-[10px] uppercase font-black tracking-widest py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${viewMode === opt.key ? 'bg-brand-primary text-white shadow-lg' : 'text-cca-textSecondary/60 hover:bg-cca-surface/20'}`}
                    >
                        {opt.icon}
                        <span className="hidden sm:inline">{opt.label}</span>
                    </button>
                ))}
            </div>
            <div className="flex-grow flex items-center">
                <div className="w-full">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default MySalaryWidget;