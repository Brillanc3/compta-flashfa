// frontend/src/components/accounting/TransactionFilter.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Select from 'react-select';

const selectStyles = {
    control: (styles) => ({
        ...styles,
        backgroundColor: 'var(--cca-base)',
        borderColor: 'var(--cca-border)',
        borderRadius: '12px',
        padding: '2px',
        boxShadow: 'none',
        '&:hover': {
            borderColor: 'var(--brand-primary)',
        }
    }),
    menu: (styles) => ({
        ...styles,
        backgroundColor: 'var(--cca-surface)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--cca-border)',
        borderRadius: '12px',
        overflow: 'hidden',
        zIndex: 20
    }),
    option: (styles, { isFocused, isSelected }) => ({
        ...styles,
        backgroundColor: isSelected
            ? 'var(--brand-primary)'
            : isFocused
                ? 'var(--cca-base)'
                : 'transparent',
        color: isSelected ? 'white' : 'var(--cca-textPrimary)',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: isSelected ? '600' : '500',
    }),
    singleValue: (styles) => ({ ...styles, color: 'var(--cca-textPrimary)', fontSize: '13px' }),
    multiValue: (styles) => ({
        ...styles,
        backgroundColor: 'var(--cca-base)',
        borderRadius: '8px',
        border: '1px solid var(--cca-border)'
    }),
    multiValueLabel: (styles) => ({ ...styles, color: 'var(--cca-textPrimary)', fontSize: '12px' }),
    multiValueRemove: (styles) => ({
        ...styles,
        color: 'var(--cca-textSecondary)',
        '&:hover': {
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
        }
    }),
    placeholder: (styles) => ({ ...styles, color: 'var(--cca-textSecondary)', opacity: 0.5, fontSize: '13px' }),
    input: (styles) => ({ ...styles, color: 'var(--cca-textPrimary)' }),
};

const TransactionFilter = ({ categories, onFilterChange }) => {
    const [filters, setFilters] = useState({
        description: '',
        type: null,
        category: null,
        minAmount: '',
        maxAmount: '',
    });

    const categoryOptions = useMemo(() =>
            categories.map(cat => ({ value: cat.name, label: cat.name })),
        [categories]);

    // On utilise une ref pour éviter le premier appel au montage
    const isInitialMount = useRef(true);

    useEffect(() => {
        // Si c'est le premier rendu, on ne fait rien.
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        // On utilise un "debounce" pour ne pas surcharger l'API pendant la saisie
        const handler = setTimeout(() => {
            const finalFilters = {
                description: filters.description,
                minAmount: filters.minAmount,
                maxAmount: filters.maxAmount,
                type: filters.type?.value,
                category: filters.category?.map(c => c.value),
            };
            onFilterChange(finalFilters);
        }, 500);

        // Nettoyage du timer
        return () => clearTimeout(handler);
    }, [filters, onFilterChange]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, selectedOption) => {
        setFilters(prev => ({ ...prev, [name]: selectedOption }));
    };

    return (
        <div className="
             p-4 md:p-6 bg-cca-surface/30 backdrop-blur-3xl border border-cca-border/30 rounded-[2rem] mb-8 
             shadow-2xl shadow-black/20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 items-end gap-6 
             animate-in fade-in slide-in-from-top-4 duration-700
        ">
            <div className="w-full lg:flex-[2] flex flex-col gap-2">
                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40 ml-2">Audit Descriptif</label>
                <input
                    type="text"
                    name="description"
                    placeholder="Reference, tiers, motif..."
                    value={filters.description}
                    onChange={handleInputChange}
                    className="
                         w-full bg-cca-base/40 border border-cca-border/30 rounded-2xl px-5 py-3 text-xs text-cca-textPrimary 
                         placeholder-cca-textSecondary/20 focus:border-brand-primary focus:bg-cca-base/60 transition-all outline-none
                    "
                />
            </div>
            
            <div className="w-full flex flex-col gap-2">
                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40 ml-2">Nature du Flux</label>
                <Select
                    styles={selectStyles}
                    options={[{value: 'REVENUE', label: 'Revenu'}, {value: 'EXPENSE', label: 'Dépense'}]}
                    isClearable
                    value={filters.type}
                    menuPortalTarget={document.body}
                    placeholder="Flux..."
                    onChange={(opt) => handleSelectChange('type', opt)}
                />
            </div>

            <div className="w-full flex flex-col gap-2">
                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40 ml-2">Catégorisation</label>
                <Select
                    styles={selectStyles}
                    options={categoryOptions}
                    isMulti
                    isClearable
                    value={filters.category}
                    menuPortalTarget={document.body}
                    placeholder="Toutes..."
                    onChange={(opt) => handleSelectChange('category', opt)}
                    className="min-w-0"
                />
            </div>

            <div className="w-full lg:w-64 flex flex-col gap-2">
                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-cca-textSecondary/40 ml-2">Seuils Monétaires ($)</label>
                <div className="flex gap-2 h-[42px]">
                    <input
                        type="number"
                        name="minAmount"
                        placeholder="Min"
                        value={filters.minAmount}
                        onChange={handleInputChange}
                        className="w-1/2 bg-cca-base/40 border border-cca-border rounded-xl px-4 text-xs text-cca-textPrimary placeholder-cca-textSecondary/20 focus:border-brand-primary transition-all outline-none font-mono"
                    />
                    <input
                        type="number"
                        name="maxAmount"
                        placeholder="Max"
                        value={filters.maxAmount}
                        onChange={handleInputChange}
                        className="w-1/2 bg-cca-base/40 border border-cca-border rounded-xl px-4 text-xs text-cca-textPrimary placeholder-cca-textSecondary/20 focus:border-brand-primary transition-all outline-none font-mono"
                    />
                </div>
            </div>
        </div>
    );
};

export default TransactionFilter;