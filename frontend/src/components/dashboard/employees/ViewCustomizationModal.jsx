// /frontend/src/components/dashboard/employees/ViewCustomizationModal.jsx

import React, { useState } from 'react';
import Modal from '@/components/Modal';

const ViewCustomizationModal = ({ isOpen, onClose, allColumns, visibleColumns, onSave }) => {
    const [selected, setSelected] = useState(new Set(visibleColumns));

    const handleToggle = (key) => {
        const newSelected = new Set(selected);
        if (newSelected.has(key)) {
            newSelected.delete(key);
        } else {
            newSelected.add(key);
        }
        setSelected(newSelected);
    };

    const handleSave = () => {
        onSave(Array.from(selected));
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Modifier les colonnes de la vue">
            <div className="space-y-4">
                {allColumns.map(col => (
                    <div key={col.key} className="flex items-center">
                        <input
                            id={`col-${col.key}`}
                            type="checkbox"
                            checked={selected.has(col.key)}
                            onChange={() => handleToggle(col.key)}
                            disabled={col.isDefault}
                            className="h-4 w-4 rounded text-indigo-600 bg-slate-700 border-slate-600 focus:ring-indigo-500 disabled:opacity-50"
                        />
                        <label htmlFor={`col-${col.key}`} className={`ml-3 text-sm ${col.isDefault ? 'text-slate-500' : 'text-slate-300'}`}>
                            {col.label} {col.isDefault && '(défaut)'}
                        </label>
                    </div>
                ))}
            </div>
            <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-700">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-md">Annuler</button>
                <button type="button" onClick={handleSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md">Sauvegarder la vue</button>
            </div>
        </Modal>
    );
};

export default ViewCustomizationModal;