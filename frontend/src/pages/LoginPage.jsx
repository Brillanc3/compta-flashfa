// frontend/src/pages/LoginPage.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { encryptData, decryptData } from '../utils/security';

const LoginPage = () => {
    const navigate = useNavigate();
    const { login, isAuthenticated, isLoading } = useAuth();
    const [searchParams] = useSearchParams();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    // --- NOUVEL ÉTAT AJOUTÉ ---
    const [duration] = useState('15m'); // Durée par défaut
    const [rememberMe, setRememberMe] = useState(false);

    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- ÉTATS POUR MOT DE PASSE OUBLIÉ ---
    const [isForgotMode, setIsForgotMode] = useState(false);
    const [forgotUsername, setForgotUsername] = useState('');
    const [forgotMessage, setForgotMessage] = useState(null);

    useEffect(() => {
        const u = searchParams.get('username');
        if (u) {
            // n'écrase pas une valeur déjà saisie / existante
            setUsername((prev) => (prev ? prev : u));
            setForgotUsername((prev) => (prev ? prev : u));
        }
    }, [searchParams]);

    // --- CHARGEMENT DES IDENTIFIANTS MÉMORISÉS ---
    useEffect(() => {
        const loadSavedCredentials = async () => {
            const saved = localStorage.getItem('remembered_creds');
            if (saved) {
                const creds = await decryptData(saved);
                if (creds) {
                    setUsername(creds.username || '');
                    setPassword(creds.password || '');
                    setRememberMe(true);
                }
            }
        };
        loadSavedCredentials();
    }, []);

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
            // --- MODIFIÉ : On passe la durée à la fonction de connexion ---
            await login({ username, password }, duration);

            // --- GESTION DU "SE SOUVENIR DE MOI" ---
            if (rememberMe) {
                const encrypted = await encryptData({ username, password });
                if (encrypted) {
                    localStorage.setItem('remembered_creds', encrypted);
                }
            } else {
                localStorage.removeItem('remembered_creds');
            }

            navigate('/dashboard');
        } catch (err) {
            console.log(err);
            setError(err?.response?.data?.message || err.message || 'Nom d\'utilisateur ou mot de passe incorrect.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setForgotMessage(null);
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: forgotUsername }),
            });
            const data = await response.json();
            if (response.ok) {
                setForgotMessage({ type: 'success', text: data.message });
            } else {
                setForgotMessage({ type: 'error', text: data.message || 'Une erreur est survenue.' });
            }
        } catch {
            setForgotMessage({ type: 'error', text: 'Impossible de contacter le serveur.' });
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
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">
                    {isForgotMode ? 'Réinitialisation' : 'Connexion'}
                </h2>

                {error && !isForgotMode && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                {isForgotMode ? (
                    <form onSubmit={handleForgotPassword}>
                        <div className="mb-4 relative">
                            <label htmlFor="forgotUsername" className="block text-gray-700 text-sm font-bold mb-2 flex items-center">
                                Nom d'utilisateur
                                <div className="ml-2 relative group cursor-help">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                        Vous devez être présent sur le serveur Discord <strong>Caillou's Clarity Accounting</strong> pour recevoir votre code.
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-800"></div>
                                    </div>
                                </div>
                            </label>
                            <input
                                type="text"
                                id="forgotUsername"
                                value={forgotUsername}
                                onChange={(e) => setForgotUsername(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        {forgotMessage && (
                            <div className={`mb-4 p-3 text-sm rounded border ${forgotMessage.type === 'success' ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'}`}>
                                {forgotMessage.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            className={`w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mb-4 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Envoi...' : 'Envoyer le code'}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setIsForgotMode(false);
                                setForgotMessage(null);
                            }}
                            className="w-full text-center text-sm text-gray-500 hover:text-gray-800 font-medium"
                        >
                            Retour à la connexion
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSubmit}>
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
                            <div className="flex justify-between items-center mb-2">
                                <label htmlFor="password" className="block text-gray-700 text-sm font-bold">
                                    Mot de passe
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setIsForgotMode(true)}
                                    className="text-xs text-blue-500 hover:text-blue-800 font-bold"
                                >
                                    Mot de passe oublié ?
                                </button>
                            </div>
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

                        <div className="mb-6 flex items-center">
                            <input
                                type="checkbox"
                                id="rememberMe"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer transition-all"
                                disabled={isSubmitting}
                            />
                            <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700 cursor-pointer select-none font-medium hover:text-gray-900 transition-colors">
                                Se souvenir de moi
                            </label>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                type="submit"
                                className={`w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Connexion...' : 'Se connecter'}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setUsername('demo');
                                    setPassword('demo');
                                    // Utiliser un timeout pour s'assurer que les états sont mis à jour
                                    setTimeout(() => {
                                        document.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                                    }, 100);
                                }}
                                className="w-full bg-transparent border-2 border-blue-500 text-blue-500 hover:bg-blue-50 font-bold py-2 px-4 rounded transition-all flex items-center justify-center gap-2"
                                disabled={isSubmitting}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                                Essayer la démo (demo/demo)
                            </button>
                        </div>
                    </form>
                )}

                <p className="text-center text-gray-500 text-sm mt-6">
                    Vous n'avez pas de compte ?{' '}
                    <Link to="/register" className="font-bold text-blue-500 hover:text-blue-800">
                        S'enregistrer
                    </Link>
                </p>
                <div className="mt-4 border-t border-gray-100 pt-4 text-center">
                    <Link to="/reset-password" title="Si vous avez déjà un code" className="text-xs text-gray-400 hover:text-blue-500 transition-colors">
                        Saisir un code de réinitialisation
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;