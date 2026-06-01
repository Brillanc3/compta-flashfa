// frontend/src/components/admin/company/CompanyManagers.jsx
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import toast from 'react-hot-toast';
import { addCompanyManager, removeCompanyManager } from '@/services/adminCompanyService';

const selectStyles = {
    control: (styles) => ({ ...styles, backgroundColor: '#1f2937', borderColor: '#4b5563', color: 'white' }),
    menu: (styles) => ({ ...styles, backgroundColor: '#1f2937' }),
    option: (styles, { isFocused, isSelected }) => ({
        ...styles,
        backgroundColor: isSelected ? '#4f46e5' : isFocused ? '#374151' : null,
        color: '#d1d5db',
    }),
    singleValue: (styles) => ({ ...styles, color: '#d1d5db' }),
};

const CompanyManagers = ({ companyId, currentManagers, allUsers, onUpdate }) => {
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const potentialManagers = useMemo(() => {
        const managerIds = new Set(currentManagers.map(m => m.id));
        return allUsers
            .filter(u => !managerIds.has(u.id))
            .map(u => ({ value: u.id, label: `${u.name} (${u.username})` }));
    }, [currentManagers, allUsers]);

    const handleAddManager = async () => {
        if (!selectedUserId) {
            toast.error("Veuillez sélectionner un utilisateur.");
            return;
        }
        setIsSubmitting(true);
        try {
            await addCompanyManager(companyId, selectedUserId);
            toast.success("Gérant ajouté avec succès.");
            onUpdate(); // Rafraîchit les données de la page parente
            setSelectedUserId(null); // Reset select
        } catch (error) {
            toast.error(error.message || "Erreur lors de l'ajout du gérant.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveManager = async (userId) => {
        // Pourrait ajouter une confirmation ici
        try {
            await removeCompanyManager(companyId, userId);
            toast.success("Gérant retiré avec succès.");
            onUpdate();
        } catch (error) {
            toast.error(error.message || "Erreur lors du retrait du gérant.");
        }
    };

    return (
        <div className="bg-slate-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-white mb-4">Gérants Principaux</h2>
            <div className="space-y-4">
                <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-2">Gérants actuels</h3>
                    {currentManagers.length > 0 ? (
                        <ul className="space-y-2">
                            {currentManagers.map(manager => (
                                <li key={manager.id} className="flex justify-between items-center bg-slate-700 p-2 rounded">
                                    <span className="text-white">{manager.name}</span>
                                    <button
                                        onClick={() => handleRemoveManager(manager.id)}
                                        className="text-xs text-red-400 hover:text-red-300"
                                    >
                                        Retirer
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-slate-400">Aucun gérant principal désigné.</p>
                    )}
                </div>

                <div className="border-t border-slate-700 pt-4">
                    <h3 className="text-sm font-medium text-slate-300 mb-2">Ajouter un gérant</h3>
                    <div className="flex items-center space-x-2">
                        <Select
                            className="flex-grow"
                            options={potentialManagers}
                            styles={selectStyles}
                            onChange={(opt) => setSelectedUserId(opt.value)}
                            value={potentialManagers.find(opt => opt.value === selectedUserId) || null}
                            placeholder="Sélectionner un utilisateur..."
                        />
                        <button
                            onClick={handleAddManager}
                            disabled={isSubmitting || !selectedUserId}
                            className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md disabled:opacity-50"
                        >
                            {isSubmitting ? "Ajout..." : "Ajouter"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

CompanyManagers.propTypes = {
    // ... (PropTypes si nécessaire)
};

export default CompanyManagers;