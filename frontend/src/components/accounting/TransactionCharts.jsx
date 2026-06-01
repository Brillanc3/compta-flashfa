// frontend/src/components/accounting/TransactionCharts.jsx
import React, { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import {
    AreaChart,
    Area,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { format, startOfWeek, addDays, addMinutes, differenceInMinutes, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import ChartControls from './ChartControls';

const TransactionCharts = ({ transactions }) => {
    const [view, setView] = useState({ timeRange: 'week', granularity: 'daily' });
    const [visibility, setVisibility] = useState({
        revenue: true,
        deductible: true,
        nonDeductible: true,
    });
    const [isMinimized, setIsMinimized] = useState(false);

    const chartData = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];
        const firstDate = new Date(transactions[0].date);
        const weekStart = startOfWeek(firstDate, { weekStartsOn: 1 });
        let rangeStart, rangeEnd;
        if (view.timeRange === 'week') {
            rangeStart = weekStart;
            rangeEnd = endOfWeek(firstDate, { weekStartsOn: 1 });
        } else {
            const dayMapping = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
            const targetDayIndex = dayMapping[view.timeRange];
            rangeStart = addDays(weekStart, targetDayIndex);
            rangeEnd = endOfWeek(rangeStart, { weekStartsOn: 1 });
        }
        const filteredTx = transactions.filter(tx => {
            const txTime = new Date(tx.date).getTime();
            return txTime >= rangeStart.getTime() && txTime <= rangeEnd.getTime();
        });
        if (filteredTx.length === 0) return [];
        const bucketSizes = { 'daily': 1440, '6-hourly': 360, '2-hourly': 120, 'hourly': 60, '30-minutes': 30, '15-minutes': 15 };
        const bucketSizeMinutes = bucketSizes[view.granularity] || 60;
        const numBuckets = Math.ceil(differenceInMinutes(rangeEnd, rangeStart) / bucketSizeMinutes);
        const buckets = Array(numBuckets).fill(0).map((_, i) => ({
            date: addMinutes(rangeStart, i * bucketSizeMinutes).getTime(),
            revenue: 0, deductible: 0, nonDeductible: 0,
        }));
        filteredTx.forEach(tx => {
            const bucketIndex = Math.floor(differenceInMinutes(new Date(tx.date), rangeStart) / bucketSizeMinutes);
            if (buckets[bucketIndex]) {
                const amount = parseFloat(tx.amount);
                const cat = tx.category || { type: 'EXPENSE', isDeductible: false };
                if (cat.type === 'REVENUE') buckets[bucketIndex].revenue += amount;
                else if (cat.isDeductible) buckets[bucketIndex].deductible += amount;
                else buckets[bucketIndex].nonDeductible += amount;
            }
        });
        return buckets;
    }, [transactions, view]);

    const yDomain = useMemo(() => {
        let max = 0;
        chartData.forEach(d => {
            // Le max est maintenant le max de n'importe quelle valeur individuelle, pas la somme
            const currentMax = Math.max(
                visibility.revenue ? d.revenue : 0,
                visibility.deductible ? d.deductible : 0,
                visibility.nonDeductible ? d.nonDeductible : 0
            );
            if (currentMax > max) max = currentMax;
        });
        return [0, Math.ceil(max * 1.1) || 100];
    }, [chartData, visibility]);

    const handleLegendClick = (data) => {
        const { dataKey } = data;
        setVisibility(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
    };

    const renderLegendText = (value, entry) => {
        const { dataKey } = entry;
        const color = visibility[dataKey] ? 'var(--cca-textPrimary)' : 'var(--cca-textSecondary)';
        return (
            <span className="text-[11px] font-bold uppercase tracking-wider ml-2" style={{ color, cursor: 'pointer', opacity: visibility[dataKey] ? 1 : 0.4 }}>
                {value}
            </span>
        );
    };

    if (!transactions || transactions.length === 0) {
        return (
            <div className="bg-cca-surface/40 backdrop-blur-xl border border-cca-border p-8 rounded-2xl h-[400px] flex flex-col items-center justify-center gap-4 text-center">
                <div className="p-4 rounded-full bg-cca-base/50 border border-cca-border text-cca-textSecondary/40">
                    <AreaChart size={48} strokeWidth={1.5} />
                </div>
                <p className="text-sm font-bold text-cca-textSecondary/60 uppercase tracking-widest">Aucune donnée disponible</p>
            </div>
        );
    }

    return (
        <div className="bg-cca-surface/40 backdrop-blur-xl border border-cca-border p-5 rounded-2xl shadow-xl text-cca-textPrimary animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-black font-heading tracking-tight flex items-center gap-2">
                        <div className="w-2 h-6 bg-brand-primary rounded-full shadow-[0_0_12px_rgba(var(--brand-primary-rgb),0.5)]" />
                        Analyses financières
                    </h3>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cca-textSecondary/50 mt-1 ml-4">Activité détaillée</p>
                </div>
                <button 
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="p-2 rounded-xl bg-cca-base/40 border border-cca-border/50 text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-base/60 transition-all"
                >
                    {isMinimized ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </button>
            </div>

            <AnimatePresence initial={false}>
                {!isMinimized && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                    >
                        <ChartControls view={view} onViewChange={setView} />
                        
                        <div className="mt-4 relative" style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer>
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorDeductible" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#FB7185" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#FB7185" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorNonDeductible" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--cca-border)" strokeDasharray="4 4" vertical={false} opacity={0.5} />
                        <XAxis 
                            dataKey="date" 
                            domain={['dataMin', 'dataMax']} 
                            type="number" 
                            tickFormatter={(unixTime) => format(new Date(unixTime), 'EEE HH:mm', { locale: fr })} 
                            stroke="var(--cca-textSecondary)" 
                            opacity={0.5}
                            tick={{ fontSize: 10, fontWeight: 700 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis 
                            domain={yDomain} 
                            type="number" 
                            stroke="var(--cca-textSecondary)" 
                            opacity={0.5}
                            tickFormatter={(value) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value)}
                            tick={{ fontSize: 10, fontWeight: 700 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ stroke: 'var(--brand-primary)', strokeWidth: 2, strokeDasharray: '6 6' }}
                            contentStyle={{ 
                                backgroundColor: 'var(--cca-surface)', 
                                backdropFilter: 'blur(16px)',
                                border: '1px solid var(--cca-border)',
                                borderRadius: '16px',
                                boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
                                padding: '12px'
                            }}
                            itemStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                            labelStyle={{ color: 'var(--cca-textPrimary)', fontWeight: 'bold', marginBottom: '8px', fontSize: '12px' }}
                            labelFormatter={(label) => format(new Date(label), 'EEEE dd MMM, HH:mm', { locale: fr })}
                        />
                        <Legend 
                            onClick={handleLegendClick} 
                            formatter={renderLegendText} 
                            verticalAlign="top" 
                            align="right"
                            iconType="circle"
                            wrapperStyle={{ top: -45, right: 0 }}
                        />

                        <Area 
                            type="monotone" 
                            dataKey="deductible" 
                            name="Déductible" 
                            stroke="#FB7185" 
                            strokeWidth={3}
                            fill="url(#colorDeductible)" 
                            hide={!visibility.deductible} 
                            animationDuration={1500}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="nonDeductible" 
                            name="Non Déductible" 
                            stroke="#F59E0B" 
                            strokeWidth={3}
                            fill="url(#colorNonDeductible)" 
                            hide={!visibility.nonDeductible} 
                            animationDuration={1500}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="revenue" 
                            name="Revenu" 
                            stroke="#10B981" 
                            strokeWidth={3}
                            fill="url(#colorRevenue)" 
                            hide={!visibility.revenue} 
                            animationDuration={1500}
                        />
                    </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
            
            {isMinimized && (
                <div className="flex items-center gap-4 text-xs font-bold text-cca-textSecondary/40 uppercase tracking-widest mt-2">
                    <BarChart2 size={14} />
                    Cliquez sur la flèche pour afficher les analyses
                </div>
            )}
        </div>
    );
};

export default TransactionCharts;