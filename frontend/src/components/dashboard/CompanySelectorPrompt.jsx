// frontend/src/components/dashboard/CompanySelectorPrompt.jsx
import React from 'react';
import { Building, MousePointerClick } from 'lucide-react';

const CompanySelectorPrompt = () => {
    return (
        <div className="flex flex-col items-center justify-center h-96 bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-lg">
            <div className="text-center">
                <div className="flex justify-center items-center mb-4">
                    <Building className="w-12 h-12 text-indigo-400" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                    Bienvenue sur votre espace
                </h2>
                <p className="text-slate-400 max-w-md">
                    Vous êtes membre de plusieurs entreprises. Veuillez en sélectionner une depuis le menu en haut à gauche pour afficher son tableau de bord.
                </p>
                <div className="mt-6 flex justify-center items-center text-sm text-slate-500">
                    <MousePointerClick className="w-4 h-4 mr-2" />
                    <span>Utilisez le sélecteur de société pour commencer.</span>
                </div>
            </div>
        </div>
    );
};

export default CompanySelectorPrompt;