// /frontend/src/components/dashboard/employees/EmployeeInfoComponents.jsx

import React from 'react';

export const InfoCard = ({ icon, title, children, action }) => (
    <div className="relative overflow-hidden rounded-3xl bg-cca-surface/30 border border-cca-border/40 backdrop-blur-2xl shadow-2xl p-8 group">
        {/* Subtle halo */}
        <div className="absolute -inset-1 bg-gradient-to-tr from-brand-primary/0 via-brand-primary/5 to-brand-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

        <div className="relative">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <div className="p-3 rounded-2xl bg-cca-base/40 border border-cca-border shadow-inner">
                        {icon}
                    </div>
                    <h2 className="text-xl font-black text-cca-textPrimary font-heading uppercase tracking-tight ml-4">{title}</h2>
                </div>
                {action}
            </div>
            <div className="space-y-4">{children}</div>
        </div>
    </div>
);

export const InfoRow = ({ label, value }) => (
    <div className="grid grid-cols-3 gap-4 py-1 border-b border-cca-border/10 last:border-0 pb-3 last:pb-0">
        <span className="text-cca-textSecondary/40 text-[10px] font-black uppercase tracking-widest">{label}</span>
        <span className="col-span-2 text-cca-textPrimary font-bold font-mono text-sm break-all">{value || <span className="italic opacity-30">Non renseigné</span>}</span>
    </div>
);