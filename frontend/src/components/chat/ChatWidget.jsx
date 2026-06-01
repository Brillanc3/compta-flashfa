// frontend/src/components/chat/ChatWidget.jsx

import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { WebSocketContext } from '../../contexts/WebSocketContext';
import { leaveConversation, takeTicket, closeTicket, migrateTicket, toggleMuteConversation } from '@/services/chatService.js';
import { getRanks } from '@/services/employeesService.js';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { MessageSquare, Send, X, Users, Tag, Plus, MessageCircle, ChevronsUp, ChevronsDown, RefreshCw, ArrowLeft } from 'lucide-react';
import NewConversationModal from './NewConversationModal'; // Import du futur composant
import ChatContextMenu from './ChatContextMenu';
import MentionDropdown from './MentionDropdown';
import toast from "react-hot-toast";
import { useAudioNotification } from '@/hooks/useAudioNotification';

const ConversationItem = ({ convo, activeConversationId, unreadConversations, onSelect, onContextMenu, handleTouchStart, handleTouchEnd }) => {
    const isUnread = unreadConversations.has(convo.id);
    const lastMessage = convo.messages?.[0];
    const isActive = convo.id === activeConversationId;

    const getStatusColor = (status) => {
        switch (status) {
            case 'OPEN': return 'bg-orange-500';
            case 'IN_PROGRESS': return 'bg-blue-500';
            case 'RESOLVED': return 'bg-green-500';
            case 'CLOSED': return 'bg-slate-600';
            default: return 'bg-slate-600';
        }
    };

    const iconColor = convo.type === 'TICKET' ? getStatusColor(convo.status) : 'bg-slate-600';
    const Icon = convo.type === 'TICKET' ? Tag : Users;

    return (
        <div
            key={convo.id}
            onClick={() => onSelect(convo.id)}
            onContextMenu={(e) => onContextMenu(e, convo)}
            onTouchStart={(e) => handleTouchStart(e, convo)}
            onTouchEnd={handleTouchEnd}
            className={`p-3 cursor-pointer flex items-start space-x-3 relative ${isActive ? 'bg-indigo-600/20 border-l-4 border-indigo-500' : 'hover:bg-slate-700/50'}`}
        >
            {isUnread && <div className="absolute top-2 right-2 w-3 h-3 bg-orange-500 rounded-full"></div>}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                <Icon size={16}/>
            </div>
            <div className="flex-1 min-w-0">
                <p className={`font-semibold truncate text-sm ${isActive ? 'text-white' : 'text-slate-200'}`}>
                    {convo.subject || convo.participants.map(p => p.name).join(', ')}
                </p>
                <p className="text-xs text-slate-400 truncate">
                    {lastMessage?.content || 'Aucun message'}
                </p>
            </div>
        </div>
    );
};


// --- Sous-composant : Liste des Conversations ---
const ConversationList = ({ tickets, discussions, activeConversationId, unreadConversations, onSelect, onNewConversation, onContextMenu, onRefresh }) => {
    const [showClosedTickets, setShowClosedTickets] = useState(false);
    const [showDiscussions, setShowDiscussions] = useState(true);
    const longPressTimer = useRef();

    const handleTouchStart = (e, convo) => {
        longPressTimer.current = setTimeout(() => {
            onContextMenu(e, convo);
        }, 500);
    };
    const handleTouchEnd = () => {
        clearTimeout(longPressTimer.current);
    };

    const closedTickets = tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED');
    const activeTickets = tickets.filter(t => t.status !== 'RESOLVED' && t.status !== 'CLOSED');
    const ticketsToShow = activeTickets.concat(showClosedTickets ? closedTickets : []);

    const renderConvoItem = (convo) => (
        <ConversationItem
            key={convo.id}
            convo={convo}
            activeConversationId={activeConversationId}
            unreadConversations={unreadConversations}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            handleTouchStart={handleTouchStart}
            handleTouchEnd={handleTouchEnd}
        />
    );

    return (
        // On retire les classes de largeur (w-full, md:w-1/3) pour laisser le parent gérer
        <div className="border-r border-slate-700 bg-slate-800 flex flex-col h-full">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center flex-shrink-0">
                <h2 className="text-lg font-semibold text-white">Messagerie</h2>
                <div className="flex items-center gap-2">
                    <button onClick={onRefresh} className="p-1 rounded-full hover:bg-slate-600 text-slate-300 transition-colors" title="Rafraîchir la liste">
                        <RefreshCw size={18} />
                    </button>
                    <button onClick={onNewConversation} className="p-1 rounded-full hover:bg-indigo-600 text-slate-300 transition-colors">
                        <Plus size={20} />
                    </button>
                </div>
            </div>
            <div className="overflow-y-auto flex-1">
                <h3
                    onClick={() => setShowClosedTickets(prev => !prev)}
                    className="flex items-center justify-between px-4 py-2 text-sm font-bold text-orange-400 bg-slate-700 cursor-pointer hover:bg-slate-700/80"
                >
                    Tickets ({activeTickets.length})
                    {showClosedTickets ? <ChevronsUp size={16}/> : <ChevronsDown size={16}/>}
                </h3>
                {ticketsToShow.map(renderConvoItem)}
                <h3
                    onClick={() => setShowDiscussions(prev => !prev)}
                    className="flex items-center justify-between px-4 py-2 text-sm font-bold text-indigo-400 bg-slate-700 cursor-pointer hover:bg-slate-700/80 mt-2"
                >
                    Discussions ({discussions.length})
                    {showDiscussions ? <ChevronsUp size={16}/> : <ChevronsDown size={16}/>}
                </h3>
                {showDiscussions && discussions.map(renderConvoItem)}
            </div>
        </div>
    );
};

