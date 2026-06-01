import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock } from 'lucide-react';
import { getMessageEditHistory } from '../../api/client';

function formatDateTime(ts) {
    try {
        return new Date(ts).toLocaleString([], {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return ''; }
}

export default function MessageEditHistoryModal({ guildId, channelId, messageId, onClose }) {
    const [edits, setEdits]   = useState([]);
    const [loading, setLoad]  = useState(true);
    const [error, setError]   = useState(null);

    useEffect(() => {
        setLoad(true);
        getMessageEditHistory(guildId, channelId, messageId)
            .then(data => setEdits(Array.isArray(data) ? data : []))
            .catch(() => setError('Impossible de charger l\'historique.'))
            .finally(() => setLoad(false));
    }, [guildId, channelId, messageId]);

    const handleBackdrop = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={handleBackdrop}
        >
            <div className="relative w-full max-w-md mx-4 bg-cca-surface border border-cca-border rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-cca-border">
                    <div className="flex items-center gap-2 text-cca-textPrimary font-semibold text-sm">
                        <Clock size={15} />
                        Historique des modifications
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-cca-textSecondary hover:text-cca-textPrimary transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="max-h-96 overflow-y-auto p-4 space-y-3">
                    {loading && (
                        <p className="text-cca-textSecondary text-sm text-center py-6">Chargement…</p>
                    )}
                    {error && (
                        <p className="text-red-500 text-sm text-center py-6">{error}</p>
                    )}
                    {!loading && !error && edits.length === 0 && (
                        <p className="text-cca-textSecondary text-sm text-center py-6">Aucun historique disponible.</p>
                    )}
                    {!loading && !error && edits.map((edit) => (
                        <div key={edit.id} className="rounded-xl bg-cca-bg border border-cca-border/50 p-3 space-y-1">
                            <p className="text-xs text-cca-textSecondary">
                                {formatDateTime(edit.editedAt)}
                                {edit.editorUsername && (
                                    <span className="ml-2 text-cca-textPrimary font-medium">
                                        par {edit.editorNickname ?? edit.editorUsername}
                                    </span>
                                )}
                            </p>
                            <p className="text-sm text-cca-textPrimary whitespace-pre-wrap break-words">
                                {edit.content}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}
