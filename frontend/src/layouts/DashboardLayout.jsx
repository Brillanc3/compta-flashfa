// /frontend/src/layouts/DashboardLayout.jsx
import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import { useCompany } from '../contexts/CompanyContext';
import Spinner from '../components/ui/Spinner';
import { ContractSigningModal } from '@/components/contracts/ContractSigningModal';
import { useNotifications } from '@/contexts/NotificationContext';
import ProfileCompletionGuard from '@/components/ProfileCompletionGuard';
import MobileNavBar from '@/components/layout/MobileNavBar';
import { usePermissions } from '@/contexts/PermissionsContext';
import WebSocketStatus from '@/components/layout/WebSocketStatus';
import { useAuth } from '@/contexts/AuthContext';

const DashboardLayout = () => {
    const { user } = useAuth();
    const isDemo = user?.username === 'demo';
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const { loading: companyLoading } = useCompany();
    const { isLoading } = usePermissions();
    useNotifications();
    const [_signingContractId, setSigningContractId] = useState(null);

    const openContractSignature = (contractId) => setSigningContractId(contractId);

    if (companyLoading || isLoading) {
        return (
            <div className="min-h-screen bg-cca-base flex justify-center items-center">
                <Spinner />
            </div>
        );
    }

    const openMenu = () => setIsSidebarOpen(true);
    const closeMenu = () => setIsSidebarOpen(false);

    const isChatRoute = location?.pathname?.startsWith('/dashboard/chat')
        || location?.pathname?.startsWith('/dashboard/tchatv2');

    // Visible si sidebar fermée (sauf chat : évite padding/scroll inutiles + overlap input)
    const showMobileNav = !isSidebarOpen && !isChatRoute;

    return (
        <>
            <WebSocketStatus />

            <div className="min-h-screen h-screen supports-[height:100dvh]:h-[100dvh] relative bg-cca-base text-cca-textPrimary flex overflow-hidden transition-colors duration-300">
                <div className="relative z-[1] flex flex-1">
                    <DashboardSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

                    <div className="flex-1 flex flex-col relative z-[1]">
                        {isDemo && (
                            <div className="bg-amber-100 border-b border-amber-200 text-amber-800 px-4 py-2 text-sm flex items-center justify-center gap-2 font-medium">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span>
                                    <strong>Mode DÉMO actif</strong> — Les modifications sont désactivées sur ce compte.
                                </span>
                            </div>
                        )}
                        <main
                            className={[
                                "flex-1 relative z-[1]",
                                isChatRoute
                                    ? "overflow-hidden p-0"
                                    : "overflow-y-auto p-4 sm:p-6 lg:p-8",
                                isChatRoute
                                    ? "pb-0"
                                    : (showMobileNav
                                        ? "pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-0"
                                        : "pb-4 md:pb-0"),
                            ].join(" ")}
                        >
                            <ProfileCompletionGuard>
                                <Outlet context={{ openContractSignature, openMenu }} />
                            </ProfileCompletionGuard>
                        </main>
                    </div>
                </div>
            </div>

            {isSidebarOpen && (
                <button
                    type="button"
                    aria-label="Fermer le menu"
                    onClick={closeMenu}
                    className="md:hidden fixed inset-y-0 right-0 left-[min(85vw,20rem)] z-40 bg-black/40 backdrop-blur-[2px]"
                />
            )}

            <MobileNavBar
                onMenuClick={openMenu}
                isMenuOpen={false}
                onNavigate={closeMenu}
                isVisible={showMobileNav}
            />
        </>
    );
};

export default DashboardLayout;