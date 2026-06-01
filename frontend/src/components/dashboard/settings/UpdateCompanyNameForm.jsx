// frontend/src/components/dashboard/settings/UpdateCompanyNameForm.jsx

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { updateCompanyName } from '../../../services/companyService';
import toast from 'react-hot-toast';

const UpdateCompanyNameForm = ({ settings, onUpdate }) => {
    const [name, setName] = useState(settings.name);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (name === settings.name) {
            toast('Aucune modification détectée.');
            return;
        }
        setIsSubmitting(true);
        try {
            const updatedCompany = await updateCompanyName(settings.id, name);
            toast.success('Nom de l\'entreprise mis à jour !');
            onUpdate({ name: updatedCompany.name });
        } catch (error) {
            toast.error(error.message || 'Impossible de mettre à jour le nom.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-slate-800 shadow rounded-lg">
            <form onSubmit={handleSubmit}>
                <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-white">
                        Nom de l'entreprise
                    </h3>
                    <div className="mt-2 max-w-xl text-sm text-slate-400">
                        <p>
                            Le nom public de votre entreprise. C'est ainsi que les utilisateurs la verront.
                        </p>
                    </div>
                    <div className="mt-5">
                        <input
                            type="text"
                            name="company-name"
                            id="company-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full max-w-xs bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>
                <div className="bg-slate-800/50 px-4 py-3 text-right sm:px-6 rounded-b-lg">
                    <button
                        type="submit"
                        disabled={isSubmitting || name === settings.name}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 transition-colors"
                    >
                        {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                </div>
            </form>
        </div>
    );
};

UpdateCompanyNameForm.propTypes = {
    settings: PropTypes.shape({
        id: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
    }).isRequired,
    onUpdate: PropTypes.func.isRequired,
};

export default UpdateCompanyNameForm;