// Transforme les tokens de mention en chips rendus
function renderMessageContent(content) {
    if (!content) return null;
    const mentionRegex = /@\[user:(\d+):([^\]]+)\]|@\[rank:(\d+):([^\]]+)\]|@\[everyone\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            parts.push(content.slice(lastIndex, match.index));
        }

        let label;
        if (match[0] === '@[everyone]') {
            label = '@everyone';
        } else if (match[1] != null) {
            label = `@${match[2]}`;
        } else {
            label = `@${match[4]}`;
        }

        parts.push(
            <span
                key={match.index}
                className="bg-indigo-500/20 text-indigo-300 rounded px-1 font-semibold"
            >
                {label}
            </span>
        );
        lastIndex = mentionRegex.lastIndex;
    }

    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
    }

    return parts;
}

// --- Sous-composant : Vue des Messages ---
const MessageView = ({ conversation, messages, onSendMessage, currentUser, onBack }) => {
    const { isAuthenticated } = useAuth();
    const [newMessage, setNewMessage] = useState('');
    const [mentionQuery, setMentionQuery] = useState(null); // null = fermé, string = ouvert
    const [ranks, setRanks] = useState([]);
    const messagesEndRef = React.useRef(null);
    const inputRef = useRef(null);

    // Charger les rangs une fois
    useEffect(() => {
        getRanks().then(setRanks).catch(() => setRanks([]));
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Sélection d'une mention dans le dropdown
    const handleMentionSelect = useCallback((token) => {
        const input = inputRef.current;
        if (!input) return;

        const cursor = input.selectionStart;
        const textBefore = newMessage.slice(0, cursor);
        const textAfter = newMessage.slice(cursor);

        const replaced = textBefore.replace(/@(\w*)$/, token + ' ');
        setNewMessage(replaced + textAfter);
        setMentionQuery(null);

        setTimeout(() => {
            input.focus();
            const pos = replaced.length;
            input.setSelectionRange(pos, pos);
        }, 0);
    }, [newMessage]);

    if (!isAuthenticated) return null;

    const isTicketClosed = conversation && conversation.type === 'TICKET' &&
        (conversation.status === 'RESOLVED' || conversation.status === 'CLOSED');

    // Détecter @ dans l'input
    const handleInputChange = (e) => {
        const value = e.target.value;
        setNewMessage(value);

        const cursor = e.target.selectionStart;
        const textBefore = value.slice(0, cursor);
        const atMatch = textBefore.match(/@(\w*)$/);
        if (atMatch) {
            setMentionQuery(atMatch[1]);
        } else {
            setMentionQuery(null);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newMessage.trim() && !isTicketClosed) {
            onSendMessage(newMessage);
            setNewMessage('');
            setMentionQuery(null);
        }
    };

    if (!conversation) {
        return <div className="flex-1 flex items-center justify-center text-slate-400">Sélectionnez une conversation</div>;
    }

    const participants = conversation.participants || [];

    return (
        <div className="flex-1 flex flex-col bg-slate-900">
            {/* Header */}
            <div className="p-4 border-b border-slate-700 flex items-center">
                <button onClick={onBack} className="md:hidden p-2 -ml-2 mr-2 text-slate-300 hover:bg-slate-700 rounded-full">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h3 className="font-semibold text-white">{conversation.subject || participants.map(p => p.name).join(', ')}</h3>
                    {conversation.type === 'TICKET' && (
                        <p className={`text-xs mt-1 font-medium ${isTicketClosed ? 'text-red-400' : 'text-green-400'}`}>
                            Statut : {conversation.status}
                        </p>
                    )}
                </div>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(msg => {

                    if (msg.type === 'SYSTEM') {
                        return (
                            <div key={msg.id} className="text-center text-xs text-slate-400 italic my-2">
                                {msg.content}
                            </div>
                        );
                    }

                    const isMe = msg.sender.id === currentUser.id;
                    const hasMentions = msg.content && /@\[/.test(msg.content);

                    return (
                        <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {/* Avatar */}
                            <div className={`flex-shrink-0 ${isMe ? 'order-2' : 'order-1'}`}>
                                {msg.sender.profileImageUrl ? (
                                    <img src={msg.sender.profileImageUrl} alt={msg.sender.name} className="w-8 h-8 rounded-full object-cover"/>
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">{msg.sender.name.charAt(0)}</div>
                                )}
                            </div>

                            {/* Bulle de message */}
                            <div className={`max-w-md md:max-w-lg p-3 rounded-lg ${isMe ? 'order-1 bg-indigo-600 text-white' : 'order-2 bg-slate-700 text-slate-200'}`}>
                                <p className="font-semibold text-sm">{msg.sender.name}</p>
                                <div className="text-base prose prose-sm prose-invert max-w-none">
                                    {hasMentions ? (
                                        <p>{renderMessageContent(msg.content)}</p>
                                    ) : (
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    )}
                                </div>
                                <p className={`text-xs mt-1 ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                                    {format(new Date(msg.createdAt), 'd MMM, HH:mm', { locale: fr })}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-700">
                {isTicketClosed ? (
                    <div className="text-center p-3 bg-red-800/20 text-red-400 rounded-lg">
                        <MessageCircle size={16} className="inline mr-2"/>
                        Cet échange est fermé. Vous ne pouvez plus envoyer de message.
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex items-center space-x-2 relative">
                        {mentionQuery !== null && (
                            <MentionDropdown
                                query={mentionQuery}
                                participants={participants}
                                ranks={ranks}
                                onSelect={handleMentionSelect}
                                onClose={() => setMentionQuery(null)}
                            />
                        )}
                        <input
                            ref={inputRef}
                            type="text"
                            value={newMessage}
                            onChange={handleInputChange}
                            placeholder="Écrivez votre message... (@pour mentionner)"
                            className="flex-1 bg-slate-800 border border-slate-600 rounded-full p-2 px-4 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button type="submit" className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Send size={20} />
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};


// --- Composant Principal : ChatWidget ---
const ChatWidget = () => {
    const { user: currentUser, isAuthenticated } = useAuth();

    const {
        isChatOpen, toggleChat, tickets, discussions,
        activeConversationId, activeConversation,
        selectConversation, messages, unreadConversations, refetchConversations
    } = useChat();

    const { send, subscribe, unsubscribe } = useContext(WebSocketContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, conversation: null });

    const { play } = useAudioNotification();
    const activeConversationIdRef = useRef(activeConversationId);
    const isChatOpenRef = useRef(isChatOpen);
    useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
    useEffect(() => { isChatOpenRef.current = isChatOpen; }, [isChatOpen]);

    // Notifications sonores sur nouveaux messages WS
    useEffect(() => {
        if (!subscribe || !unsubscribe) return;

        const handleNewMessage = (payload) => {
            const senderId = payload?.sender?.id ?? payload?.senderId;
            // Ne pas sonner pour ses propres messages
            if (senderId && currentUser && String(senderId) === String(currentUser.id)) return;

            const conversationId = payload?.conversationId;
            const content = payload?.content ?? '';
            const isActiveConvo = conversationId && String(conversationId) === String(activeConversationIdRef.current);
            const chatOpen = isChatOpenRef.current;

            // Détecter mention @[user:ID:...] ou @[everyone]
            const userId = currentUser?.id;
            const isMentioned = userId && (
                content.includes(`@[user:${userId}:`) ||
                content.includes('@[everyone]')
            );

            if (isMentioned) {
                play('mention');
            } else if (!isActiveConvo || !chatOpen) {
                play('message');
            }
        };

        subscribe('NEW_MESSAGE', handleNewMessage);
        return () => unsubscribe('NEW_MESSAGE', handleNewMessage);
    }, [subscribe, unsubscribe, play, currentUser]);

    if (!isAuthenticated) return null;

    const handleSendMessage = (content) => {
        if (!activeConversationId) return;
        send('SEND_MESSAGE', {
            conversationId: activeConversationId,
            content: content,
        });
    };

    const handleContextMenu = (event, conversation) => {
        event.preventDefault();
        setContextMenu({ visible: true, x: event.pageX, y: event.pageY, conversation });
    };

    const handleAction = async (actionPromise, successMessage) => {
        const promise = actionPromise;
        toast.promise(promise, {
            loading: 'Exécution...',
            success: () => {
                refetchConversations();
                return successMessage;
            },
            error: 'Une erreur est survenue.',
        });
    };

    const handleLeaveConversation = (convoId, isSilent) => handleAction(leaveConversation(convoId, isSilent), "Conversation quittée.");
    const handleTakeTicket = (convoId) => handleAction(takeTicket(convoId), "Ticket pris en charge !");
    const handleCloseTicket = (convoId) => handleAction(closeTicket(convoId), "Ticket fermé.");
    const handleMigrateTicket = (convoId, newCategory) => handleAction(migrateTicket(convoId, newCategory.toUpperCase()), "Ticket migré.");
    const handleToggleMute = (convoId) => handleAction(toggleMuteConversation(convoId), "Notifications mises à jour.");

    return (
        <>
            {isModalOpen && <NewConversationModal onClose={() => setIsModalOpen(false)} />}

            {contextMenu.visible && (
                <ChatContextMenu
                    {...contextMenu}
                    onClose={() => setContextMenu({ ...contextMenu, visible: false })}
                    onLeave={handleLeaveConversation}
                    onTakeTicket={handleTakeTicket}
                    onCloseTicket={handleCloseTicket}
                    onMigrateTicket={handleMigrateTicket}
                    onToggleMute={handleToggleMute}
                />
            )}

            {isChatOpen && (
                <div className="fixed inset-0 md:inset-auto md:bottom-4 md:right-4 md:h-[600px] md:w-[700px] md:max-w-[90vw] md:max-h-[80vh] bg-slate-800 rounded-lg shadow-2xl flex flex-col z-50">
                    <div className="flex flex-1 min-h-0">
                        {/* COLONNE DE GAUCHE (LISTE) - C'est ce conteneur qui gère la largeur et l'affichage */}
                        <div className={`
                            flex flex-col w-full 
                            md:w-1/3 md:flex-shrink-0 
                            ${activeConversationId ? 'hidden md:flex' : 'flex'}
                        `}>
                            <ConversationList
                                discussions={discussions}
                                tickets={tickets}
                                activeConversationId={activeConversationId}
                                unreadConversations={unreadConversations}
                                onSelect={selectConversation}
                                onNewConversation={() => setIsModalOpen(true)}
                                onContextMenu={handleContextMenu}
                                onRefresh={refetchConversations}
                            />
                        </div>

                        {/* COLONNE DE DROITE (MESSAGES) - Ce conteneur gère la largeur et l'affichage */}
                        <div className={`
                            flex flex-col w-full min-w-0 
                            md:w-2/3
                            ${activeConversationId ? 'flex' : 'hidden md:flex'}
                        `}>
                            <MessageView
                                conversation={activeConversation}
                                messages={messages}
                                onSendMessage={handleSendMessage}
                                currentUser={currentUser}
                                onBack={() => selectConversation(null)}
                            />
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={toggleChat}
                className="fixed bottom-4 right-4 w-16 h-16 bg-indigo-600 rounded-full text-white flex items-center justify-center shadow-lg z-50 hover:bg-indigo-700 transition-transform hover:scale-110"
            >
                {unreadConversations.size > 0 && !isChatOpen &&
                    <span className="absolute -top-1 -right-1 flex h-5 w-5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-orange-500 items-center justify-center text-xs">{unreadConversations.size}</span>
                    </span>
                }
                {isChatOpen ? <X size={32} /> : <MessageSquare size={32} />}
            </button>
        </>
    );
};

export default ChatWidget;