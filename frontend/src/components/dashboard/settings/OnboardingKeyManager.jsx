// frontend/src/components/dashboard/settings/OnboardingKeyManager.jsx

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { regenerateOnboardingKey } from '@/services/companyService.js';
import toast from 'react-hot-toast';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import { useConfirmation } from '@/contexts/ConfirmationContext';

const OnboardingKeyManager = ({ settings, onUpdate }) => {
    const [isRegenerating, setIsRegenerating] = useState(false);
    const { confirm } = useConfirmation();

    const baseURL = import.meta.env.VITE_APP_BASE_URL || window.location.origin;
    const invitationLink = settings.onboardingKey
        ? `${baseURL}/onboarding?onboardingKey=${settings.onboardingKey}`
        : null;

    const handleRegenerate = async () => {
        try {
            await confirm({
                title: "Régénérer la clé d’onboarding ?",
                message: "Cette action changera le lien d’invitation. Tous les anciens liens deviendront invalides.",
            });

            setIsRegenerating(true);
            const data = await regenerateOnboardingKey(settings.id);
            onUpdate({ onboardingKey: data.onboardingKey });
            toast.success("Nouvelle clé d’onboarding générée !");
        } catch {
            toast('Action annulée.');
        } finally {
            setIsRegenerating(false);
        }
    };

    const copyToClipboard = (text, message) => {
        navigator.clipboard.writeText(text);
        toast.success(message);
    };

    return (
        <div className="bg-slate-800 shadow rounded-lg divide-y divide-slate-700">
            <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-white">Lien d’invitation</h3>
                <p className="mt-2 text-sm text-slate-400">
                    Ce lien permet aux nouveaux employés de rejoindre votre entreprise.
                </p>

                <div className="mt-5">
                    <label className="text-sm font-medium text-slate-300">Lien complet</label>
                    <div className="flex items-center bg-slate-900 p-3 rounded-md">
                        <pre className="flex-1 text-green-400 font-mono text-sm overflow-x-auto">
                            <code>{invitationLink || 'Aucune clé générée.'}</code>
                        </pre>
                        <button
                            onClick={() => copyToClipboard(invitationLink, "Lien copié !")}
                            disabled={!invitationLink}
                        >
                            <LinkIcon className={`h-5 w-5 ${invitationLink ? 'text-slate-400' : 'text-slate-600'}`} />
                        </button>
                    </div>
                </div>

                <div className="mt-4">
                    <label className="text-sm font-medium text-slate-300">Clé seule</label>
                    <div className="flex items-center bg-slate-900 p-3 rounded-md">
                        <pre className="flex-1 text-slate-300 font-mono text-sm">
                            <code>{settings.onboardingKey || 'Aucune clé générée.'}</code>
                        </pre>
                        <button
                            onClick={() => copyToClipboard(settings.onboardingKey, "Clé copiée !")}
                            disabled={!settings.onboardingKey}
                        >
                            <ContentCopyIcon className={`h-5 w-5 ${settings.onboardingKey ? 'text-slate-400' : 'text-slate-600'}`} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-4 py-4 sm:px-6 flex justify-between items-center">
                <div>
                    <h4 className="text-md font-semibold text-white">Régénérer la clé</h4>
                    <p className="text-sm text-slate-400">Ceci rendra les anciens liens obsolètes.</p>
                </div>
                <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-2 px-4 rounded-md"
                >
                    {isRegenerating ? 'Génération...' : 'Régénérer'}
                </button>
            </div>
        </div>
    );
};

OnboardingKeyManager.propTypes = {
    settings: PropTypes.shape({
        id: PropTypes.number.isRequired,
        onboardingKey: PropTypes.string,
    }).isRequired,
    onUpdate: PropTypes.func.isRequired,
};

export default OnboardingKeyManager;
