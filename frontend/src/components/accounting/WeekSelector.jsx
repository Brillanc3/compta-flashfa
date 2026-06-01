// frontend/src/components/accounting/WeekSelector.jsx
import React, { useState, useEffect, useRef } from 'react';
import { getISOWeek, getISOWeekYear, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WeekSelector = ({ onWeekChange }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const isInitialMount = useRef(true);
    const onWeekChangeRef = useRef(onWeekChange);

    const year = getISOWeekYear(currentDate);
    const week = getISOWeek(currentDate);

    useEffect(() => {
        onWeekChangeRef.current = onWeekChange;
    }, [onWeekChange]);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (typeof onWeekChangeRef.current === 'function') {
            onWeekChangeRef.current({ year, week });
        }
    }, [year, week]);

    const goToPreviousWeek = () => {
        setCurrentDate(prev => subWeeks(prev, 1));
    };

    const goToNextWeek = () => {
        setCurrentDate(prev => addWeeks(prev, 1));
    };

    return (
        <div className="flex items-center justify-center gap-3 px-4 h-[56px] bg-cca-surface/40 backdrop-blur-xl border border-cca-border rounded-2xl shadow-lg">
            <button
                onClick={goToPreviousWeek}
                className="p-1 px-2 rounded-xl bg-cca-base hover:bg-cca-surface border border-cca-border text-cca-textSecondary hover:text-cca-textPrimary transition-all active:scale-90 shadow-sm"
                title="Semaine précédente"
            >
                <ChevronLeft size={18} strokeWidth={2.5} />
            </button>

            <div className="text-center min-w-[100px]">
                <div className="flex items-center justify-center gap-1.5 leading-none">
                    <span className="text-lg font-black font-heading text-cca-textPrimary tracking-tight">
                        W{String(week).padStart(2, '0')}
                    </span>
                    <span className="text-xs font-bold text-brand-primary/80">
                        {year}
                    </span>
                </div>
                <div className="text-[8px] uppercase tracking-[0.2em] font-black text-cca-textSecondary/40 mt-0.5">
                    Période
                </div>
            </div>

            <button
                onClick={goToNextWeek}
                className="p-1 px-2 rounded-xl bg-cca-base hover:bg-cca-surface border border-cca-border text-cca-textSecondary hover:text-cca-textPrimary transition-all active:scale-90 shadow-sm"
                title="Semaine suivante"
            >
                <ChevronRight size={18} strokeWidth={2.5} />
            </button>
        </div>
    );
};

export default WeekSelector;