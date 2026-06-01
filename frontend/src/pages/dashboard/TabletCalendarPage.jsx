import React, { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import CustomLoader from '@/components/ui/CustomLoader.jsx';

const TabletCalendarPage = () => {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);

    const discordId = user?.discordId ?? "";
    const characterId = user?.characterId ?? "";

    const hasRequiredIds = Boolean(discordId && characterId);

    const iframeUrl = useMemo(() => {
        if (!hasRequiredIds) return null;

        const baseUrl = 'https://cca.jipeg-corporation.eu/external/tablette/8/01989446-d29a-7014-b177-c569dcb46d5e/';
        const params = new URLSearchParams({
            ig_discord_id: discordId,
            ig_character_id: String(characterId),
        });

        return `${baseUrl}?${params.toString()}`;
    }, [discordId, characterId, hasRequiredIds]);

    // Si les IDs manquent, on affiche un message clair et on ne charge pas l'iframe.
    if (!hasRequiredIds) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-6 bg-slate-800 rounded-lg shadow-lg border border-slate-700">
                <h1 className="text-xl font-semibold text-white mb-2">
                    Informations manquantes
                </h1>
                <p className="text-sm text-slate-300 mb-4">
                    Impossible d&apos;afficher le calendrier tablette car les informations
                    de votre personnage ne sont pas complètes.
                </p>
                <ul className="text-sm text-slate-400 list-disc list-inside space-y-1 mb-4">
                    <li>Discord ID : {discordId ? <span className="text-emerald-400">OK</span> : <span className="text-red-400">manquant</span>}</li>
                    <li>Character ID : {characterId ? <span className="text-emerald-400">OK</span> : <span className="text-red-400">manquant</span>}</li>
                </ul>
                <p className="text-xs text-slate-500">
                    Merci de contacter un administrateur ou de mettre à jour vos informations
                    pour pouvoir utiliser cette fonctionnalité.
                </p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[calc(100vh-120px)] bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
            {/* Loader en overlay tant que l'iframe n'est pas chargée */}
            {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                    <div className="w-full max-w-md">
                        <CustomLoader text="Chargement du calendrier en jeu..." />
                    </div>
                </div>
            )}

            {iframeUrl && (
                <iframe
                    src={iframeUrl}
                    className="w-full h-full border-0"
                    title="Calendrier Tablette"
                    onLoad={() => setIsLoading(false)}
                />
            )}
        </div>
    );
};

export default TabletCalendarPage;
