// frontend/src/pages/dashboard/CompanySettingsPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { getCompanySettings } from '@/services/companyService.js';
import toast from 'react-hot-toast';

// Importation des futurs composants que nous allons créer
import UpdateCompanyNameForm from '../../components/dashboard/settings/UpdateCompanyNameForm';
import CompanyModuleSettingsForm from '../../components/dashboard/settings/CompanyModuleSettingsForm';
import ApiKeyManager from '../../components/dashboard/settings/ApiKeyManager';
import OnboardingKeyManager from '../../components/dashboard/settings/OnboardingKeyManager';
import Spinner from '../../components/ui/Spinner';
import {useCompany} from "@/contexts/CompanyContext.jsx";

const CompanySettingsPage = () => {
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fonction pour charger les données, mise en cache avec useCallback
    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getCompanySettings(companyId);
            setSettings(data);
        } catch (err) {
            setError(err.message || "Erreur lors du chargement des paramètres.");
            toast.error(err.message || "Erreur de chargement.");
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    // Appel de la fonction de chargement au montage du composant
    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // Fonction pour mettre à jour l'état local depuis un composant enfant
    const handleSettingsUpdate = (updatedData) => {
        setSettings(currentSettings => ({ ...currentSettings, ...updatedData }));
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Spinner />
            </div>
        );
    }

    if (error) {
        return <div className="text-center text-red-500 bg-red-900/50 p-4 rounded-md">{error}</div>;
    }

    return (
        <div className="space-y-8">
            <div className="pb-5 border-b border-slate-700">
                <h1 className="text-3xl font-bold text-white">
                    Paramètres de l'entreprise
                </h1>
                <p className="mt-2 text-lg text-slate-400">
                    Gérez les informations générales et les clés d'accès de "{settings?.name}".
                </p>
            </div>

            {/* Chaque section est gérée par un composant dédié */}
            {settings && (
                <div className="space-y-10">
                    <UpdateCompanyNameForm settings={settings} onUpdate={handleSettingsUpdate} />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <ApiKeyManager settings={settings} onUpdate={handleSettingsUpdate} />
                        <OnboardingKeyManager settings={settings} onUpdate={handleSettingsUpdate} />
                    </div>

                    {/* NOUVEAU: Settings modules */}
                    <CompanyModuleSettingsForm settings={settings} onUpdate={handleSettingsUpdate} />

                </div>
            )}
        </div>
    );
};

export default CompanySettingsPage;