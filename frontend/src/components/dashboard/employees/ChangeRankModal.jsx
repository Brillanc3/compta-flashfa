// /var/www/devv4/dev/frontend/src/components/dashboard/employees/ChangeRankModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from '@/components/Modal';

const ChangeRankModal = ({ isOpen, onClose, employee, ranks, onConfirm, loading }) => {
    const [selectedRankId, setSelectedRankId] = useState('');

    useEffect(() => {
        if (employee) {
            setSelectedRankId(employee.rankId || '');
        }
    }, [employee, isOpen]);

    const handleConfirm = () => {
        if (!selectedRankId) return;
        onConfirm(selectedRankId);
    };

    if (!isOpen || !employee) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Changer le rang de ${employee.user?.name}`}>
            <div className="space-y-4">
                <p className="text-slate-300 text-sm">
                    Sélectionnez un nouveau rang pour cet employé. Cela peut impacter ses permissions et sa rémunération.
                </p>
                
                <div className="space-y-1">
                    <label className="text-[11px] uppercase tracking-wide text-slate-400">Nouveau Rang</label>
                    <select
                        value={selectedRankId}
                        onChange={(e) => setSelectedRankId(e.target.value)}
                        className="
                            w-full rounded-lg bg-slate-900/60 border border-slate-700/80
                            px-3 py-2.5 text-sm text-slate-100 hover:border-slate-500/70
                            focus:border-indigo-400 focus:ring-2 outline-none transition-all
                        "
                    >
                        <option value="" disabled>Choisir un rang...</option>
                        {ranks.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || !selectedRankId || Number(selectedRankId) === Number(employee.rankId)}
                        className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition"
                    >
                        {loading ? 'En cours...' : 'Confirmer'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ChangeRankModal;
