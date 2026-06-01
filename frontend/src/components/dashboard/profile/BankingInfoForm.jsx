// frontend/src/components/dashboard/profile/BankingInfoForm.jsx

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { updateMe } from '../../../services/userService.js';
import toast from 'react-hot-toast';

/**
 * Formulaire pour éditer l'IBAN de l'utilisateur.
 * @param {{ user: object, onUpdate: function }} props
 */
const BankingInfoForm = ({ user, onUpdate }) => {
    const [iban, setIban] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialise le formulaire avec les données de l'utilisateur
    useEffect(() => {
        if (user) {
            setIban(user.iban || '');
        }
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Vérifie s'il y a eu une modification
        if (iban === (user.iban || '')) {
            toast.success("Aucune modification à enregistrer.");
            return;
        }

        setIsSubmitting(true);
        try {
            const updatedUser = await updateMe({ iban });
            toast.success('IBAN mis à jour avec succès !');
            onUpdate(updatedUser); // Met à jour l'état dans le composant parent
        } catch (error) {
            toast.error(error.message || 'Erreur lors de la mise à jour de l\'IBAN.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-cca-surface border border-cca-border rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-cca-textPrimary mb-6">Informations Bancaires</h2>
            <div>
                <label htmlFor="iban" className="block text-sm font-medium text-cca-textSecondary mb-2">
                    IBAN
                </label>
                <input
                    type="text"
                    id="iban"
                    name="iban"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="ABC1234"
                    className="w-full bg-cca-base border border-cca-border rounded-md shadow-sm py-2 px-3 text-cca-textPrimary placeholder:text-cca-textSecondary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-colors"
                />
            </div>
            <div className="mt-6 text-right">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 transition-colors"
                >
                    {isSubmitting ? 'Enregistrement...' : 'Enregistrer l\'IBAN'}
                </button>
            </div>
        </form>
    );
};

BankingInfoForm.propTypes = {
    user: PropTypes.shape({
        iban: PropTypes.string,
    }).isRequired,
    onUpdate: PropTypes.func.isRequired,
};

export default BankingInfoForm;