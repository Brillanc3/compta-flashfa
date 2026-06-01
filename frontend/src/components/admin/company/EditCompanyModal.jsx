// /frontend/src/components/admin/company/EditCompanyModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from '@/components/Modal'; // Assurez-vous que le chemin est correct
import { updateCompanyAdmin } from '@/services/adminService';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';

const EditCompanyModal = ({ isOpen, onClose, onComplete, company }) => {
    const [name, setName] = useState('');
    const [isParentCompany, setIsParentCompany] = useState(false);
    const [groupId, setGroupId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && company) {
            setName(company.name || '');
            setIsParentCompany(company.isParentCompany || false);
            setGroupId(company.groupId != null ? String(company.groupId) : '');
            setError(null);
        }
        if (!isOpen) {
            setName('');
            setIsParentCompany(false);
            setGroupId('');
            setError(null);
            setIsLoading(false);
        }
    }, [isOpen, company]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!name.trim()) {
            setError("Le nom de l'entreprise est requis.");
            return;
        }
        setIsLoading(true);
        try {
            // Construire l'objet des données à mettre à jour
            await updateCompanyAdmin(company.id, {
                name: name.trim(),
                isParentCompany,
                groupId: groupId !== '' ? Number(groupId) : null,
            });
            toast.success(`Entreprise "${name.trim()}" mise à jour.`);
            onComplete(); // Rafraîchir la liste
            onClose();    // Fermer la modale
        } catch (err) {
            setError(err.message || "Une erreur est survenue lors de la mise à jour.");
            toast.error(err.message || "Erreur de mise à jour.");
        } finally {
            setIsLoading(false);
        }
    };

    // Utiliser onClose directement pour fermer
    // handleClose n'est plus nécessaire si on réinitialise dans useEffect

    // Ne pas rendre si pas ouvert ou pas d'entreprise
    if (!isOpen || !company) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Modifier l'Entreprise : ${company.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <p className="text-red-400 bg-red-900/30 p-3 rounded-md text-sm">{error}</p>}
                <div>
                    <label htmlFor="editCompanyName" className="block text-sm font-medium text-slate-300 mb-1">
                        Nom de l'entreprise <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        id="editCompanyName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="editIsParentCompany"
                        checked={isParentCompany}
                        onChange={(e) => setIsParentCompany(e.target.checked)}
                        className="h-4 w-4 rounded text-indigo-600 bg-slate-700 border-slate-600 focus:ring-indigo-500 mr-2"
                    />
                    <label htmlFor="editIsParentCompany" className="text-sm text-slate-300">
                        Marquer comme entreprise parente ?
                    </label>
                </div>
                <p className="text-xs text-slate-500 italic">
                    Note : Il ne peut y avoir qu'une seule entreprise parente. Cocher cette case échouera si une autre entreprise est déjà parente.
                </p>
                <div>
                    <label htmlFor="editGroupId" className="block text-sm font-medium text-slate-300 mb-1">
                        Group ID (jeu) <span className="text-slate-500 text-xs">— optionnel</span>
                    </label>
                    <input
                        type="number"
                        id="editGroupId"
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                        placeholder="Ex: 42"
                    />
                </div>
                <div className="flex justify-end gap-4 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-md disabled:opacity-50"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md disabled:opacity-50 flex items-center justify-center min-w-[120px]" // Largeur min ajustée
                    >
                        {isLoading ? <Spinner size="sm" /> : 'Enregistrer'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default EditCompanyModal;