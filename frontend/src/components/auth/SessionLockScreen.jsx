// frontend/src/components/auth/SessionLockScreen.jsx

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Unlock, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

const SessionLockScreen = () => {
    const { user, unlockSession, logout } = useAuth();
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Utilisez une URL de photo de profil par défaut si user?.imageUrl est vide
    const userImage = user?.imageUrl || null;

    const handleUnlock = async (e) => {
        e.preventDefault();
        if (!password) {
            toast.error('Veuillez entrer votre mot de passe.');
            return;
        }

        setIsLoading(true);
        const success = await unlockSession(password);
        setIsLoading(false);

        if (success) {
            toast.success('Session déverrouillée !');
        }
        // Le toast d'erreur est géré par unlockSession
    };

    return (
        <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center p-4">
            <div className="bg-card p-8 rounded-lg shadow-2xl w-full max-w-sm">

                {/* Photo de profil */}
                <div className="flex justify-center mb-6">
                    <img
                        src={userImage}
                        alt={`${user?.name}`}
                        className="w-24 h-24 rounded-full object-cover border-4 border-primary"
                    />
                </div>

                {/* Nom et Prénom */}
                <h2 className="text-xl font-bold text-center text-foreground mb-1">
                    {user?.name}
                </h2>
                <p className="text-sm text-center text-muted-foreground mb-6">
                    Session verrouillée
                </p>

                <form onSubmit={handleUnlock} className="space-y-4">
                    {/* Champ de mot de passe */}
                    <div>
                        <label htmlFor="password" className="sr-only">Mot de passe</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            placeholder="Mot de passe"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-border bg-background rounded-md text-foreground focus:ring-primary focus:border-primary"
                            disabled={isLoading}
                        />
                    </div>

                    {/* Bouton de déverrouillage */}
                    <button
                        type="submit"
                        className="w-full flex items-center justify-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-md transition-colors"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        ) : (
                            <>
                                <Unlock size={18} className="mr-2" />
                                Déverrouiller la session
                            </>
                        )}
                    </button>
                </form>

                {/* Option de déconnexion totale */}
                <button
                    onClick={() => logout()}
                    className="w-full mt-4 flex items-center justify-center px-4 py-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
                    disabled={isLoading}
                >
                    <LogOut size={16} className="mr-2" />
                    Utiliser un autre compte
                </button>
            </div>
        </div>
    );
};

export default SessionLockScreen;