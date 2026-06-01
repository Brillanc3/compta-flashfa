// /frontend/src/pages/OnboardingPage.jsx

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    startOnboarding,
    linkAccount,
    createAndLinkAccount
} from '../services/onboardingService';
import { useAuth } from '../contexts/AuthContext';
import CustomLoader from '../components/ui/CustomLoader';
import ReplayIcon from '@mui/icons-material/Replay';
import { LogIn } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Fake Navbar                                                                 */
/* -------------------------------------------------------------------------- */

const FakeNavbar = () => {
    const navigate = useNavigate();

    return (
        <div className="w-full max-w-xl bg-slate-900/60 backdrop-blur-xl p-2 rounded-t-xl flex items-center gap-2 border border-white/10 shadow-lg">
            <button
                onClick={() => window.location.reload()}
                className="p-1 text-slate-300 hover:bg-white/10 rounded-full transition"
                title="Recharger la page"
                type="button"
            >
                <ReplayIcon style={{ fontSize: 20 }} />
            </button>

            <button
                onClick={() => navigate("/login")}
                className="p-1 text-slate-300 hover:bg-white/10 rounded-full transition"
                title="Aller à la page de connexion"
                type="button"
            >
                <LogIn size={20} />
            </button>

            <div className="flex-1 bg-slate-800/40 backdrop-blur-md text-slate-300 text-sm rounded-md px-3 py-1 font-mono border border-white/10">
                https://cca.tablette/onboarding/
            </div>
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/* Glass Card                                                                  */
/* -------------------------------------------------------------------------- */

const GlassCard = ({ children }) => (
    <div className="w-full max-w-xl bg-slate-900/60 backdrop-blur-2xl rounded-b-xl p-8 border border-white/10 shadow-xl">
        {children}
    </div>
);

/* -------------------------------------------------------------------------- */
/* Onboarding Page                                                             */
/* -------------------------------------------------------------------------- */

const OnboardingPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isAuthenticated, isLoading: authLoading, logout, user } = useAuth();

    const [view, setView] = useState('loading');
    const [error, setError] = useState('');
    const [onboardingData, setOnboardingData] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    /* ---------------------------------------------------------------------- */
    /* Redirect if already authenticated                                       */
    /* ---------------------------------------------------------------------- */


    /* ---------------------------------------------------------------------- */
    /* INIT ONBOARDING                                                         */
    /* ---------------------------------------------------------------------- */

    useEffect(() => {
        if (authLoading) return;
        const initiateOnboarding = async () => {
            const params = {
                onboardingKey: searchParams.get('onboardingKey'),
                ig_character_id: searchParams.get('ig_character_id'),
                ig_discord_id: searchParams.get('ig_discord_id'),
            };

            if (!params.onboardingKey || !params.ig_character_id || !params.ig_discord_id) {
                setView('error');
                setError("Clé d'onboarding invalide.");
                if (isAuthenticated) {
                    await logout();
                }
                return;
            }

            try {
                const data = await startOnboarding(params);

                if (data.success === false) {
                    setView('error');
                    setError(data.message || "Erreur inconnue lors de la validation.");
                    if (isAuthenticated) {
                        await logout();
                    }
                    return;
                }

                setOnboardingData(data);
                setFormData(prev => ({
                    ...prev,
                    username: data.username || data.suggestedUsername || '',
                }));

                if (
                    ['NO_INVITATION', 'INVALID_INVITATION', 'IDENTITY_MISMATCH', 'ERROR']
                        .includes(data.scenario)
                ) {
                    setView('error');
                    setError(data.message || "Invitation invalide. Contactez un manager.");
                    return;
                }

                if (
                    (data.scenario === 'ACCOUNT_EXISTS_NEEDS_LINK' ||
                        data.scenario === 'NEEDS_ACCOUNT_CREATION') &&
                    !data.properName
                ) {
                    setView('error');
                    setError("Le profil d'invitation est incomplet.");
                    return;
                }

                /* 🔁 SEULE RÈGLE SPÉCIALE */
                if (data.scenario === 'ALREADY_LINKED') {
                    if(isAuthenticated && user.username !== data.username){
                        await logout();
                    }
                    navigate(
                        `/login?username=${encodeURIComponent(data.username || '')}`,
                        { replace: true }
                    );
                    return;
                }

                /* Tous les autres scénarios restent sur l’onboarding */
                setView('choice');

            } catch (err) {
                console.error("Erreur onboarding:", err);
                setView('error');
                setError(err?.message || "Impossible de valider l'invitation.");
            }
        };

        initiateOnboarding();
    }, [searchParams, navigate, authLoading, isAuthenticated, logout, user]);

    /* ---------------------------------------------------------------------- */
    /* Handlers                                                                */
    /* ---------------------------------------------------------------------- */

    const handleChange = e =>
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async e => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const payload = {
                onboardingKey: searchParams.get('onboardingKey'),
                ig_character_id: searchParams.get('ig_character_id'),
                ig_discord_id: searchParams.get('ig_discord_id'),
                username: formData.username,
                password: formData.password,
            };

            if (view === 'login') {
                const result = await linkAccount(payload);
                if (!result.success) throw new Error(result.message);
                // reste sur onboarding → succès implicite
                navigate(`/login?username=${encodeURIComponent(formData.username)}`, {
                    replace: true,
                });
                return;
            }

            if (view === 'register') {
                const result = await createAndLinkAccount(payload);
                if (!result.success) throw new Error(result.message);
                navigate(`/login?username=${encodeURIComponent(formData.username)}`, {
                    replace: true,
                });
                return;
            }

        } catch (err) {
            setError(err.message || 'Une erreur est survenue.');
            setIsSubmitting(false);
        }
    };

    /* ---------------------------------------------------------------------- */
    /* Render                                                                  */
    /* ---------------------------------------------------------------------- */

    const renderContent = () => {
        switch (view) {
            case 'loading':
                return <CustomLoader text="Vérification de l'invitation..." />;

            case 'error':
                return (
                    <div className="w-full max-w-xl bg-red-900/40 backdrop-blur-xl text-red-300 p-8 rounded-b-xl border border-red-500/20 shadow-xl text-center">
                        <h2 className="text-2xl font-bold mb-3">Onboarding impossible</h2>
                        <p className="mb-6">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-2 px-6 py-3 bg-red-600/80 hover:bg-red-500 text-white font-semibold rounded-lg transition"
                        >
                            Réessayer
                        </button>
                    </div>
                );

            case 'choice':
                return (
                    <GlassCard>
                        <h1 className="text-2xl font-bold text-white text-center">
                            Bienvenue chez {onboardingData?.companyName}
                        </h1>

                        <p className="text-slate-300 text-center mt-2 mb-6">
                            Un profil pour{" "}
                            <span className="font-semibold text-white">
                                {onboardingData?.properName}
                            </span>{" "}
                            est prêt.
                        </p>

                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => setView('register')}
                                className="w-full bg-indigo-600/80 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg border border-white/10"
                            >
                                Créer un nouveau compte
                            </button>

                            <button
                                onClick={() => setView('login')}
                                className="w-full bg-slate-700/60 hover:bg-slate-600 text-white font-bold py-3 rounded-lg border border-white/10"
                            >
                                J'ai déjà un compte (Lier)
                            </button>
                        </div>
                    </GlassCard>
                );

            case 'login':
            case 'register':
                return (
                    <GlassCard>
                        <h1 className="text-2xl font-bold text-white text-center">
                            {view === 'login'
                                ? 'Lier votre compte'
                                : 'Créer votre compte'}
                        </h1>

                        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                required
                                className="w-full bg-slate-800/40 border border-white/10 rounded-md p-2 text-white"
                                placeholder="Nom d'utilisateur"
                            />

                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className="w-full bg-slate-800/40 border border-white/10 rounded-md p-2 text-white"
                                placeholder="Mot de passe"
                            />

                            {error && (
                                <p className="text-red-400 text-sm text-center">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-indigo-600/80 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg border border-white/10"
                            >
                                {view === 'login'
                                    ? 'Se connecter et lier'
                                    : 'Créer le compte'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setView('choice')}
                                className="w-full text-center text-slate-400 hover:text-white text-sm py-2"
                            >
                                Retour au choix
                            </button>
                        </form>
                    </GlassCard>
                );

            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col items-center p-4">
            <FakeNavbar />
            <div className="mt-2">{renderContent()}</div>
        </div>
    );
};

export default OnboardingPage;
