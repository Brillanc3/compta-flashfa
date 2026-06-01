// /frontend/src/components/layout/MobileNavBar.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, MessageCircle, Bell, User, Menu } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNotifications } from '@/contexts/NotificationContext';
import NotificationsBottomSheet from './NotificationsBottomSheet';
import ProfileBottomSheet from './ProfileBottomSheet';

/**
 * MobileNavBar avec animation d’apparition/disparition (slide + fade).
 * Le parent (DashboardLayout) peut contrôler la visibilité via `isVisible`.
 */
const MobileNavBar = ({ onMenuClick, isMenuOpen = false, onNavigate, isVisible = true }) => {
    const location = useLocation();
    const { unreadCount } = useNotifications();
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const tabs = useMemo(
        () => [
            { to: 'MENU_TOGGLE', label: 'Menu', icon: Menu },
            { to: '/dashboard', label: 'Accueil', icon: Home },
            { to: '/dashboard/chat', label: 'Tchat', icon: MessageCircle },
            { to: 'NOTIFICATIONS', label: 'Alertes', icon: Bell },
            { to: 'PROFIL', label: 'Profil', icon: User },
        ],
        []
    );

    const activeIndex = useMemo(() => {
        if (location.pathname.startsWith('/dashboard/me')) return 4;
        if (location.pathname.startsWith('/dashboard/chat')) return 2;
        if (location.pathname.startsWith('/dashboard')) return 1;
        return -1;
    }, [location.pathname]);

    const baseBtn =
        'relative flex flex-col items-center justify-center h-full transition-all duration-150 active:scale-95';
    const inactive = 'text-cca-textSecondary hover:text-cca-textPrimary';
    const active = 'text-brand-primary font-bold';

    // Petites optimisations UX:
    // - si la barre disparaît, on ferme les bottom sheets
    useEffect(() => {
        if (!isVisible) {
            setIsNotifOpen(false);
            setIsProfileOpen(false);
        }
    }, [isVisible]);

    return (
        <>
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        key="mobile-navbar"
                        className="md:hidden fixed inset-x-0 bottom-0 z-50 pointer-events-none"
                        initial={{ opacity: 0, y: 24, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 28, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                        <div className="pb-[env(safe-area-inset-bottom)]" />

                        <div className="relative mx-auto mb-4 w-[96%] max-w-sm h-16 bg-cca-surface/80 backdrop-blur-md border border-cca-border/70 rounded-2xl shadow-xl pointer-events-auto overflow-hidden transition-colors duration-300">
                            <nav className="grid grid-cols-5 h-full relative">
                                {tabs.map((tab, i) => {
                                    const Icon = tab.icon;
                                    const isActive = i === activeIndex;
                                    const showBadge = tab.label === 'Alertes' && unreadCount > 0;

                                    if (tab.to === 'NOTIFICATIONS') {
                                        return (
                                            <button
                                                key={tab.label}
                                                onClick={() => setIsNotifOpen(true)}
                                                className={`${baseBtn} ${inactive}`}
                                            >
                                                <div className="relative">
                                                    <Icon size={22} />
                                                    {showBadge && (
                                                        <motion.span
                                                            layout
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            exit={{ scale: 0 }}
                                                            transition={{
                                                                type: 'spring',
                                                                stiffness: 300,
                                                                damping: 20,
                                                            }}
                                                            className="absolute -top-1.5 -right-1.5 flex items-center justify-center h-3.5 w-3.5 rounded-full bg-red-500 text-[10px] text-white font-bold"
                                                        >
                                                            {unreadCount > 9 ? '9+' : unreadCount}
                                                        </motion.span>
                                                    )}
                                                </div>
                                                <span className="text-[11px] mt-1">Alertes</span>
                                            </button>
                                        );
                                    }

                                    if (tab.to === 'PROFIL') {
                                        return (
                                            <button
                                                key={tab.label}
                                                onClick={() => setIsProfileOpen(true)}
                                                className={`${baseBtn} ${inactive}`}
                                            >
                                                <Icon size={22} />
                                                <span className="text-[11px] mt-1">{tab.label}</span>
                                            </button>
                                        );
                                    }

                                    if (tab.to === 'MENU_TOGGLE') {
                                        return (
                                            <button
                                                key={tab.label}
                                                onClick={onMenuClick}
                                                aria-pressed={isMenuOpen}
                                                className={`${baseBtn} ${isMenuOpen ? active : inactive}`}
                                            >
                                                <Icon size={22} />
                                                <span className="text-[11px] mt-1">
                                                    {isMenuOpen ? 'Fermer' : 'Menu'}
                                                </span>
                                            </button>
                                        );
                                    }

                                    return (
                                        <NavLink
                                            key={tab.label}
                                            to={tab.to}
                                            onClick={() => {
                                                if (onNavigate) onNavigate();
                                            }}
                                            end={tab.to === '/dashboard'}
                                            className={({ isActive: activeLink }) =>
                                                `${baseBtn} ${(activeLink || isActive) ? active : inactive}`
                                            }
                                        >
                                            <Icon size={22} />
                                            <span className="text-[11px] mt-1">{tab.label}</span>
                                        </NavLink>
                                    );
                                })}
                            </nav>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <NotificationsBottomSheet isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />

            <ProfileBottomSheet isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
        </>
    );
};

export default MobileNavBar;
