// frontend/src/pages/dashboard/OnboardingCodesPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { getOnboardingCodes, createOnboardingCode, deleteOnboardingCode } from '../../services/companyService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import Spinner from '../../components/ui/Spinner';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import {useCompany} from "@/contexts/CompanyContext.jsx";

const OnboardingCodesPage = () => {
    const { activeCompanyId } = useCompany();
    const companyId = activeCompanyId;
    const [codes, setCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

    const fetchCodes = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getOnboardingCodes(companyId);
            setCodes(data);
        } catch (err) {
            setError(err.message || "Erreur lors du chargement des codes.");
            toast.error(err.message || "Erreur de chargement.");
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        fetchCodes();
    }, [fetchCodes]);

    const handleCreateCode = async (durationInHours = null) => {
        setIsCreating(true);
        try {
            const newCode = await createOnboardingCode(companyId, { durationInHours });
            setCodes(prevCodes => [newCode, ...prevCodes]);
            toast.success(`Code "${newCode.code}" créé avec succès !`);
        } catch (err) {
            toast.error(err.message || "Impossible de créer le code.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteCode = (codeId) => {
        setConfirmModal({
            isOpen: true,
            message: "Êtes-vous sûr de vouloir supprimer ce code ? Il sera immédiatement invalidé.",
            onConfirm: async () => {
                setConfirmModal(p => ({ ...p, isOpen: false }));
                try {
                    await deleteOnboardingCode(companyId, codeId);
                    setCodes(prevCodes => prevCodes.filter(code => code.id !== codeId));
                    toast.success("Code supprimé.");
                } catch (err) {
                    toast.error(err.message || "Impossible de supprimer le code.");
                }
            },
        });
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success(`Code "${text}" copié !`);
    };

    if (loading) return <div className="flex justify-center"><Spinner /></div>;
    if (error) return <div className="text-center text-red-500">{error}</div>;

    return (
        <div className="space-y-8">
            <div className="pb-5 border-b border-slate-700">
                <h1 className="text-3xl font-bold text-white">Gestion des Codes d'Invitation</h1>
                <p className="mt-2 text-lg text-slate-400">Créez et gérez les codes à usage unique pour l'intégration des nouveaux employés.</p>
            </div>

            {/* Section de création */}
            <div className="bg-slate-800 shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-white mb-4">Créer un nouveau code</h3>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={() => handleCreateCode(null)} disabled={isCreating} className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-500">
                        <AddCircleOutlineIcon className="mr-2" />
                        Créer un code permanent
                    </button>
                    <button onClick={() => handleCreateCode(24)} disabled={isCreating} className="flex items-center justify-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-500">
                        <AddCircleOutlineIcon className="mr-2" />
                        Créer un code de 24h
                    </button>
                </div>
            </div>

            {/* Section de la liste */}
            <div className="bg-slate-800 shadow rounded-lg">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-white">Codes actifs</h3>
                    <div className="mt-4 flow-root">
                        {codes.length > 0 ? (
                            <ul className="divide-y divide-slate-700">
                                {codes.map(code => (
                                    <li key={code.id} className="py-4 flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-mono text-lg text-green-400 tracking-widest">{code.code}</p>
                                            <p className="text-sm text-slate-400">
                                                Expire : {code.expiresAt ? format(new Date(code.expiresAt), 'd MMMM yyyy à HH:mm', { locale: fr }) : 'Jamais'}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <button onClick={() => copyToClipboard(code.code)} className="text-slate-400 hover:text-white"><ContentCopyIcon /></button>
                                            <button onClick={() => handleDeleteCode(code.id)} className="text-red-500 hover:text-red-400"><DeleteIcon /></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-slate-400">Aucun code actif pour le moment.</p>
                        )}
                    </div>
                </div>
            </div>
        <ConfirmationModal
            isOpen={confirmModal.isOpen}
            onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
            onConfirm={confirmModal.onConfirm}
            message={confirmModal.message}
        />
        </div>
    );
};

export default OnboardingCodesPage;