import React from 'react';

function TriToggle({ current, onChange }) {
    return (
        <div className="inline-flex items-center gap-1 rounded-full bg-cca-base border border-cca-border p-1 shadow-inner">
            <button type="button" onClick={() => onChange('deny')}
                className={`h-7 w-7 flex items-center justify-center text-[10px] rounded-full transition-all active:scale-90 ${current === 'deny' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-cca-textSecondary hover:bg-cca-surface/80'}`}>
                ✕
            </button>
            <button type="button" onClick={() => onChange(null)}
                className={`h-7 w-7 flex items-center justify-center text-[10px] rounded-full transition-all active:scale-90 ${current == null ? 'bg-cca-surface text-cca-textPrimary shadow-md' : 'text-cca-textSecondary hover:bg-cca-surface/80'}`}>
                /
            </button>
            <button type="button" onClick={() => onChange('allow')}
                className={`h-7 w-7 flex items-center justify-center text-[10px] rounded-full transition-all active:scale-90 ${current === 'allow' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-cca-textSecondary hover:bg-cca-surface/80'}`}>
                ✓
            </button>
        </div>
    );
}

export default function PermissionsMatrix({ override, catalog, onChangePerm }) {
    return (
        <div className="mt-2 space-y-2">
            {catalog.map((perm) => {
                const v = override.permissions?.[perm.key] ?? null;
                return (
                    <div key={perm.key} className="flex items-start justify-between gap-3 py-2 px-2 rounded-lg hover:bg-cca-surface/20 transition-colors">
                        <div className="flex-1">
                            <div className="text-sm font-semibold text-cca-textPrimary">{perm.label}</div>
                            <div className="text-[11px] text-cca-textSecondary/70 leading-relaxed">{perm.description}</div>
                        </div>
                        <TriToggle current={v} onChange={(val) => onChangePerm(perm.key, val)} />
                    </div>
                );
            })}
        </div>
    );
}
