// frontend/src/components/dashboard/profile/CriticalInfoForm.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { updateMe } from '@/services/userService';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';

const InfoDisplay = ({ label, value }) => (
    <div>
        <label className="block text-sm font-medium text-cca-textSecondary">{label}</label>
        <p className="mt-1 text-md text-cca-textPrimary font-semibold flex items-center">
            <Lock size={14} className="mr-2 text-cca-textSecondary/70" />
            {value}
        </p>
    </div>
);

const CriticalInfoForm = ({ user, onUpdate }) => {
    const [formData, setFormData] = useState({
        discordId: user.discordId || '',
        characterId: user.characterId || '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const hasDiscordId = !!user.discordId;
    const hasCharacterId = !!user.characterId;

    // Si tout est déjà rempli, on n'affiche rien du tout.
    if (hasDiscordId && hasCharacterId) {
        return null;
    }

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const updatedUser = await updateMe({
                discordId: formData.discordId,
                characterId: formData.characterId,
            });
            toast.success('Informations critiques enregistrées !');
            onUpdate(updatedUser); // Met à jour l'état parent pour faire disparaître le formulaire
        } catch (error) {
            toast.error(error.message || 'Erreur lors de la mise à jour.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-cca-surface border border-cca-border rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-cca-textPrimary mb-6">Informations Critiques</h2>
            <p className="text-sm text-cca-textSecondary mb-4">
                Ces informations sont requises pour certaines fonctionnalités. Une fois enregistrées, elles ne pourront plus être modifiées.
            </p>
            <div className="space-y-4">
                {hasDiscordId ? (
                    <InfoDisplay label="ID Discord" value={user.discordId} />
                ) : (
                    <div>
                        <label htmlFor="discordId" className="block text-sm font-medium text-cca-textSecondary mb-2">ID Discord</label>
                        <input
                            type="text"
                            id="discordId"
                            name="discordId"
                            value={formData.discordId}
                            onChange={handleChange}
                            placeholder="VotreNom#1234"
                            className="w-full bg-cca-base border border-cca-border rounded-md py-2 px-3 text-cca-textPrimary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                            required
                        />
                    </div>
                )}
                {hasCharacterId ? (
                    <InfoDisplay label="N° de Personnage" value={user.characterId} />
                ) : (
                    <div>
                        <label htmlFor="characterId" className="block text-sm font-medium text-cca-textSecondary mb-2">N° de Personnage</label>
                        <input
                            type="number"
                            id="characterId"
                            name="characterId"
                            value={formData.characterId}
                            onChange={handleChange}
                            placeholder="Ex: 12345"
                            className="w-full bg-cca-base border border-cca-border rounded-md py-2 px-3 text-cca-textPrimary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                            required
                        />
                    </div>
                )}
            </div>
            <div className="mt-6 text-right">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-2 px-4 rounded-md transition-colors"
                >
                    {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
            </div>
        </form>
    );
};

CriticalInfoForm.propTypes = {
    user: PropTypes.object.isRequired,
    onUpdate: PropTypes.func.isRequired,
};

export default CriticalInfoForm;