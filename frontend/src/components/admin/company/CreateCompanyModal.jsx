// /frontend/src/components/admin/company/CreateCompanyModal.jsx
import React, { useState } from 'react';
import Modal from '@/components/Modal'; // Assurez-vous que le chemin est correct
import { createCompany } from '@/services/adminService'; // Importer la fonction API
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';

const CreateCompanyModal = ({ isOpen, onClose, onComplete }) => {
    const [name, setName] = useState('');
    const [isParentCompany, setIsParentCompany] = useState(false);
    const [groupId, setGroupId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null); // Réinitialiser l'erreur
        if (!name.trim()) {
            setError("Le nom de l'entreprise est requis.");
            return;
        }
        setIsLoading(true);
        try {
            await createCompany({ name: name.trim(), isParentCompany, groupId: groupId !== '' ? Number(groupId) : undefined });
            toast.success(`Entreprise "${name.trim()}" créée avec succès.`);
            onComplete(); // Rafraîchir la liste dans la page parente
            onClose();    // Fermer la modale
            // Réinitialiser le formulaire pour la prochaine ouverture
            setName('');
            setIsParentCompany(false);
            setGroupId('');
        } catch (err) {
            setError(err.message || "Une erreur est survenue lors de la création.");
            toast.error(err.message || "Erreur de création.");
        } finally {
            setIsLoading(false);
        }
    };

    // Réinitialiser quand la modale se ferme
    const handleClose = () => {
        setName('');
        setIsParentCompany(false);
        setGroupId('');
        setError(null);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Créer une Nouvelle Entreprise">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <p className="text-red-400 bg-red-900/30 p-3 rounded-md text-sm">{error}</p>}
                <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-slate-300 mb-1">
                        Nom de l'entreprise <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        id="companyName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                        placeholder="Nom unique de l'entreprise"
                    />
                </div>
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="isParentCompany"
                        checked={isParentCompany}
                        onChange={(e) => setIsParentCompany(e.target.checked)}
                        className="h-4 w-4 rounded text-indigo-600 bg-slate-700 border-slate-600 focus:ring-indigo-500 mr-2"
                    />
                    <label htmlFor="isParentCompany" className="text-sm text-slate-300">
                        Marquer comme entreprise parente ?
                    </label>
                </div>
                <p className="text-xs text-slate-500 italic">
                    Note : Il ne peut y avoir qu'une seule entreprise parente. Cocher cette case échouera si une autre entreprise est déjà parente.
                </p>
                <div>
                    <label htmlFor="groupId" className="block text-sm font-medium text-slate-300 mb-1">
                        Group ID (jeu) <span className="text-slate-500 text-xs">— optionnel</span>
                    </label>
                    <input
                        type="number"
                        id="groupId"
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                        placeholder="Ex: 42"
                    />
                </div>
                <div className="flex justify-end gap-4 pt-4">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isLoading}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-md disabled:opacity-50"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md disabled:opacity-50 flex items-center justify-center min-w-[100px]"
                    >
                        {isLoading ? <Spinner size="sm" /> : 'Créer'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default CreateCompanyModal;