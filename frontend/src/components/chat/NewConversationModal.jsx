// frontend/src/components/chat/NewConversationModal.jsx

import React, { useState, useEffect, useContext } from 'react';
import Select from 'react-select';
import toast from 'react-hot-toast';
import { useChat } from '../../contexts/ChatContext';
import { WebSocketContext } from '../../contexts/WebSocketContext';
import { useCompany } from '../../contexts/CompanyContext';
import { createConversation } from '@/services/chatService.js';
import { getCompanyEmployees } from '@/services/companyService.js';
import { getCompanyRanks } from '@/services/rankService.js';
import Modal from '../Modal';
import { ArrowLeft, MessageSquare, Tag } from 'lucide-react';

// Style pour react-select (réutilisé)
const selectStyles = {
    control: (styles) => ({ ...styles, backgroundColor: '#334155', border: '1px solid #475569', boxShadow: 'none', '&:hover': { borderColor: '#64748b' } }),
    menu: (styles) => ({ ...styles, backgroundColor: '#334155' }),
    option: (styles, { isFocused }) => ({ ...styles, backgroundColor: isFocused ? '#4f46e5' : '#334155', color: 'white' }),
    multiValue: (styles) => ({ ...styles, backgroundColor: '#4f46e5' }),
    multiValueLabel: (styles) => ({ ...styles, color: 'white' }),
    multiValueRemove: (styles) => ({ ...styles, color: 'white', ':hover': { backgroundColor: '#4338ca', color: 'white' } }),
    input: (styles) => ({ ...styles, color: 'white' }),
    singleValue: (styles) => ({ ...styles, color: 'white' }),
};

const NewConversationModal = ({ onClose }) => {
    const { selectedCompany } = useCompany();
    const { selectConversation } = useChat();
    const { send } = useContext(WebSocketContext);

    const [mode, setMode] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [recipients, setRecipients] = useState([]);
    const [recipientOptions, setRecipientOptions] = useState([]);
    const [category, setCategory] = useState('GENERAL');
    const [subject, setSubject] = useState('');
    const [initialMessage, setInitialMessage] = useState('');

    const hasCompanySelected = !!selectedCompany;

    // --- Chargement des données pour la sélection des destinataires ---
    useEffect(() => {
        if (hasCompanySelected) {
            const fetchRecipients = async () => {
                try {
                    const [employeesData, ranksData] = await Promise.all([
                        getCompanyEmployees(selectedCompany.id),
                        getCompanyRanks(selectedCompany.id),
                    ]);
                    const employeeOpts = Array.isArray(employeesData) ? employeesData.map(e => ({ value: `user-${e.user.id}`, label: e.user.name, type: 'user' })) : [];
                    const rankOpts = Array.isArray(ranksData) ? ranksData.map(r => ({ value: `rank-${r.id}`, label: r.name, type: 'rank' })) : [];
                    setRecipientOptions([{ label: 'Employés', options: employeeOpts }, { label: 'Rangs', options: rankOpts }]);
                } catch {
                    toast.error("Impossible de charger la liste des destinataires.");
                }
            };
            fetchRecipients();
        }
    }, [hasCompanySelected, selectedCompany]);


    // --- Logique de soumission ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            let newConversation;
            if (mode === 'TICKET') {
                if (!subject.trim() || !initialMessage.trim()) {
                    toast.error("Le sujet et le message sont requis.");
                    return;
                }
                // Pour un ticket, on ne définit que le créateur comme participant initial
                newConversation = await createConversation({ type: 'TICKET', participantIds: [], subject, category });

            } else if (mode === 'CHAT') {
                if (recipients.length === 0 || !initialMessage.trim()) {
                    toast.error("Veuillez sélectionner au moins un destinataire et écrire un message.");
                    return;
                }
                // TODO: Il faudra une logique backend pour résoudre les rangs en une liste d'IDs utilisateur
                const participantIds = recipients.filter(r => r.type === 'user').map(r => parseInt(r.value.split('-')[1]));
                newConversation = await createConversation({ type: 'GROUP', participantIds });
            }

            // Si la conversation est créée, on envoie le premier message via WebSocket
            if (newConversation) {
                send('SEND_MESSAGE', {
                    conversationId: newConversation.id,
                    content: initialMessage,
                });
                selectConversation(newConversation.id, newConversation);
                onClose();
            }

        } catch {
            toast.error("Erreur lors de la création de la conversation.");
        } finally {
            setIsLoading(false);
        }
    };


    // --- Rendu du contenu de la modale ---
    const renderContent = () => {
        // Étape 1 : Choix du mode
        if (!mode) {
            return (
                <div className="flex flex-col space-y-4">
                    <button onClick={() => hasCompanySelected && setMode('CHAT')} className="flex items-center space-x-4 p-4 bg-slate-700 rounded-lg text-left disabled:opacity-50 disabled:cursor-not-allowed" disabled={!hasCompanySelected} title={!hasCompanySelected ? "Veuillez d'abord sélectionner une entreprise" : ""}>
                        <MessageSquare size={32} className="text-indigo-400" />
                        <div><p className="font-semibold text-white">Démarrer une discussion</p><p className="text-sm text-slate-400">Envoyer un message à un ou plusieurs collègues.</p></div>
                    </button>
                    <button onClick={() => setMode('TICKET')} className="flex items-center space-x-4 p-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-left">
                        <Tag size={32} className="text-indigo-400" />
                        <div><p className="font-semibold text-white">Ouvrir un ticket de support</p><p className="text-sm text-slate-400">Poser une question au support (facturation, technique...).</p></div>
                    </button>
                </div>
            );
        }

        // Étape 2 : Le formulaire complet (cette partie était manquante)
        return (
            <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                <button type="button" onClick={() => setMode(null)} className="flex items-center text-sm text-slate-400 hover:text-white mb-2">
                    <ArrowLeft size={16} className="mr-2" /> Retour
                </button>

                {mode === 'TICKET' && (
                    <>
                        <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm">
                            <option value="BILLING">Facturation</option>
                            <option value="TECHNICAL">Support Technique</option>
                            <option value="GENERAL">Question générale</option>
                            <option value="CONTACT">Contact</option>
                            <option value="OTHER">Autre</option>
                        </select>
                        <input type="text" placeholder="Sujet de votre ticket" value={subject} onChange={e => setSubject(e.target.value)} required className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm" />
                    </>
                )}

                {mode === 'CHAT' && (
                    <Select isMulti options={recipientOptions} value={recipients} onChange={setRecipients} styles={selectStyles} placeholder="À : Employés ou Rangs..." />
                )}

                <textarea placeholder="Votre premier message..." value={initialMessage} onChange={e => setInitialMessage(e.target.value)} required className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm h-32 resize-none"></textarea>

                <div className="flex justify-end">
                    <button type="submit" disabled={isLoading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md disabled:bg-slate-600">
                        {isLoading ? 'Création...' : 'Démarrer la conversation'}
                    </button>
                </div>
            </form>
        );
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Nouvelle Conversation">
            {renderContent()}
        </Modal>
    );
};

export default NewConversationModal;