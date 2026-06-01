// frontend/src/components/dashboard/profile/ContactInfoForm.jsx

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { updateMe } from '@/services/userService.js';
import toast from 'react-hot-toast';

// Un composant de base pour les champs de formulaire
const InputField = ({ label, id, value, onChange, placeholder }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-cca-textSecondary mb-2">
            {label}
        </label>
        <input
            type="text"
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-cca-base border border-cca-border rounded-md shadow-sm py-2 px-3 text-cca-textPrimary placeholder:text-cca-textSecondary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-colors"
        />
    </div>
);

/**
 * Formulaire pour éditer les informations de contact de l'utilisateur.
 * @param {{ user: object, onUpdate: function }} props
 */
const ContactInfoForm = ({ user, onUpdate }) => {
    const [formData, setFormData] = useState({
        phoneNumber: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialise le formulaire avec les données de l'utilisateur lorsque le composant est monté
    useEffect(() => {
        if (user) {
            setFormData({
                phoneNumber: user.phoneNumber || '',
            });
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Filtre pour n'envoyer que les champs modifiés
        const changedData = Object.keys(formData).reduce((acc, key) => {
            if (formData[key] !== (user[key] || '')) {
                acc[key] = formData[key];
            }
            return acc;
        }, {});

        if (Object.keys(changedData).length === 0) {
            toast.success("Aucune modification à enregistrer.");
            setIsSubmitting(false);
            return;
        }

        try {
            const updatedUser = await updateMe(changedData);
            toast.success('Informations de contact mises à jour !');
            onUpdate(updatedUser); // Met à jour l'état dans le composant parent
        } catch (error) {
            toast.error(error.message || 'Erreur lors de la mise à jour.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-cca-surface border border-cca-border rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-cca-textPrimary mb-6">Informations de Contact</h2>
            <div className="space-y-4">
                <InputField
                    label="Numéro de téléphone"
                    id="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    placeholder="xxx-xxx"
                />
            </div>
            <div className="mt-6 text-right">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 transition-colors"
                >
                    {isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
            </div>
        </form>
    );
};

ContactInfoForm.propTypes = {
    user: PropTypes.shape({
        phoneNumber: PropTypes.string,
    }).isRequired,
    onUpdate: PropTypes.func.isRequired,
};

export default ContactInfoForm;