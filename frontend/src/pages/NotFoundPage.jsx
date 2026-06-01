// frontend/src/pages/NotFoundPage.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { Frown } from 'lucide-react'; // Utilisation d'une icône Lucide-React existante

const NotFoundPage = () => {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
            <div className="text-center max-w-lg">
                <Frown size={64} className="text-destructive mx-auto mb-6" />
                <h1 className="text-7xl font-bold mb-4 text-primary">404</h1>
                <h2 className="text-3xl font-semibold mb-4">
                    Oups ! Page introuvable.
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                    Il semble que l'URL que vous avez demandée n'existe pas ou a été déplacée.
                </p>
                <Link
                    to="/dashboard"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                                disabled:pointer-events-none disabled:opacity-50
                                bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                >
                    Retourner au tableau de bord
                </Link>
            </div>
        </div>
    );
};

export default NotFoundPage;