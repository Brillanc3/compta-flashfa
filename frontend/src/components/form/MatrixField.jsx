// /frontend/src/components/form/MatrixField.jsx

import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '@/services/api';
import DynamicFormField from './DynamicFormField';

const MatrixField = ({ field, value = {}, onChange, context = {} }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const companyId = context.companyId;

    const source = field?.source || {};
    const sourceType = (source.type || 'api').toLowerCase();

    // columns peut être un tableau OU une string JSON
    const columns = useMemo(() => {
        if (Array.isArray(field.columns)) return field.columns;
        try {
            return JSON.parse(field.columns || '[]');
        } catch (_error) {
            console.error('[MatrixField] Invalid columns JSON:', field.columns);
            return [];
        }
    }, [field.columns]);

    // Pour éviter un useEffect dépendant d’un objet (source.data), on le "stabilise"
    const sourceDataKey = useMemo(() => {
        if (sourceType !== 'data') return '';
        try {
            return JSON.stringify(source.data || []);
        } catch {
            return '';
        }
    }, [sourceType, source.data]);

    useEffect(() => {
        const loadRows = async () => {
            try {
                setLoading(true);

                // ---- MODE DATA: pas d'API, rows = source.data
                if (sourceType === 'data') {
                    const items = Array.isArray(source.data) ? source.data : [];
                    setRows(items);
                    return;
                }

                // ---- MODE API (défaut): comportement actuel
                let url = source.url || '';
                if (!url) {
                    setRows([]);
                    return;
                }

                if (companyId) url = url.replace(':companyId', companyId);

                const { data } = await apiClient.get(url);
                const items = data?.products || data?.items || data || [];
                setRows(Array.isArray(items) ? items : []);
            } catch (error) {
                console.error('Erreur MatrixField fetch:', error);
                setRows([]);
            } finally {
                setLoading(false);
            }
        };

        loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceType, source.url, companyId, sourceDataKey]);

    const handleCellChange = (rowId, key, val) => {
        const nextValue = {
            ...value,
            [rowId]: { ...(value[rowId] || {}), [key]: val },
        };
        onChange(nextValue);
    };

    if (loading) {
        return (
            <div className="p-4 text-sm text-cca-textSecondary bg-cca-surface rounded-md border border-cca-border animate-pulse">
                Chargement des données...
            </div>
        );
    }

    if (!rows.length) {
        return (
            <div className="p-4 text-sm text-cca-textSecondary bg-cca-surface rounded-md border border-cca-border italic">
                Aucun élément à afficher.
            </div>
        );
    }

    const labelField = source.labelField || 'name';
    const valueField = source.valueField || 'id';

    return (
        <div className="overflow-x-auto border border-cca-border rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
            <table className="w-full text-sm text-cca-textPrimary">
                <thead className="bg-cca-base text-cca-textSecondary font-heading border-b border-cca-border">
                <tr>
                    <th className="p-3 text-left font-semibold uppercase tracking-wider text-xs">
                        {source.labelField || 'Nom'}
                    </th>
                    {columns.map((col) => (
                        <th key={col.key} className="p-3 text-center font-semibold uppercase tracking-wider text-xs">
                            {col.label}
                        </th>
                    ))}
                </tr>
                </thead>

                <tbody className="divide-y divide-cca-border">
                {rows.map((row) => {
                    const rowId = row?.[valueField];
                    return (
                        <tr key={rowId} className="hover:bg-cca-surface transition-colors duration-200">
                            <td className="p-3 font-medium">{row?.[labelField]}</td>

                            {columns.map((col) => (
                                <td key={col.key} className="p-2 text-center">
                                    <DynamicFormField
                                        field={col}
                                        value={value?.[rowId]?.[col.key]}
                                        onChange={(val) => handleCellChange(rowId, col.key, val)}
                                        context={context}
                                    />
                                </td>
                            ))}
                        </tr>
                    );
                })}
                </tbody>
            </table>
        </div>
    );
};

export default MatrixField;
