// frontend/src/pages/dashboard/UserProfile.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

// Services
import { getMe } from '@/services/authService.js';
import { getUserRankHistory } from '@/services/userService.js';

// Composants
import ProfileHeader from '../../components/dashboard/profile/ProfileHeader';
import ContactInfoForm from '../../components/dashboard/profile/ContactInfoForm';
import BankingInfoForm from '../../components/dashboard/profile/BankingInfoForm';
import CriticalInfoForm from '@/components/dashboard/profile/CriticalInfoForm.jsx';
import EmploymentHistoryCard from '@/components/dashboard/profile/EmploymentHistoryCard.jsx';
import ChangePasswordForm from '@/components/dashboard/profile/ChangePasswordForm.jsx';
import LinkCodeForm from '@/components/dashboard/profile/LinkCodeForm.jsx';

import Spinner from '../../components/ui/Spinner';

// Icônes
import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

// Configuration des animations
const pageVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            when: 'beforeChildren',
            staggerChildren: 0.1,
        },
    },
};

const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: 'spring', stiffness: 100 },
    },
};

const ToggleSwitch = ({ label, enabled, onChange }) => (
    <label className="flex items-center justify-between cursor-pointer gap-4">
        <span className="text-cca-textSecondary">{label}</span>
        <div className="relative shrink-0">
            <input type="checkbox" className="sr-only" checked={enabled} onChange={onChange} />
            <div className={`block h-8 w-14 rounded-full ${enabled ? 'bg-brand-primary' : 'bg-cca-border'}`}></div>
            <div className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6 transform' : ''}`}></div>
        </div>
    </label>
);

const UserProfile = () => {
    const [user, setUser] = useState(null);
    const [rankHistory, setRankHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);



    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const [userData, historyData] = await Promise.all([
                getMe(),
                getUserRankHistory(),
            ]);

            setUser(userData);
            setRankHistory(Array.isArray(historyData) ? historyData : []);
        } catch (err) {
            const message = err?.message || 'Une erreur est survenue.';
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);



    if (loading) {
        return <div className="flex h-full items-center justify-center"><Spinner /></div>;
    }

    if (error) {
        return <div className="text-center text-red-500">{error}</div>;
    }

    return (
        <motion.div
            className="space-y-8"
            initial="hidden"
            animate="visible"
            variants={pageVariants}
        >
            {user?.status === 'SUSPENDED' && (
                <motion.div
                    className="rounded-r-lg border-l-4 border-yellow-400 bg-yellow-500/20 p-4 text-yellow-300"
                    role="alert"
                    variants={cardVariants}
                >
                    <div className="flex items-center">
                        <AlertCircle className="mr-3 h-6 w-6" />
                        <div>
                            <p className="font-bold">Profil incomplet</p>
                            <p className="text-sm">Votre compte est suspendu. Pour le réactiver, veuillez compléter les informations requises.</p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Section liaison compte — visible si pas d'identité IG */}
            {user && !user.discordId && !user.characterId && (
                <motion.div variants={cardVariants}>
                    <LinkCodeForm onSuccess={fetchAllData} />
                </motion.div>
            )}

            {user && (
                <motion.div variants={cardVariants}>
                    <ProfileHeader user={user} onPictureUpdate={fetchAllData} />
                </motion.div>
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="space-y-8 lg:col-span-2">
                    <motion.div variants={cardVariants}>
                        {user && <CriticalInfoForm user={user} onUpdate={setUser} />}
                    </motion.div>

                    <motion.div variants={cardVariants}>
                        {user && <ContactInfoForm user={user} onUpdate={setUser} />}
                    </motion.div>

                    <motion.div variants={cardVariants}>
                        {user && <BankingInfoForm user={user} onUpdate={setUser} />}
                    </motion.div>


                </div>

                <div className="space-y-8">
                    <motion.div variants={cardVariants}>
                        {user && (
                            <EmploymentHistoryCard
                                employmentData={rankHistory}
                                user={user}
                            />
                        )}
                    </motion.div>

                    <motion.div variants={cardVariants}>
                        <div className="bg-cca-surface/50 backdrop-blur-md rounded-2xl border border-cca-border p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                            <div>
                                <h3 className="text-lg font-bold text-cca-textPrimary tracking-tight">Mes factures</h3>
                                <p className="text-cca-textSecondary text-sm mt-1">Consultez l'historique de vos factures liées à votre identité.</p>
                            </div>
                            <Link
                                to="/dashboard/me/bills"
                                className="px-5 py-2.5 rounded-xl bg-brand-primary/80 hover:bg-brand-dark text-white font-medium text-sm transition-colors text-center"
                            >
                                Voir mes factures
                            </Link>
                        </div>
                    </motion.div>

                    <motion.div variants={cardVariants}>
                        <ChangePasswordForm />
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};

export default UserProfile;
