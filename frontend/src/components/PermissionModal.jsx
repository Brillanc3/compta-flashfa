// src/components/PermissionModal.jsx
import React from 'react';

export default function PermissionModal({ onReload, _onClose }) {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center shadow-xl">
                <h2 className="text-lg font-semibold text-white">Changement de permissions détecté</h2>
                <p className="text-sm text-slate-400 mt-2">
                    Vos droits viennent d’être mis à jour. Souhaitez-vous actualiser maintenant&nbsp;?
                </p>
                <div className="flex justify-center gap-2 mt-4">
                    <button
                        onClick={onReload}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md text-white text-sm"
                    >
                        Actualiser mes permissions
                    </button>
                </div>
            </div>
        </div>
    );
}
