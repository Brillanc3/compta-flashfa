// /frontend/src/components/form/DynamicFormField.jsx

import React from 'react';
import MatrixField from './MatrixField';

/**
 * Composant générique pour afficher un champ de formulaire dynamique.
 * Il reçoit sa configuration depuis le schéma de rémunération backend (module.routes.js → payments[]).
 *
 * @param {object} props
 * @param {object} props.field - Configuration du champ (type, label, options, etc.)
 * @param {any} props.value - Valeur actuelle du champ
 * @param {function} props.onChange - Callback appelé lors d'une modification
 * @param {object} [props.context] - Contexte (ex: { companyId })
 */
const DynamicFormField = ({ field, value, onChange, context = {} }) => {
    const handleChange = (e) => {
        const type = field.type;
        let val = e.target.value;

        if (type === 'number' || type === 'currency' || type === 'percent') {
            val = parseFloat(val) || 0;
        } else if (type === 'boolean') {
            val = e.target.checked;
        }

        onChange(val);
    };

    // --- Rendu selon le type ---
    switch (field.type) {
        /** Champs numériques */
        case 'number':
        case 'currency':
        case 'percent':
            return (
                <div className="space-y-1">
                    <label className="block text-sm font-medium text-cca-textSecondary">
                        {field.label}
                    </label>
                    <input
                        type="number"
                        step={field.step || 0.01}
                        min={field.min}
                        max={field.max}
                        value={value ?? field.default ?? ''}
                        onChange={handleChange}
                        className="w-full bg-cca-base border border-cca-border rounded-md p-2 text-cca-textPrimary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
                    />
                </div>
            );

        /** Booléens */
        case 'boolean':
            return (
                <div className="flex items-center gap-2 py-1">
                    <input
                        id={field.key}
                        type="checkbox"
                        checked={!!value}
                        onChange={handleChange}
                        className="h-4 w-4 text-brand-primary bg-cca-base border-cca-border focus:ring-brand-primary rounded transition-all"
                    />
                    <label htmlFor={field.key} className="text-sm text-cca-textSecondary">
                        {field.label}
                    </label>
                </div>
            );

        /** Sélecteurs (dropdowns) */
        case 'select':
            return (
                <div className="space-y-1">
                    <label className="block text-sm font-medium text-cca-textSecondary">
                        {field.label}
                    </label>
                    <select
                        value={value ?? field.default ?? ''}
                        onChange={handleChange}
                        className="w-full bg-cca-base border border-cca-border rounded-md p-2 text-cca-textPrimary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
                    >
                        {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-cca-surface text-cca-textPrimary">
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            );

        /** Matrices (table dynamique multi-colonnes, ex: produits, services, etc.) */
        case 'matrix':
            return (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-cca-textSecondary">
                        {field.label}
                    </label>
                    {field.description && (
                        <p className="text-xs text-cca-textSecondary mb-1">{field.description}</p>
                    )}
                    <MatrixField
                        field={field}
                        value={value}
                        onChange={onChange}
                        context={context}
                    />
                </div>
            );

        /** Type inconnu */
        default:
            return (
                <div className="p-2 bg-cca-surface text-cca-textSecondary rounded-md text-sm italic border border-cca-border/50">
                    Champ non supporté : <span className="font-semibold">{field.type}</span>
                </div>
            );
    }
};

export default DynamicFormField;
