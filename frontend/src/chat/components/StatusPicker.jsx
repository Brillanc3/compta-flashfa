import React from 'react';

const STATUSES = [
    { value: 'ONLINE', label: 'En ligne', color: 'bg-green-500' },
    { value: 'IDLE', label: 'Absent', color: 'bg-yellow-500' },
    { value: 'DND', label: 'Ne pas déranger', color: 'bg-red-500' },
    { value: 'INVISIBLE', label: 'Invisible', color: 'bg-zinc-500' },
];

export default function StatusPicker({ currentStatus, onSelect, onClose }) {
    return (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-cca-surface border border-cca-border rounded-xl shadow-2xl z-50 overflow-hidden py-1">
            {STATUSES.map(s => (
                <button
                    key={s.value}
                    type="button"
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-cca-base/60 transition-colors ${
                        currentStatus === s.value ? 'text-cca-textPrimary font-semibold' : 'text-cca-textSecondary'
                    }`}
                    onClick={() => { onSelect(s.value); onClose(); }}
                >
                    <span className={`w-3 h-3 rounded-full ${s.color} shrink-0`} />
                    {s.label}
                    {currentStatus === s.value && <span className="ml-auto text-brand-primary">✓</span>}
                </button>
            ))}
        </div>
    );
}
