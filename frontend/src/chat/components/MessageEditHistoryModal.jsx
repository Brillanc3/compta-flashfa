import React, { useEffect, useState } from 'react';
import { X, Clock, Loader2 } from 'lucide-react';
import { getMessageEditHistory } from '@/services/chatService';

export default function MessageEditHistoryModal({ channelId, messageId, onClose }) {
    const [edits, setEdits] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const ac = new AbortController();
        getMessageEditHistory(channelId, messageId)
            .then(setEdits)
            .catch((err) => {
                if (!ac.signal.aborted) setError(err?.response?.data?.message ?? 'Erreur de chargement');
            });

        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => {
            ac.abort();
            document.removeEventListener('keydown', onKey);
        };
    }, [channelId, messageId, onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="bg-cca-surface border border-cca-border rounded-xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-cca-border shrink-0">
                    <div className="flex items-center gap-2 text-cca-textPrimary font-semibold text-sm">
                        <Clock className="w-4 h-4 text-brand-primary" />
                        Historique des modifications
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded hover:bg-cca-base text-cca-textSecondary hover:text-cca-textPrimary transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-4 space-y-3">
                    {!edits && !error && (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-cca-textSecondary" />
                        </div>
                    )}
                    {error && (
                        <p className="text-red-400 text-sm text-center py-4">{error}</p>
                    )}
                    {edits && edits.length === 0 && (
                        <p className="text-cca-textSecondary text-sm text-center py-4">Aucun historique d'édition.</p>
                    )}
                    {edits && edits.map((edit, i) => (
                        <div key={edit.id} className="bg-cca-base rounded-lg p-3 border border-cca-border/60">
                            <p className="text-[11px] text-cca-textSecondary mb-1.5">
                                {i === 0 ? 'Version précédente' : `Version ${edits.length - i}`}
                                {' · '}
                                {new Date(edit.editedAt).toLocaleString('fr-FR', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                })}
                            </p>
                            <p className="text-sm text-cca-textPrimary/80 whitespace-pre-wrap break-words leading-relaxed">
                                {edit.content || <span className="italic text-cca-textSecondary">(vide)</span>}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
