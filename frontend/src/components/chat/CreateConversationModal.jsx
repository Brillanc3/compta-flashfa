// frontend/src/components/chat/CreateConversationModal.jsx
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import * as chatService from '@/services/chatService';

function ModalShell({ title, children, onClose, footer }) {
    return (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm grid place-items-center p-4">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                    <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-slate-700" aria-label="Fermer">
                        <ChevronDown className="rotate-180" size={18}/>
                    </button>
                </div>
                <div className="p-4">{children}</div>
                <div className="px-4 py-3 border-t border-slate-700 bg-slate-900/70 flex justify-end gap-2">
                    {footer}
                </div>
            </div>
        </div>
    );
}

/**
 * Props:
 * - onClose: () => void
 * - onCreated: (conversationId: string) => void
 */
export default function CreateConversationModal({ onClose, onCreated }) {
    const [title, setTitle] = useState('');
    const [userIdsText, setUserIdsText] = useState('');
    const [roleIdsText, setRoleIdsText] = useState('');
    const [firstMessage, setFirstMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submit = async () => {
        const userIds = userIdsText
            .split(',')
            .map(x => x.trim())
            .filter(Boolean)
            .map(Number);

        const roleIds = roleIdsText
            .split(',')
            .map(x => x.trim())
            .filter(Boolean)
            .map(Number);

        if (userIds.length === 0 && roleIds.length === 0) {
            toast.error('Ajoutez au moins 1 utilisateur ou 1 rôle.');
            return;
        }

        // Détermine le kind côté frontend pour éviter les surprises backend
        const kind = userIds.length === 1 ? 'DIRECT' : 'GROUP';

        setIsSubmitting(true);
        try {
            // 1) création de la conversation
            const conversation = await chatService.createConversation({
                kind,
                title: title || null,
                userIds,
                roleIds,
            });

            // 2) si premier message, on l’envoie
            const text = (firstMessage || '').trim();
            if (text) {
                await chatService.postMessage(conversation.id, text);
            }

            onCreated?.(conversation.id);
        } catch (e) {
            console.error(e);
            toast.error(e?.message || 'Impossible de créer la discussion.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalShell
            title="Nouvelle discussion"
            onClose={onClose}
            footer={
                <>
                    <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-slate-600 text-slate-200">
                        Annuler
                    </button>
                    <button
                        onClick={submit}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 text-sm rounded-lg bg-slate-200 text-slate-900 hover:bg-white disabled:opacity-50"
                    >
                        {isSubmitting ? 'Création…' : 'Créer'}
                    </button>
                </>
            }
        >
            <div className="space-y-3">
                <div>
                    <label className="block text-xs text-slate-300 mb-1">Titre (optionnel)</label>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
                        placeholder="Ex: Équipe RH + John"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-slate-300 mb-1">IDs utilisateurs (séparés par des virgules)</label>
                        <input
                            value={userIdsText}
                            onChange={(e) => setUserIdsText(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
                            placeholder="ex: 12, 45, 78"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-300 mb-1">IDs rôles (optionnel)</label>
                        <input
                            value={roleIdsText}
                            onChange={(e) => setRoleIdsText(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
                            placeholder="ex: 3, 5"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-slate-300 mb-1">Premier message (optionnel)</label>
                    <textarea
                        value={firstMessage}
                        onChange={(e) => setFirstMessage(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
                        placeholder="Démarrer la discussion…"
                    />
                </div>
            </div>
        </ModalShell>
    );
}
