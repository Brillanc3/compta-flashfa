// /frontend/src/pages/ForbiddenPage.jsx

import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import BlockIcon from '@mui/icons-material/Block';

const ForbiddenPage = () => {
    const location = useLocation();
    const message = location.state?.message || "Vous n'avez pas les autorisations nécessaires pour accéder à cette ressource.";

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
            <BlockIcon style={{ fontSize: 80 }} className="text-red-500 mb-4" />
            <h1 className="text-4xl font-bold mb-2">Accès Refusé</h1>
            <p className="text-lg text-slate-400 mb-6 text-center max-w-md">
                {message}
            </p>
            <Link
                to="/dashboard"
                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
            >
                Retourner à l'accueil
            </Link>
        </div>
    );
};

export default ForbiddenPage;