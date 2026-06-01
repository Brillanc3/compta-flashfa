// frontend/src/components/dashboard/employees/hr/HREventBadge.jsx

import React from 'react';
import { AlertTriangle, Star, DollarSign, FileText } from 'lucide-react';

const CONFIG = {
    AVERTISSEMENT: {
        label: 'Avertissement',
        icon: AlertTriangle,
        className: 'bg-red-500/10 text-red-400 border-red-500/30',
    },
    FELICITATION: {
        label: 'Félicitation',
        icon: Star,
        className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
    PRIME: {
        label: 'Prime',
        icon: DollarSign,
        className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    },
    NOTE: {
        label: 'Note',
        icon: FileText,
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    },
};

const HREventBadge = ({ type }) => {
    const cfg = CONFIG[type] ?? CONFIG.NOTE;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${cfg.className}`}>
            <Icon size={10} />
            {cfg.label}
        </span>
    );
};

export default HREventBadge;
