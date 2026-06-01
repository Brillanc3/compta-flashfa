import React from 'react';

export default function NotifToggle({ label, icon, checked, onChange, disabled = false, accent = 'brand' }) {
    const accentClass = accent === 'red' ? 'bg-red-500' : 'bg-brand-primary';
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange(!checked)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-cca-base/60 cursor-pointer'}`}
        >
            <span className={`flex items-center gap-2 ${checked && !disabled ? 'text-cca-textPrimary' : 'text-cca-textSecondary'}`}>
                {icon}
                {label}
            </span>
            <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border border-cca-border transition-colors ${checked ? accentClass + ' border-transparent' : 'bg-cca-base'}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-3' : 'translate-x-0.5'}`} />
            </span>
        </button>
    );
}
