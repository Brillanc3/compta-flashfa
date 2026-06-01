// /frontend/src/components/chat/ChatMessage.jsx
import React, { useContext } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/contexts/AuthContext';
import { Bot, Check, AlertTriangle, MoreVertical, Trash2 } from 'lucide-react';
import { WebSocketContext } from '@/contexts/WebSocketContext';
import { acceptAppointment } from '@/services/chatService';
import { motion } from 'framer-motion';

// --- Sous-composant: Proposition de RDV ---
const AppointmentProposal = ({ message, onAccept }) => {
    const { user } = useAuth();
    if (!message.payload) return <p className="text-red-400 italic">Données de RDV invalides.</p>;

    let payloadData = {};
    try {
        payloadData = JSON.parse(message.payload);
    } catch {
        return <p className="text-red-400 italic">Erreur interne: Impossible de lire les données du RDV.</p>;
    }

    const { proposerId, clientId, startTime, title, description, status } = payloadData;
    const isClient = user.id === clientId;
    const isAgent = user.id === proposerId;
    const dateRdv = new Date(startTime);

    return (
        <div className="border border-indigo-500/50 rounded-lg p-3 mt-2 bg-indigo-900/20">
            <p className="font-semibold text-indigo-300 mb-1">Proposition de Rendez-vous</p>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-slate-400 mb-2">{description}</p>
            <p className="text-sm font-bold">
                {format(dateRdv, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </p>
            <div className="mt-3 text-right">
                {status === 'PENDING' && isClient && (
                    <button
                        onClick={() => onAccept(message.id, message.conversationId)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded"
                    >
                        <Check size={14} className="inline mr-1" /> Accepter
                    </button>
                )}
                {status === 'PENDING' && isAgent && (
                    <span className="text-xs italic text-slate-500">
                        En attente de la réponse du client...
                    </span>
                )}
                {status === 'ACCEPTED' && (
                    <span className="inline-flex items-center px-3 py-1 bg-green-800/50 text-green-300 text-xs font-bold rounded">
                        <Check size={14} className="inline mr-1" /> Confirmé
                    </span>
                )}
                {status === 'CANCELLED' && (
                    <span className="inline-flex items-center px-3 py-1 bg-red-800/50 text-red-300 text-xs font-bold rounded">
                        Annulé
                    </span>
                )}
            </div>
        </div>
    );
};

// --- Composant Principal: ChatMessage ---
const ChatMessage = ({ message, onContextMenu, onDeleteEphemeral }) => {
    const { user } = useAuth();
    const { send } = useContext(WebSocketContext);

    if (!user || !message) return null;
    const isMe = message.sender?.id === user.id;
    const senderName = message.sender?.name || 'Système';

    const handleAcceptAppointment = (messageId, conversationId) => {
        acceptAppointment(send, messageId, conversationId);
    };

    // === MESSAGE SYSTÈME ===
    if (message.type === 'SYSTEM') {
        const formatted = message.content?.replace(/\n/g, '  \n') || '';
        return (
            <div className="text-center text-xs text-slate-400 italic my-2 py-1 border-y border-slate-700/50 max-w-2xl mx-auto">
                <ReactMarkdown
                    className="prose prose-sm prose-invert text-center"
                    remarkPlugins={[remarkGfm]}
                >
                    {formatted}
                </ReactMarkdown>
                <p className="text-[11px] mt-1 text-slate-500">
                    {format(new Date(message.createdAt), 'HH:mm', { locale: fr })}
                </p>
            </div>
        );
    }

    // === MESSAGE ÉPHÉMÈRE ===
    if (message.isEphemeral) {
        const isError = message.isError;
        return (
            <motion.div
                className={`relative flex items-start gap-2 mb-2 p-2 rounded ${isError ? 'bg-red-900/30' : 'bg-slate-700/50'}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="flex-shrink-0 mt-1">
                    {isError ? (
                        <AlertTriangle size={16} className="text-red-400" />
                    ) : (
                        <Bot size={16} className="text-indigo-400" />
                    )}
                </div>

                <div className="flex-1 text-sm prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                    </ReactMarkdown>
                    <p className="text-xs text-slate-500 mt-1 italic">
                        (Visible uniquement pour vous) – {format(new Date(message.createdAt), 'HH:mm', { locale: fr })}
                    </p>
                </div>

                {/* Bouton Supprimer */}
                <button
                    onClick={() => onDeleteEphemeral?.(message)}
                    className="absolute top-1 right-1 p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
                    title="Supprimer ce message éphémère"
                >
                    <Trash2 size={14} />
                </button>
            </motion.div>
        );
    }

    // === MESSAGE UTILISATEUR / AUTRE ===
    return (
        <motion.div
            onContextMenu={onContextMenu}
            className={`flex items-start gap-2 mb-4 group relative ${isMe ? 'justify-end' : 'justify-start'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            {!isMe && (
                <div className="flex-shrink-0 order-1 mt-1">
                    {message.sender?.profileImageUrl ? (
                        <img
                            src={message.sender.profileImageUrl}
                            alt={senderName}
                            className="w-8 h-8 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">
                            {senderName.charAt(0)}
                        </div>
                    )}
                </div>
            )}

            <div
                className={`relative max-w-md md:max-w-lg p-3 rounded-lg shadow ${
                    isMe ? 'order-1 bg-indigo-600 text-white' : 'order-2 bg-slate-700 text-slate-200'
                }`}
            >
                {!isMe && <p className="font-semibold text-sm text-indigo-300 mb-1">{senderName}</p>}

                {message.type === 'USER' && (
                    <div className="text-base prose prose-sm prose-invert max-w-none break-words">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                        </ReactMarkdown>
                    </div>
                )}

                {message.type === 'APPOINTMENT_PROPOSAL' && (
                    <AppointmentProposal
                        message={message}
                        onAccept={handleAcceptAppointment}
                    />
                )}

                <p
                    className={`text-xs mt-1 text-right ${
                        isMe ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                >
                    {format(new Date(message.createdAt), 'HH:mm', { locale: fr })}
                </p>
            </div>
        </motion.div>
    );
};

export default ChatMessage;
