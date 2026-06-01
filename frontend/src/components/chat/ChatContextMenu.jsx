// /frontend/src/components/chat/ChatContextMenu.jsx
import React, { useState, useRef, useEffect } from 'react';
// NOUVEAU: Importer les hooks nécessaires
import { useAuth } from '@/contexts/AuthContext';
import { useHasPermission } from '@/hooks/useHasPermission';
import { LogOut, ShieldCheck, XCircle, VolumeX, Settings, Archive, ChevronRight } from 'lucide-react';

const TICKET_CATEGORIES = ['BILLING', 'TECHNICAL', 'GENERAL', 'CONTACT', 'OTHER'];

const ChatContextMenu = ({
                             x, y, conversation, onClose,
                             onLeave, onTakeTicket, onCloseTicket, onMigrateTicket, onToggleMute
                         }) => {
    const menuRef = useRef(null);
    const [isMigrateOpen, setIsMigrateOpen] = useState(false);
    // NOUVEAU: Récupérer l'utilisateur actuel
    const { user } = useAuth();
    console.log("[DEBUG ChatContextMenu] Conversation Prop:", conversation);

    // Effet pour fermer en cliquant à l'extérieur
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // --- VRAIE VÉRIFICATION DES PERMISSIONS ---
    const canManageAllTickets = useHasPermission('CHAT.TICKETS.MANAGE_ALL');
    // Construire la permission spécifique à la catégorie du ticket actuel
    const ticketCategory = conversation?.category ? conversation.category.toUpperCase() : null; // Ensure uppercase
    const categoryPermission = conversation?.type === 'TICKET' && ticketCategory ? `CHAT.TICKETS.MANAGE_${ticketCategory}` : null;
    const canManageThisCategory = useHasPermission(categoryPermission);

    if (!conversation || !user) return null; // S'assurer que conversation et user sont chargés

    const isTicket = conversation.type === 'TICKET';
    const isMuted = conversation.isMuted;
    const isTicketOpenOrInProgress = isTicket && (conversation.status === 'OPEN' || conversation.status === 'IN_PROGRESS');
    // L'utilisateur peut gérer CE ticket s'il a la permission globale OU celle de la catégorie
    const canManageThisTicket = isTicket && (canManageAllTickets || canManageThisCategory);
    // L'utilisateur est-il l'assigné actuel ?
    const isAssignee = isTicket && conversation.assigneeId === user.id;
    const menuStyle = { top: `${y}px`, left: `${x}px`, position: 'absolute', zIndex: 1000 };

    const handleAction = (actionFn, ...args) => {
        if (actionFn) { actionFn(conversation.id, ...args); }
        setIsMigrateOpen(false);
        onClose();
    };

    const toggleMigrateMenu = (e) => { e.stopPropagation(); setIsMigrateOpen(prev => !prev); };

    return (
        <div ref={menuRef} style={menuStyle} className="bg-slate-800 border border-slate-700 rounded-md shadow-lg p-1 min-w-[180px]" onContextMenu={(e) => e.preventDefault()}>
            {/* --- Actions spécifiques aux tickets --- */}

            {/* Prendre en charge: Ticket OUVERT ET (permission globale OU de catégorie) */}
            {isTicket && conversation.status === 'OPEN' && canManageThisTicket && (
                <button onClick={() => handleAction(onTakeTicket)} className="w-full text-left flex items-center px-3 py-1.5 text-sm hover:bg-slate-700 rounded-md text-slate-200">
                    <ShieldCheck size={14} className="mr-2 text-green-400"/>Prendre en charge
                </button>
            )}

            {/* Fermer le ticket: Ticket EN COURS ET (est assigné OU permission globale OU de catégorie) */}
            {isTicket && conversation.status === 'IN_PROGRESS' && (isAssignee || canManageThisTicket) && (
                <button onClick={() => handleAction(onCloseTicket)} className="w-full text-left flex items-center px-3 py-1.5 text-sm hover:bg-slate-700 rounded-md text-slate-200">
                    <XCircle size={14} className="mr-2 text-red-400"/>Fermer le ticket
                </button>
            )}

            {/* Migrer: Ticket OUVERT ou EN COURS ET (permission globale OU de catégorie) */}
            {isTicketOpenOrInProgress && canManageThisTicket && (
                <div className="relative">
                    <button type="button" onClick={toggleMigrateMenu} className="w-full text-left flex items-center justify-between px-3 py-1.5 text-sm hover:bg-slate-700 rounded-md text-slate-200">
                        <span className="flex items-center"><Archive size={14} className="mr-2 text-blue-400"/>Migrer vers...</span>
                        <ChevronRight size={14} className={`transform transition-transform ${isMigrateOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {isMigrateOpen && (
                        <div
                            className="absolute left-full top-0 ml-1 mt-[-2px] w-40 bg-slate-800 border border-slate-700 rounded-md shadow-lg p-1 z-20"
                            onClick={(e) => e.stopPropagation()}
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            {TICKET_CATEGORIES.filter(cat => cat !== conversation.category).map(category => (
                                <button key={category} onClick={() => handleAction(onMigrateTicket, category)} className="w-full text-left block px-3 py-1.5 text-sm hover:bg-slate-700 rounded-md text-slate-200">
                                    {category}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* --- Actions communes --- */}
            {/* Afficher un séparateur seulement si des actions de ticket étaient présentes */}
            {(isTicket && canManageThisTicket && (conversation.status === 'OPEN' || conversation.status === 'IN_PROGRESS')) && <hr className="border-slate-700 my-1"/>}

            <button onClick={() => handleAction(onToggleMute)} className="w-full text-left flex items-center px-3 py-1.5 text-sm hover:bg-slate-700 rounded-md text-slate-200">
                <VolumeX size={14} className="mr-2 text-yellow-400"/>{isMuted ? 'Réactiver notifications' : 'Mettre en sourdine'}
            </button>
            {!isTicket && (
                <button onClick={() => handleAction(onLeave)} className="w-full text-left flex items-center px-3 py-1.5 text-sm text-red-400 hover:bg-slate-700 rounded-md">
                    <LogOut size={14} className="mr-2"/>Quitter la conversation
                </button>
            )}
        </div>
    );
};

export default ChatContextMenu;