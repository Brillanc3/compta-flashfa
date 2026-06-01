// frontend/src/components/accounting/ChartControls.jsx
import React from 'react';

const ControlButton = ({ children, onClick, isActive }) => (
    <button
        type="button"
        onClick={onClick}
        className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all active:scale-95 border ${
            isActive
                ? "bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20"
                : "bg-cca-base hover:bg-cca-surface text-cca-textSecondary border-cca-border"
        }`}
    >
        {children}
    </button>
);

const ChartControls = ({ view, onViewChange }) => {
    const timeRanges = [
        { key: 'week', label: 'Semaine' },
        { key: 'monday', label: 'Lun' },
        { key: 'tuesday', label: 'Mar' },
        { key: 'wednesday', label: 'Mer' },
        { key: 'thursday', label: 'Jeu' },
        { key: 'friday', label: 'Ven' },
        { key: 'saturday', label: 'Sam' },
        { key: 'sunday', label: 'Dim' },
    ];

    const isSingleDay = view.timeRange !== 'week';
    const granularities = isSingleDay
        ? [ { key: '15-minutes', label: '15 min' }, { key: '30-minutes', label: '30 min' }, { key: 'hourly', label: '1h' }]
        : [ { key: 'daily', label: 'Jour' }, { key: '6-hourly', label: '6h' }, { key: '2-hourly', label: '2h' }];

    const handleTimeRangeChange = (newTimeRangeKey) => {
        const newView = { ...view, timeRange: newTimeRangeKey };
        const wasWeek = view.timeRange === 'week';
        const isNowWeek = newTimeRangeKey === 'week';

        if (isNowWeek && !wasWeek) {
            newView.granularity = 'daily';
        } else if (!isNowWeek && wasWeek) {
            newView.granularity = 'hourly';
        }
        onViewChange(newView);
    };

    return (
        <div className="space-y-4 p-5 bg-cca-base/40 border border-cca-border rounded-2xl shadow-inner">
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-cca-textSecondary/60 mr-2">Période</span>
                <div className="flex flex-wrap gap-2">
                    {timeRanges.map(range => (
                        <ControlButton
                            key={range.key}
                            onClick={() => handleTimeRangeChange(range.key)}
                            isActive={view.timeRange === range.key}
                        >
                            {range.label}
                        </ControlButton>
                    ))}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-cca-textSecondary/60 mr-2">Intervalle</span>
                <div className="flex flex-wrap gap-2">
                    {granularities.map(gran => (
                        <ControlButton
                            key={gran.key}
                            onClick={() => onViewChange({ ...view, granularity: gran.key })}
                            isActive={view.granularity === gran.key}
                        >
                            {gran.label}
                        </ControlButton>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ChartControls;