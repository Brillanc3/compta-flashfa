// frontend/src/components/dashboard/settings/ApiKeyManager.jsx

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { regenerateApiKey } from '@/services/companyService.js';
import toast from 'react-hot-toast';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useConfirmation } from '@/contexts/ConfirmationContext';

const ApiKeyManager = ({ settings, onUpdate }) => {
    const [isRegenerating, setIsRegenerating] = useState(false);
    const { confirm } = useConfirmation();

    const handleRegenerate = async () => {
        try {
            await confirm({
                title: "Régénérer la clé API ?",
                message: "Régénérer la clé d'API invalidera immédiatement l’ancienne. Toutes les intégrations utilisant l’ancienne clé cesseront de fonctionner.",
            });

            setIsRegenerating(true);
            const data = await regenerateApiKey(settings.id);
            onUpdate({ apiKey: data.apiKey });
            toast.success("Nouvelle clé API générée !");
        } catch {
            // Annulation utilisateur ou erreur
            toast('Action annulée.');
        } finally {
            setIsRegenerating(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Copié dans le presse-papiers !');
    };

    const appBaseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
    const fullApiKeyLink = `${appBaseUrl}/api/ingest/${settings.id}/${settings.apiKey}`;

    return (
        <div className="bg-slate-800 shadow rounded-lg divide-y divide-slate-700 flex flex-col">
            <div className="px-4 py-5 sm:p-6 flex-grow">
                <h3 className="text-lg leading-6 font-medium text-white">Clé d'API</h3>
                <p className="mt-2 max-w-xl text-sm text-slate-400">
                    Cette clé permet aux services externes d’accéder à l’API de votre entreprise.
                </p>

                <div className="mt-5">
                    <label className="text-sm font-medium text-slate-300">Endpoint de base</label>
                    <div className="flex items-center bg-slate-900 p-3 rounded-md">
                        <pre className="flex-1 text-slate-300 font-mono text-sm overflow-x-auto">
                            <code>{fullApiKeyLink}</code>
                        </pre>
                        <button onClick={() => copyToClipboard(fullApiKeyLink)} title="Copier">
                            <ContentCopyIcon className="h-5 w-5 text-slate-400" />
                        </button>
                    </div>
                </div>

                <div className="mt-4">
                    <label className="text-sm font-medium text-slate-300">Clé API</label>
                    <div className="flex items-center bg-slate-900 p-3 rounded-md">
                        <pre className="flex-1 text-slate-300 font-mono text-sm">
                            <code>{settings.apiKey || 'Aucune clé générée.'}</code>
                        </pre>
                        <button
                            onClick={() => copyToClipboard(settings.apiKey)}
                            title="Copier la clé"
                            disabled={!settings.apiKey}
                        >
                            <ContentCopyIcon className={`h-5 w-5 ${settings.apiKey ? 'text-slate-400' : 'text-slate-600'}`} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-4 py-4 sm:px-6 flex justify-between items-center">
                <div>
                    <h4 className="text-md font-semibold text-white">Régénérer la clé</h4>
                    <p className="text-sm text-slate-400">Ceci invalidera votre clé actuelle.</p>
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

ApiKeyManager.propTypes = {
    settings: PropTypes.shape({
        id: PropTypes.number.isRequired,
        apiKey: PropTypes.string,
    }).isRequired,
    onUpdate: PropTypes.func.isRequired,
};

export default ApiKeyManager;
