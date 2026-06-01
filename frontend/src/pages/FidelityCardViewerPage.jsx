// frontend/src/pages/FidelityCardViewerPage.jsx

import React from 'react';
import { useParams } from 'react-router-dom';

const FidelityCardViewerPage = () => {
    const { publicLink } = useParams();

    // On construit l'URL de l'API qui va générer et renvoyer l'image
    const imageUrl = `/api/fidelity/view/${publicLink}`;

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
            <div className="bg-slate-800 p-4 sm:p-6 rounded-lg shadow-2xl">
                <h1 className="text-xl sm:text-2xl font-bold text-white text-center mb-4">
                    Votre Carte de Fidélité
                </h1>
                {/* La balise img appelle directement notre API backend pour afficher l'image */}
                <img
                    src={imageUrl}
                    alt="Carte de fidélité"
                    className="max-w-full h-auto rounded-md"
                />
            </div>
            <p className="text-sm text-slate-500 mt-6">
                Propulsé par Clarity Accounting
            </p>
        </div>
    );
};

export default FidelityCardViewerPage;