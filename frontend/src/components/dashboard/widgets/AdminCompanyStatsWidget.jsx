// frontend/src/components/dashboard/widgets/AdminCompanyStatsWidget.jsx
import React, { useState } from 'react';
import { BarChart, Users, DollarSign, FileText, TrendingUp } from 'lucide-react';

const selectStyles = {
    control: (styles) => ({
        ...styles,
        backgroundColor: "rgb(var(--bg-base-rgb) / 0.4)",
        borderColor: "rgb(var(--border-color-rgb) / 0.2)",
        minHeight: 40,
        boxShadow: 'none',
        borderRadius: '12px',
        '&:hover': {
            borderColor: "rgb(var(--brand-primary-rgb) / 0.5)",
        }
    }),
    menu: (styles) => ({ ...styles, backgroundColor: "rgb(var(--bg-surface-rgb))", border: "1px solid rgb(var(--border-color-rgb) / 0.2)", borderRadius: '12px', overflow: 'hidden' }),
    option: (styles, { isFocused }) => ({
        ...styles,
        backgroundColor: isFocused ? "rgb(var(--brand-primary-rgb) / 0.2)" : "transparent",
        color: "rgb(var(--text-primary-rgb))",
        '&:active': {
            backgroundColor: "rgb(var(--brand-primary-rgb) / 0.4)",
        }
    }),
    singleValue: (styles) => ({ ...styles, color: "rgb(var(--text-primary-rgb))" }),
    input: (styles) => ({ ...styles, color: "rgb(var(--text-primary-rgb))" }),
    placeholder: (styles) => ({ ...styles, color: "rgb(var(--text-secondary-rgb) / 0.4)" }),
};

// MOCK: Liste des entreprises pour le sélecteur
const mockCompanies = [
    { value: 1, label: 'CCA (ID: 1)' },
    { value: 2, label: 'Tech Solutions (ID: 2)' },
];

// MOCK: Données statistiques pour l'affichage
const mockStats = {
    employees: 15,
    openBills: 3,
    totalRevenueLastMonth: 45000,
    moduleActiveCount: 7,
};

const StatCard = ({ icon: Icon, title, value, color }) => (
    <div className="p-4 bg-cca-base/40 border border-cca-border/50 rounded-2xl shadow-sm hover:bg-cca-surface/10 transition-all">
        <div className={`flex items-center ${color} mb-3`}>
            <Icon size={14} className="mr-2" />
            <span className="text-[10px] font-black uppercase tracking-widest text-cca-textSecondary/60">{title}</span>
        </div>
        <p className="text-xl font-black text-cca-textPrimary tracking-tight">{value}</p>
    </div>
);


const AdminCompanyStatsWidget = () => {
    const [selectedCompany, setSelectedCompany] = useState(mockCompanies[0]);

    // NOTE: Dans une implémentation réelle, ceci déclencherait un appel API
    const stats = mockStats;

    return (
        <div className="h-full flex flex-col">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40 mb-6 border-b border-cca-border/20 pb-4 flex-shrink-0">
                Audit Statistique Entreprise
            </h3>
            
            <div className="space-y-6 flex-grow overflow-y-auto pr-1 glass-scroll">

                {/* Sélecteur d'Entreprise */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/60 ml-1">Entité à Auditer</label>
                    <Select
                        options={mockCompanies}
                        onChange={setSelectedCompany}
                        value={selectedCompany}
                        placeholder="Rechercher une entreprise..."
                        styles={selectStyles}
                    />
                </div>

                {/* Grille des Statistiques */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                    <StatCard
                        icon={Users}
                        title="Employés"
                        value={stats.employees}
                        color="text-brand-primary"
                    />
                    <StatCard
                        icon={FileText}
                        title="Factures"
                        value={stats.openBills}
                        color="text-amber-500"
                    />
                    <StatCard
                        icon={DollarSign}
                        title="CA Mensuel"
                        value={`${stats.totalRevenueLastMonth.toLocaleString()} €`}
                        color="text-emerald-400"
                    />
                    <StatCard
                        icon={TrendingUp}
                        title="Modules"
                        value={stats.moduleActiveCount}
                        color="text-rose-400"
                    />
                </div>
            </div>
        </div>
    );
};

export default AdminCompanyStatsWidget;