// /frontend/src/pages/NotificationsPage.jsx

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Trash2, CheckCircle2, FileText, AlertTriangle } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import Spinner from '@/components/ui/Spinner';
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import ReactMarkdown from "react-markdown";

/**
 * Page Notifications
 * - Affiche la liste des notifications utilisateur.
 * - Permet de les marquer comme lues ou de les supprimer.
 */
const NotificationsPage = () => {
    const navigate = useNavigate();
    const {
        notifications,
        loading,
        unreadCount,
        acknowledge,
        remove,
    } = useNotifications();

    const sorted = useMemo(() => {
        return [...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [notifications]);

    if (loading) {
        return (
            <div className="h-full flex justify-center items-center">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full text-slate-200">
            {/* HEADER */}
            <header className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Bell className="text-indigo-400" size={22} />
                    Notifications
                </h1>
                {unreadCount > 0 && (
                    <span className="text-sm bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full">
            {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
          </span>
                )}
            </header>

            {/* LISTE */}
            <div className="flex-1 overflow-y-auto space-y-3">
                <AnimatePresence>
                    {sorted.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-center text-slate-500 mt-12"
                        >
                            <Bell size={32} className="mx-auto mb-3 opacity-40" />
                            <p>Aucune notification pour le moment.</p>
                        </motion.div>
                    ) : (
                        sorted.map((notif) => {
                            const { id, title, body, behavior, isAcknowledged, url, createdAt } = notif;
                            const isBlocking = behavior === 'BLOCKING';

                            return (
                                <motion.div
                                    key={id}
                                    layout
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className={`relative border border-slate-700/50 rounded-xl p-4 flex items-start justify-between gap-3 shadow-sm ${
                                        isAcknowledged
                                            ? 'bg-slate-800/50'
                                            : 'bg-slate-800 border-slate-600 shadow-md'
                                    }`}
                                >
                                    <div className="flex-1">
                                        <h2 className="font-semibold text-sm flex items-center gap-2">
                                            {isBlocking ? (
                                                <AlertTriangle className="text-yellow-400 w-4 h-4" />
                                            ) : (
                                                <FileText className="text-indigo-400 w-4 h-4" />
                                            )}
                                            {title}
                                        </h2>
                                        <div className="text-sm text-slate-400 mt-1">
                                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                                {body}
                                            </ReactMarkdown>
                                        </div>

                                        {/* Actions additionnelles (URL) */}
                                        <div className="flex items-center justify-between mt-3">
                                            <span className="text-[10px] text-slate-500">
                                                {new Date(createdAt).toLocaleString('fr-FR')}
                                            </span>
                                            {url && (
                                                <button
                                                    onClick={() => navigate(url)}
                                                    className="px-3 py-1 bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded hover:bg-indigo-500 hover:text-white transition-all"
                                                >
                                                    Voir
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        {!isAcknowledged && (
                                            <button
                                                onClick={() => acknowledge(id)}
                                                className="p-1 rounded-full hover:bg-slate-700/70 transition"
                                                title="Marquer comme lue"
                                            >
                                                <CheckCircle2 className="text-green-400 w-5 h-5" />
                                            </button>
                                        )}
                                        {!isBlocking && (
                                            <button
                                                onClick={() => remove(id)}
                                                className="p-1 rounded-full hover:bg-slate-700/70 transition"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="text-red-400 w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default NotificationsPage;
