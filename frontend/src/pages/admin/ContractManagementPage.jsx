// frontend/src/pages/admin/ContractManagementPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { getContractTemplates } from '@/services/contractService';
import ContractTemplateForm from '@/components/admin/ContractTemplateForm';
import { FileText, Plus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const ContractManagementPage = () => {
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormVisible, setIsFormVisible] = useState(false);

    const fetchTemplates = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await getContractTemplates();
            setTemplates(data);
        } catch {
            toast.error("Impossible de charger la liste des templates de contrats.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const handleTemplateCreated = () => {
        fetchTemplates();
        setIsFormVisible(false);
    }

    if (isLoading) {
        return <p className="text-slate-400">Chargement des templates...</p>;
    }

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center border-b border-slate-700 pb-4">
                <h1 className="text-3xl font-bold text-white flex items-center">
                    <FileText size={28} className="mr-3 text-indigo-400"/> Gestion des Modèles de Contrats
                </h1>
                <button
                    onClick={() => setIsFormVisible(prev => !prev)}
                    className="flex items-center py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition-colors"
                >
                    <Plus size={20} className="mr-2"/> {isFormVisible ? 'Annuler' : 'Créer un Template'}
                </button>
            </header>

            {isFormVisible && (
                <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
                    <ContractTemplateForm onTemplateCreated={handleTemplateCreated} />
                </div>
            )}

            <div className="bg-slate-800 rounded-lg shadow-md p-4">
                <h2 className="text-xl font-semibold text-white mb-4">Templates Actuels ({templates.length})</h2>
                {templates.length === 0 ? (
                    <p className="text-slate-400">Aucun modèle de contrat trouvé. Commencez par en créer un.</p>
                ) : (
                    <ul className="space-y-3">
                        {templates.map(template => (
                            <li key={template.id} className="bg-slate-700/50 p-4 rounded-md flex justify-between items-center border-l-4 border-indigo-500">
                                <div>
                                    <h3 className="font-semibold text-white">{template.title}</h3>
                                    {/* MODIFIÉ : On lit les données maintenant envoyées par l'API */}
                                    <p className="text-sm text-slate-400 mt-1">Type : {template.type} | Champs : {template._count.fields}</p>
                                </div>
                                <div className="flex space-x-2">
                                    <button className="p-2 text-indigo-400 hover:text-indigo-300">
                                        <Edit size={18} />
                                    </button>
                                    <button className="p-2 text-red-400 hover:text-red-300">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default ContractManagementPage;