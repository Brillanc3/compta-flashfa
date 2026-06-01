// /frontend/src/components/ui/ConfirmationModal.jsx

import React from 'react';
import Modal from '../Modal';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, message, title = "Confirmation" }) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} disableOverlayClose={true}>
            <div className="space-y-6">
                {/* Utilise la prop 'message' qui contient maintenant la chaîne de caractères correcte */}
                <p className="text-cca-textSecondary text-base">{message}</p>
                <div className="flex justify-end gap-3 mt-8">
                    <button
                        type="button"
                        onClick={onClose} // Appelle directement onClose du contexte
                        className="px-5 py-2 bg-cca-base hover:bg-cca-surface text-cca-textSecondary hover:text-cca-textPrimary font-semibold rounded-md transition-all active:scale-95 border border-cca-border"
                    >
                        Annuler
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm} // Appelle directement onConfirm du contexte
                        className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md shadow-sm transition-all active:scale-95"
                    >
                        Confirmer
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmationModal;