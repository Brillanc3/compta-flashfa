import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import ReactMarkdown from "react-markdown";
/* -------------------------------------------------------------------------- */
/* PANEL                                                                       */
/* -------------------------------------------------------------------------- */

const NotificationPanel = ({ notifications, onRemove, onAcknowledge, onNavigate }) => {
    if (!notifications || notifications.length === 0) {
        return (
            <div className="p-4 text-sm text-cca-textSecondary/60 underline">
                Aucune nouvelle notification.
            </div>
        );
    }

    return (
        <ul className="divide-y divide-cca-border/50">
            {notifications.slice(0, 10).map((n) => (
                <li key={n.id} className="p-3">
                    <div className="font-bold text-cca-textPrimary">
                        {n.title}
                    </div>

                    <div className="text-sm text-cca-textSecondary whitespace-pre-line leading-relaxed">
                        <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                                p: ({node: _node, ...props}) => <div {...props} className="mb-2 last:mb-0" />,
                            }}
                        >
                            {n.body}
                        </ReactMarkdown>
                    </div>

                    <div className="text-xs text-cca-textSecondary/40 mt-2 font-mono">
                        {format(new Date(n.createdAt), 'd MMM yyyy à HH:mm', {
                            locale: fr,
                        })}
                    </div>

                    <div className="flex gap-3 mt-3 items-center">
                        {!n.isAcknowledged && (
                            <button
                                onClick={() => onAcknowledge(n.id)}
                                className="text-xs text-indigo-400 hover:underline"
                            >
                                Marquer comme lu
                            </button>
                        )}

                        <button
                            onClick={() => onRemove(n.id)}
                            className="text-xs text-red-400 hover:underline"
                        >
                            Supprimer
                        </button>

                        {n.url && (
                            <button
                                onClick={() => onNavigate(n.url)}
                                className="ml-auto text-xs font-bold bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded hover:bg-brand-primary hover:text-white transition-all"
                            >
                                Voir
                            </button>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
};


/* -------------------------------------------------------------------------- */
/* BELL                                                                        */
/* -------------------------------------------------------------------------- */

const NotificationBell = () => {
    const navigate = useNavigate();
    const { notifications, unreadCount, remove, acknowledge } =
        useNotifications();

    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const bellRef = useRef(null);

    /* ---------------------- CLICK OUTSIDE ---------------------- */

    useEffect(() => {
        function handleClickOutside(event) {
            if (
                bellRef.current &&
                !bellRef.current.contains(event.target)
            ) {
                setIsPanelOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const portalTarget = document.getElementById('notification-portal');

    const handleNavigate = (url) => {
        navigate(url);
        setIsPanelOpen(false);
    };

    return (
        <>
            {/* BELL ICON */}
            <div ref={bellRef} className="relative">
                <button
                    onClick={() => setIsPanelOpen((prev) => !prev)}
                    className="relative p-2 text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface/40 rounded-full transition-all"
                >
                    <NotificationsIcon />

                    {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-slate-800" />
                    )}
                </button>
            </div>

            {/* PANEL (PORTAL) */}
            {isPanelOpen &&
                portalTarget &&
                createPortal(
                    <div
                        /* IMPORTANT : empêche le click outside */
                        onMouseDown={(e) => e.stopPropagation()}
                        className="
                            fixed
                            top-[70px]
                            left-[90px]
                            w-80
                            bg-cca-surface/90
                            backdrop-blur-xl
                            border border-cca-border
                            rounded-2xl
                            shadow-2xl
                            z-[99999]
                            overflow-hidden
                        "
                    >
                        <div className="p-3 border-b border-cca-border/50">
                            <h3 className="font-bold text-[10px] uppercase tracking-widest text-cca-textSecondary/60">
                                Notifications
                            </h3>
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            <NotificationPanel
                                notifications={notifications}
                                onRemove={remove}
                                onAcknowledge={acknowledge}
                                onNavigate={handleNavigate}
                            />
                        </div>
                    </div>,
                    portalTarget
                )}
        </>
    );
};

export default NotificationBell;
