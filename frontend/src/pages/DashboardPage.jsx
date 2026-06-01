// frontend/src/pages/DashboardPage.jsx

import React, { useState } from 'react';
import WidgetGrid from '@/components/dashboard/WidgetGrid';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import CustomLoader from '@/components/ui/CustomLoader.jsx';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useOutletContext } from 'react-router-dom';
import { Menu } from 'lucide-react';

const DashboardPage = () => {
    const { user } = useAuth();
    const { activeCompany, activeCompanyId, isAuthLoading, loading: isCompanyLoading } = useCompany();
    const companyId = Number(activeCompanyId);

    const [isEditable, setIsEditable] = useState(false);
    const { openMenu } = useOutletContext() || {};

    const getContext = () => {
        if (activeCompany) {
            return { contextId: companyId, contextType: 'COMPANY', key: `company-${activeCompany.id}` };
        }
        if (user) {
            return { contextId: user.id, contextType: 'GLOBAL', key: 'global-dashboard' };
        }
        return { contextId: null, contextType: null, key: 'no-context' };
    };

    const { contextId, contextType, key } = getContext();
    const dashboardProps = useDashboardLayout(contextId, contextType);

    const canCustomize = Boolean(contextId);

    /**
     * Logique demandée :
     * - Terminer => sauvegarde auto + quitte
     */
    const handleFinish = async () => {
        try {
            await dashboardProps.handleSaveLayout?.();
        } finally {
            setIsEditable(false);
        }
    };

    /**
     * Suppression => supprime + sauvegarde auto
     */
    const handleDeleteWidgetAndSave = async (widgetId) => {
        // Si le hook expose une suppression atomique, on l'utilise (évite un save avec un state pas encore à jour)
        if (dashboardProps.handleDeleteWidgetAndSave) {
            return dashboardProps.handleDeleteWidgetAndSave(widgetId);
        }
        await dashboardProps.handleDeleteWidget?.(widgetId);
        return dashboardProps.handleSaveLayout?.();
    };

    /**
     * Ajout widget : on sauvegarde au moment où l'utilisateur termine.
     */
    const handleAddWidget = async (...args) => {
        return dashboardProps.handleAddWidget?.(...args);
    };

    const renderDashboardContent = () => {
        if (isAuthLoading || isCompanyLoading || dashboardProps.isLoading) {
            return <CustomLoader text="Chargement de votre espace de travail..." />;
        }

        return (
            <WidgetGrid
                key={key}
                isEditable={isEditable}
                {...dashboardProps}
                handleDeleteWidget={handleDeleteWidgetAndSave}
                handleAddWidget={handleAddWidget}
                handleSetWidgetVisibleByBreakpoint={dashboardProps.handleSetWidgetVisibleByBreakpoint}
            />
        );
    };

    return (
        <div className="space-y-6">
            {/* Header mobile */}
            <div className="md:hidden flex justify-between items-center gap-2 mb-4">
                <button
                    onClick={() => openMenu?.()}
                    className="p-2 rounded-md hover:bg-slate-700 active:scale-95 transition"
                    aria-label="Ouvrir le menu latéral"
                >
                    <Menu size={22} />
                </button>

                <h1 className="text-lg font-semibold text-white truncate flex-1">
                    Tableau de bord
                </h1>

                {canCustomize && (
                    <div className="flex gap-2">
                        {isEditable ? (
                            <button
                                onClick={handleFinish}
                                className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-md text-sm"
                            >
                                Terminer
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsEditable(true)}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm"
                            >
                                Personnaliser
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Header desktop */}
            <div className="hidden md:flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white">
                    Bienvenue, {user?.name} !
                </h1>

                {canCustomize && (
                    <div className="flex justify-end gap-4">
                        {isEditable ? (
                            <button
                                onClick={handleFinish}
                                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-md"
                            >
                                Terminer
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsEditable(true)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md"
                            >
                                Personnaliser
                            </button>
                        )}
                    </div>
                )}
            </div>

            {renderDashboardContent()}
        </div>
    );
};

export default DashboardPage;