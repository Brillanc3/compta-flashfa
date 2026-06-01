// frontend/src/pages/RegisterPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// MODIFIÉ : On importe la fonction 'register' directement depuis le service
import { register as registerUser } from '../services/authService';
import toast from 'react-hot-toast'; // Ajout de toast pour le feedback utilisateur

const RegisterPage = () => {
    const navigate = useNavigate();
    // On ne récupère plus 'register' d'ici, seulement l'état d'authentification
    const { isAuthenticated, isLoading } = useAuth();

    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [characterId, setCharacterId] = useState('');
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, isLoading, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            // MODIFIÉ : On utilise la fonction 'registerUser' importée du service
            await registerUser({ name, username, password, characterId: characterId ? parseInt(characterId, 10) : undefined });
            toast.success("Compte créé avec succès ! Vous pouvez maintenant vous connecter.");
            navigate('/login');
        } catch (err) {
            setError(err.message || "Une erreur s'est produite lors de l'enregistrement.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading || isAuthenticated) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Chargement...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 relative">
                <Link to="/" className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </Link>
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">Créer un compte</h2>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">
                            Nom complet
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-2">
                            Nom d'utilisateur
                        </label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
                            Mot de passe
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="characterId" className="block text-gray-700 text-sm font-bold mb-2">
                            N° de personnage <span className="text-gray-400 font-normal">(optionnel)</span>
                        </label>
                        <input
                            type="number"
                            id="characterId"
                            value={characterId}
                            onChange={(e) => setCharacterId(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: 12345"
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <button
                            type="submit"
                            className={`w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Enregistrement..." : "S'enregistrer"}
                        </button>
                    </div>
                </form>
                <p className="text-center text-gray-500 text-sm mt-6">
                    Vous avez déjà un compte ?{' '}
                    <Link to="/login" className="font-bold text-blue-500 hover:text-blue-800">
                        Se connecter
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default RegisterPage;