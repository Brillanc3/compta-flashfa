// frontend/src/components/auth/SessionWarningModal.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../Modal'; // On réutilise votre composant de modale existant
import { Timer, LogOut, Lock } from 'lucide-react'; // Ajout de Lock

const SessionWarningModal = () => {
    const { isWarningModalOpen, refreshToken, logout, lockSession } = useAuth(); // Ajout de lockSession
    const [countdown, setCountdown] = useState(300); // 5 minutes en secondes

    useEffect(() => {
        let timer;
        if (isWarningModalOpen) {
            setCountdown(300); // Réinitialise le compteur à chaque ouverture
            timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        // Le timer de verrouillage dans AuthContext prendra le relais
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isWarningModalOpen]);

    if (!isWarningModalOpen) {
        return null;
    }

    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;

    // Fonction pour 'Fermer la session' qui est l'équivalent de Verrouiller la session
    const handleCloseSession = () => {
        lockSession();
    };

    // Fonction pour 'Me déconnecter' qui est la déconnexion totale
    const handleLogout = () => {
        logout();
    };


    return (
        <Modal
            isOpen={isWarningModalOpen}
            onClose={handleCloseSession} // Fermer la modale = verrouiller la session
            title="Votre session va bientôt expirer"
        >
            <div className="text-slate-300">
                <p className="text-center mb-4">
                    Pour des raisons de sécurité, vous allez être déconnecté dans :
                </p>
                <div className="text-4xl font-bold text-center text-yellow-400 my-6">
                    {`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`}<span className='text-xl'>min</span>
                </div>
                <p className="text-sm text-slate-400 text-center mb-6">
                    Souhaitez-vous prolonger votre session, la verrouiller ou vous déconnecter complètement ?
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">

                    {/* NOUVEAU: Me déconnecter totalement */}
                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md"
                    >
                        <LogOut size={18} className="mr-2" />
                        Me déconnecter
                    </button>

                    {/* NOUVEAU: Fermer la session (Verrouillage) */}
                    <button
                        onClick={handleCloseSession}
                        className="flex items-center justify-center px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-md"
                    >
                        <Lock size={18} className="mr-2" />
                        Verrouiller la session
                    </button>

                    <button
                        onClick={refreshToken}
                        className="flex items-center justify-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md"
                    >
                        <Timer size={18} className="mr-2" />
                        Prolonger ma session
                    </button>

                </div>
            </div>
        </Modal>
    );
};

export default SessionWarningModal;