// /frontend/src/components/chat/ReportMessageModal.jsx
import React, { useState } from 'react';
import Modal from '../Modal';
import toast from 'react-hot-toast';

const ReportMessageModal = ({ isOpen, onClose, message, onSubmit }) => {
    const [reason, setReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason || (reason === 'AUTRE' && !customReason.trim())) {
            toast.error("Veuillez sélectionner un motif et fournir une description si nécessaire.");
            return;
        }
        setIsSubmitting(true);
        try {
            // La fonction onSubmit (passée depuis ChatPage) gère l'appel API et les toasts
            await onSubmit(message.id, reason, customReason.trim());
            onClose(); // Fermer la modale en cas de succès
            // Réinitialiser pour la prochaine fois
            setReason('');
            setCustomReason('');
        } catch (error) {
            // Le toast d'erreur est géré par la fonction onSubmit ou le contexte
            console.error("Erreur dans ReportMessageModal handleSubmit:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Ne rien rendre si la modale n'est pas ouverte ou si le message manque
    if (!isOpen || !message) return null;

    const reasons = [
        { value: 'HRP', label: 'Hors Roleplay (HRP)' },
        { value: 'MIX_RP', label: 'Mélange HRP/RP (Mix RP)' },
        { value: 'GROSSIER', label: 'Propos Grossiers / Insultes' },
        { value: 'AUTRE', label: 'Autre (précisez ci-dessous)' },
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Signaler un Message">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-slate-400">Vous signalez le message suivant :</p>
                <blockquote className="border-l-4 border-slate-600 pl-4 py-2 bg-slate-700/50 rounded-r-md text-sm italic text-slate-300">
                    "{message.content}"
                </blockquote>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Motif du signalement</label>
                    <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm"
                    >
                        <option value="" disabled>Sélectionnez un motif...</option>
                        {reasons.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </div>
                {reason === 'AUTRE' && (
                    <div>
                        <label htmlFor="customReason" className="block text-sm font-medium text-slate-300 mb-1">
                            Description (max 75 caractères)
                        </label>
                        <textarea
                            id="customReason"
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                            maxLength={75}
                            required
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm h-20 resize-none"
                            placeholder="Veuillez décrire brièvement le problème..."
                        />
                    </div>
                )}
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-md text-sm">
                        Annuler
                    </button>
                    <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white text-sm disabled:opacity-50">
                        {isSubmitting ? "Envoi..." : "Envoyer le Signalement"}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ReportMessageModal;