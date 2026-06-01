// frontend/src/components/admin/company/CompanyManagementPanel.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import { Key, Clipboard, RefreshCw } from 'lucide-react';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
// Note: la fonction de regénération de clé doit être ajoutée au service
// import { regenerateAdminCompanyKey } from '@/services/adminCompanyService';

const ApiKeyDisplay = ({ label, value, onRegenerate }) => {
    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        toast.success(`${label} copiée !`);
    };

    return (
        <div>
            <label className="block text-sm font-medium text-slate-400">{label}</label>
            <div className="mt-1 flex rounded-md shadow-sm">
                <input
                    type="text"
                    readOnly
                    value={value || 'N/A'}
                    className="flex-1 block w-full rounded-none rounded-l-md bg-slate-700 border-slate-600 px-3 py-2 text-slate-300 sm:text-sm"
                />
                <button type="button" onClick={handleCopy} className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-600 bg-slate-600 text-slate-300 hover:bg-slate-500">
                    <Clipboard size={16} />
                </button>
                <button type="button" onClick={onRegenerate} className="ml-2 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700">
                    <RefreshCw size={16} />
                </button>
            </div>
        </div>
    );
};

const CompanyManagementPanel = ({ company, _onUpdate }) => {
    const [_isSubmitting, setIsSubmitting] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    const handleRegenerate = (keyType) => {
        setConfirmModal({
            isOpen: true,
            message: `Êtes-vous sûr de vouloir regénérer la ${keyType} ? L'ancienne clé sera immédiatement invalidée.`,
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                setIsSubmitting(true);
                try {
                    // const updatedCompany = await regenerateAdminCompanyKey(company.id, keyType);
                    // onUpdate(updatedCompany); // Met à jour l'état dans la page parente
                    toast.success(`${keyType} regénérée avec succès !`);
                } catch {
                    toast.error(`Erreur lors de la regénération de la clé.`);
                } finally {
                    setIsSubmitting(false);
                }
            },
        });
    };

    return (
        <div className="bg-slate-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center"><Key size={20} className="mr-3 text-indigo-400"/> Gestion des Clés</h2>
            <div className="space-y-4">
                <ApiKeyDisplay label="Clé d'API (Ingest)" value={company.apiKey} onRegenerate={() => handleRegenerate('apiKey')} />
                <ApiKeyDisplay label="Clé d'Onboarding" value={company.onboardingKey} onRegenerate={() => handleRegenerate('onboardingKey')} />
            </div>
            {/* Des boutons pour Activer/Désactiver l'entreprise pourront être ajoutés ici */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                message={confirmModal.message}
            />
        </div>
    );
};

CompanyManagementPanel.propTypes = {
    company: PropTypes.object.isRequired,
    onUpdate: PropTypes.func.isRequired,
};

export default CompanyManagementPanel;