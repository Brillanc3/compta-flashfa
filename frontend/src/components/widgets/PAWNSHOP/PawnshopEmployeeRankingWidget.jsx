// frontend/src/components/widgets/PAWNSHOP/PawnshopEmployeeRankingWidget.jsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Search, Trophy } from 'lucide-react';
import { getISOWeek, getISOWeekYear, setISOWeek, setISOWeekYear, startOfISOWeek, endOfISOWeek, format } from 'date-fns';
import { useCompany } from '@/contexts/CompanyContext';
import { getWidgetData_PawnshopEmployeeRanking } from '@/services/widgets/pawnshopEmployeeRanking.service';
import WeekSelector from '@/components/accounting/WeekSelector';

const METRIC_LABELS = {
    buyAmount: 'Achats',
    resaleAmount: 'Revente',
    count: 'Rachats',
};

function formatMoney(value) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

function getMetricValue(row, metric) {
    if (metric === 'resaleAmount') return row.totalResaleAmount;
    if (metric === 'count') return row.purchaseCount;
    return row.totalBuyAmount;
}

function formatMetricValue(value, metric) {
    if (metric === 'count') return `${value} rachat${value !== 1 ? 's' : ''}`;
    return formatMoney(value);
}

const RANK_COLORS = [
    'text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]',
    'text-slate-300 drop-shadow-[0_0_6px_rgba(148,163,184,0.5)]',
    'text-amber-600 drop-shadow-[0_0_6px_rgba(217,119,6,0.5)]',
];

const PawnshopEmployeeRankingWidget = ({ config }) => {
    const { activeCompany } = useCompany();
    const companyId = activeCompany?.id ?? null;

    const metric = config?.metric || 'buyAmount';
    const limit = config?.limit ?? null;
    const showSearch = config?.showSearch !== false;
    const showWeekFilter = config?.showWeekFilter !== false;

    const now = new Date();
    const [weekFilter, setWeekFilter] = useState({ year: getISOWeekYear(now), week: getISOWeek(now) });
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [search, setSearch] = useState('');

    const weekDateRange = useMemo(() => {
        const ref = setISOWeekYear(setISOWeek(new Date(), weekFilter.week), weekFilter.year);
        return {
            dateStart: format(startOfISOWeek(ref), 'yyyy-MM-dd'),
            dateEnd: format(endOfISOWeek(ref), 'yyyy-MM-dd'),
        };
    }, [weekFilter]);

    const fetchData = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const data = await getWidgetData_PawnshopEmployeeRanking(companyId, {
                ...config,
                ...weekDateRange,
            });
            setRows(Array.isArray(data?.rows) ? data.rows : []);
        } catch (err) {
            console.error('[PawnshopEmployeeRankingWidget] load failed', err);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [companyId, config, weekDateRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const sorted = useMemo(() => {
        return [...rows].sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric));
    }, [rows, metric]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const base = q
            ? sorted.filter((r) => {
                const name = r.employee?.user?.name || r.employee?.user?.username || '';
                return name.toLowerCase().includes(q);
            })
            : sorted;
        return limit ? base.slice(0, limit) : base;
    }, [sorted, search, limit]);

    if (loading && rows.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-cca-textSecondary/40 italic uppercase tracking-widest text-[10px]">
                Synchronisation…
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full gap-3 transition-opacity duration-150 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-cca-border/20 pb-3 flex-shrink-0">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40">
                    Classement — {METRIC_LABELS[metric] || 'Achats'}
                </h3>
                <div className="px-2 py-0.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-[9px] font-black text-brand-primary uppercase tracking-tighter">
                    {sorted.length} employé{sorted.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* Week filter */}
            {showWeekFilter && (
                <div className="flex-shrink-0">
                    <WeekSelector onWeekChange={setWeekFilter} />
                </div>
            )}

            {/* Search */}
            {showSearch && (
                <div className="flex-shrink-0 relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-cca-textSecondary/40 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un employé…"
                        className="w-full bg-cca-base/40 border border-cca-border/20 rounded-xl pl-8 pr-3 py-2 text-xs text-cca-textPrimary placeholder-cca-textSecondary/30 focus:outline-none focus:border-brand-primary/50 transition-colors"
                    />
                </div>
            )}

            {/* List */}
            {filtered.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-cca-textSecondary/30 text-center space-y-2 py-10">
                    <Trophy className="w-8 h-8 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest italic">
                        {search ? 'Aucun résultat' : 'Aucune donnée'}
                    </p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto glass-scroll pr-1">
                    <div className="space-y-1.5 pb-2">
                        {filtered.map((row, idx) => {
                            const name = row.employee?.user?.name || row.employee?.user?.username || `Employé #${row.employeeId}`;
                            const value = getMetricValue(row, metric);
                            const rankColor = RANK_COLORS[idx] || 'text-cca-textSecondary/60';

                            return (
                                <div
                                    key={row.employeeId}
                                    className="flex items-center gap-3 rounded-xl bg-cca-base/40 border border-cca-border/20 p-3 hover:bg-cca-surface/20 transition-all shadow-sm hover:shadow-xl hover:scale-[1.01]"
                                >
                                    <div className={`w-6 text-center font-black text-xs flex-shrink-0 ${rankColor}`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-cca-textPrimary font-bold text-xs truncate" title={name}>
                                            {name}
                                        </div>
                                    </div>
                                    <div className="font-mono text-xs font-black text-cca-textPrimary flex-shrink-0">
                                        {formatMetricValue(value, metric)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

PawnshopEmployeeRankingWidget.propTypes = {
    config: PropTypes.object,
};

PawnshopEmployeeRankingWidget.defaultProps = {
    config: {},
};

export default PawnshopEmployeeRankingWidget;
