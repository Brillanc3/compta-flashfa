// /frontend/src/components/layout/ProfileBottomSheet.jsx
import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { User, Lock, LogOut, X, Sun, Moon, Layout } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { useCompany } from '@/contexts/CompanyContext';
import { usePermissions } from '@/contexts/PermissionsContext';

/**
 * Bottom Sheet du profil utilisateur (mobile)
 * @param {Object} props
 * @param {boolean} props.isOpen - état d'ouverture
 * @param {() => void} props.onClose - fonction de fermeture
 */
const ProfileBottomSheet = ({ isOpen, onClose }) => {
    const { user, logout } = useAuth();
    const { activeCompanyId, useCompanyTheme, toggleCompanyTheme } = useCompany();
    const { theme, toggleTheme } = useTheme();
    const permissions = usePermissions();
    const navigate = useNavigate();

    const hasCompanyThemeEngine = !!activeCompanyId && permissions.companyModules?.includes("customization");

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay */}
                    <motion.div
                        key="overlay"
                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[80]"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    />

                    {/* Bottom sheet */}
                    <motion.div
                        key="sheet"
                        className="fixed bottom-0 left-0 right-0 z-[90] bg-cca-base/95 backdrop-blur-xl text-cca-textPrimary rounded-t-2xl border-t border-cca-border shadow-2xl"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-cca-border">
                            <div className="flex items-center gap-2">
                                <User className="text-brand-primary" size={20} />
                                <h2 className="text-lg font-semibold">Profil</h2>
                            </div>
                            <button
                                onClick={onClose}
                                aria-label="Fermer"
                                className="p-1.5 rounded-md hover:bg-cca-surface/50 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Infos utilisateur */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-cca-border">
                            <div className="h-12 w-12 rounded-full bg-cca-surface/30 overflow-hidden flex items-center justify-center">
                                {user?.imageUrl ? (
                                    <img src={user.imageUrl} alt="Avatar" className="h-full w-full object-cover" />
                                ) : (
                                    <span className="text-white font-bold">
                                        {user?.name?.[0] || '?'}
                                    </span>
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-cca-textPrimary">{user?.name}</p>
                                <p className="text-xs text-cca-textSecondary">Compte utilisateur</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-4 space-y-4">
                            {/* Theme Selection */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cca-textSecondary mb-1">
                                    Design System
                                </p>
                                <div className="flex p-1.5 bg-cca-base/40 border border-cca-border/50 rounded-2xl backdrop-blur-md">
                                    <button
                                        onClick={() => theme !== 'light' && toggleTheme()}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${theme === 'light'
                                            ? 'bg-white text-indigo-600 shadow-[0_0_20px_rgba(99,102,241,0.3)] scale-[1.02]'
                                            : 'text-cca-textSecondary hover:text-cca-textPrimary hover:bg-white/5'
                                            }`}
                                    >
                                        <Sun size={14} className={theme === 'light' ? 'animate-pulse' : ''} />
                                        Clair
                                    </button>
                                    <button
                                        onClick={() => theme !== 'dark' && toggleTheme()}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${theme === 'dark'
                                            ? 'bg-brand-primary text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] scale-[1.02]'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <Moon size={14} className={theme === 'dark' ? 'animate-pulse' : ''} />
                                        Sombre
                                    </button>
                                </div>

                                {hasCompanyThemeEngine && (
                                    <button
                                        onClick={toggleCompanyTheme}
                                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${useCompanyTheme
                                            ? 'bg-brand-primary/20 border-brand-primary/50 text-brand-primary shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                            : 'bg-cca-base/40 border-cca-border/50 text-cca-textSecondary hover:text-cca-textPrimary hover:bg-white/5'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <Layout size={14} />
                                            Thème Entreprise
                                        </span>
                                        <div className={`w-6 h-3 rounded-full transition-colors relative ${useCompanyTheme ? 'bg-brand-primary' : 'bg-slate-600'}`}>
                                            <div className={`absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-white transition-transform ${useCompanyTheme ? 'translate-x-3' : 'translate-x-0'}`} />
                                        </div>
                                    </button>
                                )}
                            </div>

                            <div className="border-t border-cca-border my-2" />

                            <button
                                onClick={() => {
                                    navigate('/dashboard/me');
                                    onClose();
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-cca-surface/50 transition"
                            >
                                <User size={18} className="text-brand-primary" />
                                <span className="text-sm font-medium">Moi</span>
                            </button>

                            <button
                                onClick={() => {
                                    logout();
                                    onClose();
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-red-700/60 bg-red-700/30 text-red-400 transition"
                            >
                                <LogOut size={18} />
                                <span className="text-sm font-medium">Déconnexion</span>
                            </button>
                        </div>

                        {/* Safe-area bottom padding */}
                        <div className="h-6 pb-[env(safe-area-inset-bottom)]" />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ProfileBottomSheet;
