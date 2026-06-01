// frontend/src/components/admin/TemplateFieldManager.jsx
// Je préfère que la première ligne d'un fichier soit la route du fichier.

import React, { useState } from 'react';
import { Plus, X, Type, DollarSign, Calendar, List, CheckSquare } from 'lucide-react';

const fieldTypeOptions = [
    { value: 'TEXT', label: 'Texte Simple', icon: Type },
    { value: 'NUMBER', label: 'Nombre/Taux', icon: DollarSign },
    { value: 'DATE', label: 'Date', icon: Calendar },
    { value: 'PRICE', label: 'Prix Monétaire', icon: DollarSign },
    { value: 'MODULE_SELECTION', label: 'Sélection de Modules', icon: CheckSquare },
];

const TemplateFieldManager = ({ fields, setFields, onInsertTag }) => {
    const [newLabel, setNewLabel] = useState('');
    const [newType, setNewType] = useState('TEXT');
    const [newKey, setNewKey] = useState('');

    const handleAddField = () => {
        if (!newLabel || !newKey) {
            alert('Le libellé et la clé sont requis.');
            return;
        }

        const newField = {
            key: newKey.toUpperCase().replace(/[^A-Z0-9_]/g, '_'), // Normalisation de la clé
            label: newLabel,
            fieldType: newType,
            order: fields.length,
            options: null, // Logique d'options à ajouter si besoin de MODULE_SELECTION
        };

        setFields(prev => [...prev, newField]);
        setNewLabel('');
        setNewKey('');
        setNewType('TEXT');
    };

    const handleRemoveField = (keyToRemove) => {
        setFields(prev => prev.filter(field => field.key !== keyToRemove));
    };

    // Fonction utilitaire pour trouver l'icône
    const getFieldIcon = (type) => {
        const option = fieldTypeOptions.find(opt => opt.value === type);
        return option ? option.icon : Type;
    };

    return (
        <div className="border border-slate-700 rounded-lg p-4 bg-slate-800">
            <h4 className="text-lg font-semibold text-white mb-3">Champs Variables du Contrat</h4>

            {/* Liste des champs existants */}
            <ul className="space-y-2 mb-4">
                {fields.map(field => {
                    const Icon = getFieldIcon(field.fieldType);
                    return (
                        <li key={field.key} className="flex justify-between items-center bg-slate-700/50 p-2 rounded-md">
                            <div className="flex items-center space-x-3">
                                <Icon size={16} className="text-indigo-400"/>
                                <div>
                                    <span className="font-medium text-slate-200">{field.label}</span>
                                    <code className="ml-2 text-xs bg-slate-800 p-1 rounded text-orange-300">{'{{' + field.key + '}}'}</code>
                                </div>
                            </div>
                            <div className="flex space-x-2">
                                {/* Bouton d'insertion (UX Simplifiée) */}
                                <button
                                    type="button"
                                    onClick={() => onInsertTag('{{' + field.key + '}}')}
                                    className="text-sm px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
                                >
                                    Insérer
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveField(field.key)}
                                    className="p-1 text-red-400 hover:bg-slate-600 rounded-full"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {/* Formulaire d'ajout d'un nouveau champ */}
            <div className="mt-4 pt-3 border-t border-slate-700 space-y-3">
                <h5 className="text-md font-medium text-slate-300">Ajouter un nouveau champ</h5>

                <div className="flex space-x-3">
                    <input
                        type="text"
                        placeholder="Libellé du champ (ex: Prix Abonnement)"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        className="flex-1 p-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                    />
                    <input
                        type="text"
                        placeholder="Clé UNIQUE (ex: PRIX_ABO)"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        className="w-40 p-2 bg-slate-700 border border-slate-600 rounded-md text-white uppercase"
                    />
                </div>

                <div className="flex space-x-3 items-center">
                    <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        className="p-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                    >
                        {fieldTypeOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>

                    <button
                        onClick={handleAddField}
                        type="button"
                        className="flex items-center py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md"
                    >
                        <Plus size={18} className="mr-2"/> Ajouter
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TemplateFieldManager;