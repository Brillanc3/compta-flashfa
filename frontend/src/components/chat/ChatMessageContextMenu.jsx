// /frontend/src/components/chat/ChatMessageContextMenu.jsx
import React from 'react';
import { Flag, Copy, Reply } from 'lucide-react'; // Import icons for actions
import { useAuth } from '@/contexts/AuthContext'; // To check if the user is the sender

const ChatMessageContextMenu = ({ x, y, message, onClose, onReport /*, onCopy, onReply */ }) => {
    const { user } = useAuth();

    // Do not show menu for system/ephemeral messages or if message is missing
    if (!message || message.type === 'SYSTEM' || message.isEphemeral) return null;

    const isMyMessage = message.sender?.id === user?.id;

    const menuStyle = {
        top: `${y}px`,
        left: `${x}px`,
        position: 'absolute',
        zIndex: 1000,
    };

    const handleAction = (actionFn, ...args) => {
        if (actionFn) {
            actionFn(...args); // Pass the message object or required args
        }
        onClose(); // Close the menu after any action
    };

    return (
        // Added onClick stopPropagation to prevent closing when clicking inside the menu
        <div style={menuStyle} onClick={(e) => e.stopPropagation()} className="bg-slate-800 border border-slate-700 rounded-md shadow-lg p-1 min-w-[150px]">
            {/* --- Option Signaler (toujours visible pour les messages des autres) --- */}
            {!isMyMessage && onReport && (
                <button
                    onClick={() => handleAction(onReport, message)}
                    className="w-full text-left flex items-center px-3 py-1.5 text-sm hover:bg-slate-700 rounded-md text-red-400"
                >
                    <Flag size={14} className="mr-2"/>Signaler le message
                </button>
            )}

            {/* --- Option Copier (simplifié) --- */}
            {/* TODO: Implement actual copy logic */}
            {message.type === 'USER' && ( // Only allow copying user text messages for now
                <button
                    onClick={() => { navigator.clipboard.writeText(message.content); onClose(); }} // Simple copy
                    className="w-full text-left flex items-center px-3 py-1.5 text-sm hover:bg-slate-700 rounded-md text-slate-200"
                >
                    <Copy size={14} className="mr-2"/>Copier le texte
                </button>
            )}

            {/* --- Option Répondre (placeholder) --- */}
            {/* TODO: Implement reply functionality */}
            {/* <button
                onClick={() => handleAction(onReply, message)}
                className="w-full text-left flex items-center px-3 py-1.5 text-sm hover:bg-slate-700 rounded-md text-slate-200"
            >
                <Reply size={14} className="mr-2"/>Répondre
            </button> */}

            {/* TODO: Add Delete option if isMyMessage */}

        </div>
    );
};

export default ChatMessageContextMenu;