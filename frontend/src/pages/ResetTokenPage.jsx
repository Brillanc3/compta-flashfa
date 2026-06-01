// /frontend/src/pages/ResetTokenPage.jsx

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { verifyResetToken, confirmResetPassword } from '@/services/authService';
import toast from 'react-hot-toast';

const ResetTokenPage = () => {
    const navigate = useNavigate();

    // Phase 1 : Vérification
    const [username, setUsername] = useState('');
    const [token, setToken] = useState('');

    // Phase 2 : Nouveau mot de passe
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [step, setStep] = useState(1); // 1 = token, 2 = password
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // ---------------------------
    //   HANDLE VERIFY TOKEN
    // ---------------------------
    const handleVerify = async (e) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            await verifyResetToken({
                username,
                token,
            });
            toast.success("Token validé !");
            setStep(2);
        } catch (err) {
            setError(err?.response?.data?.message || "Token invalide ou expiré.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ---------------------------
    //  HANDLE CONFIRM PASSWORD
    // ---------------------------
    const handleConfirm = async (e) => {
        e.preventDefault();
        setError(null);

        if (newPassword !== confirmPassword) {
            setError("Les mots de passe ne correspondent pas.");
            return;
        }

        setIsSubmitting(true);

        try {
            await confirmResetPassword({
                username,
                token,
                newPassword,
            });

            toast.success("Mot de passe réinitialisé !");
            navigate("/login", { replace: true });
        } catch (err) {
            setError(err?.response?.data?.message || "Erreur lors de la réinitialisation.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ---------------------------
    //      RENDER UI
    // ---------------------------
    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 relative">

                <Link to="/login" className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 transition">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </Link>

                <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">
                    Réinitialisation du mot de passe
                </h2>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                        <span>{error}</span>
                    </div>
                )}

                {step === 1 && (
                    <form onSubmit={handleVerify}>
                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2">
                                Nom d'utilisateur
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2">
                                Token (6 chiffres)
                            </label>
                            <input
                                type="text"
                                maxLength={6}
                                pattern="\d{6}"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded 
                                ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            Vérifier le token
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleConfirm}>
                        <div className="mb-4 mt-2">
                            <label className="block text-gray-700 text-sm font-bold mb-2">
                                Nouveau mot de passe
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2">
                                Confirmer le mot de passe
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded 
                                ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            Réinitialiser le mot de passe
                        </button>
                    </form>
                )}

            </div>
        </div>
    );
};

export default ResetTokenPage;
