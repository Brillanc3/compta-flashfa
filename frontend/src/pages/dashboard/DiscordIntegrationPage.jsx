// frontend/src/pages/dashboard/DiscordIntegrationPage.jsx
import React from 'react';
import DiscordIntegrationPanel from '@/components/dashboard/settings/DiscordIntegrationPanel';

const DiscordIntegrationPage = () => {
    return (
        <div className="space-y-8">
            <div className="pb-5 border-b border-slate-700">
                <h1 className="text-3xl font-bold text-white">Intégration Discord</h1>
                <p className="mt-2 text-lg text-slate-400">
                    Reliez votre serveur Discord pour synchroniser automatiquement les rôles avec les rangs de l'entreprise.
                </p>
            </div>
            <div className="max-w-3xl">
                <DiscordIntegrationPanel />
            </div>
        </div>
    );
};

export default DiscordIntegrationPage;
