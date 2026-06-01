// frontend/src/pages/admin/AdminDashboardPage.jsx
import React, { useState } from 'react';
import WidgetGrid from '@/components/dashboard/WidgetGrid';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import CustomLoader from '@/components/ui/CustomLoader';

const AdminDashboardPage = () => {
    const { user } = useAuth();
    const [isEditable, setIsEditable] = useState(false);

    const getContext = () => {
        if (user) {
            return { contextId: user.id, contextType: 'ADMIN_USER', key: 'global-dashboard' };
        }

        // Cas de secours (l'utilisateur n'est pas encore chargé)
        return { contextId: null, contextType: null, key: 'no-context' };
    };

    const { contextId, contextType } = getContext();


    // On réutilise le même hook, la logique est centralisée !
    const dashboardProps = useDashboardLayout(contextId, contextType);

    if (dashboardProps.isLoading) {
        return <CustomLoader text="Chargement du dashboard admin..." />;
    }

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white">Tableau de Bord Administrateur</h1>
                <div className="flex justify-end gap-4">
                    {isEditable ? (
                        <>
                            <button onClick={dashboardProps.handleSaveLayout} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md">Sauvegarder</button>
                            <button onClick={() => setIsEditable(false)} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-md">Terminer</button>
                        </>
                    ) : (
                        <button onClick={() => setIsEditable(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md">Personnaliser</button>
                    )}
                </div>
            </header>

            <WidgetGrid
                isEditable={isEditable}
                contextId={contextId} // Passé pour le sélecteur de widget
                contextType={contextType}
                {...dashboardProps}
            />
        </div>
    );
};

export default AdminDashboardPage;