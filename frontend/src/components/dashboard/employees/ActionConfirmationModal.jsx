// /var/www/devv4/dev/frontend/src/components/dashboard/employees/ActionConfirmationModal.jsx
import React from 'react';
import Modal from '@/components/Modal';

const ActionConfirmationModal = ({ isOpen, onClose, title, message, onConfirm, loading, variant = 'danger' }) => {
    if (!isOpen) return null;

    const btnClass = variant === 'danger' 
        ? 'bg-red-600 hover:bg-red-500' 
        : 'bg-indigo-600 hover:bg-indigo-500';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="space-y-4">
                <p className="text-slate-300 text-sm">{message}</p>
                
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition disabled:opacity-50 ${btnClass}`}
                    >
                        {loading ? 'Traitement...' : 'Confirmer'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ActionConfirmationModal;
