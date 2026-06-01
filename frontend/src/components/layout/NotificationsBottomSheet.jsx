// /frontend/src/components/layout/NotificationsBottomSheet.jsx

import React, { useEffect } from "react";
import { motion, AnimatePresence  } from 'framer-motion';
import { Bell, X, Trash2, CheckCircle2, FileText, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/contexts/NotificationContext";
import Spinner from "@/components/ui/Spinner";

/**
 * Bottom Sheet de notifications (mobile / PWA)
 * S'ouvre en overlay depuis la barre de navigation.
 *
 * IMPORTANT:
 * - Le NotificationContext normalise les notifications au format:
 *   { id, notificationId, title, body, createdAt, behavior, isAcknowledged, ... }
 * - Ce composant doit donc consommer ce format (et non NotificationRecipient brut).
 */
const NotificationsBottomSheet = ({ isOpen, onClose }) => {
    const { notifications, loading, unreadCount, acknowledge, remove } = useNotifications();
    const navigate = useNavigate();

    // Empêche le scroll du body quand la sheet est ouverte
    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    const sorted = Array.isArray(notifications)
        ? [...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        : [];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay sombre */}
                    <motion.div
                        key="overlay"
                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[80]"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                    />

                    {/* Drawer principal */}
                    <motion.div
                        key="sheet"
                        className="fixed bottom-0 left-0 right-0 z-[90] bg-cca-base/95 backdrop-blur-xl text-cca-textPrimary rounded-t-2xl border-t border-cca-border shadow-2xl max-h-[75vh] overflow-hidden"
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", stiffness: 260, damping: 26 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-cca-border">
                            <div className="flex items-center gap-2">
                                <Bell className="text-brand-primary" size={20} />
                                <h2 className="text-lg font-semibold">Notifications</h2>
                                {unreadCount > 0 && (
                                    <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-200 border border-red-500/30">
                                        {unreadCount}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                aria-label="Fermer"
                                className="p-1.5 rounded-md hover:bg-cca-surface/50 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Contenu */}
                        <div className="overflow-y-auto max-h-[65vh] px-4 pb-6">
                            {loading ? (
                                <div className="flex justify-center items-center py-10">
                                    <Spinner />
                                </div>
                            ) : sorted.length === 0 ? (
                                <div className="text-center text-cca-textSecondary py-10">
                                    <Bell size={32} className="mx-auto mb-3 opacity-40" />
                                    <p>Aucune notification.</p>
                                </div>
                            ) : (
                                <ul className="space-y-3 pt-2">
                                    {sorted.map((n) => {
                                        const title = n?.title || "Notification";
                                        const body = n?.body || "";
                                        const behavior = n?.behavior || "PERMANENT";
                                        const isBlocking = behavior === "BLOCKING";
                                        const recipientId = n?.id;

                                        return (
                                            <motion.li
                                                key={String(recipientId)}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className={`relative border border-cca-border rounded-xl p-4 shadow-sm ${
                                                    n?.isAcknowledged
                                                        ? "bg-cca-surface/40"
                                                        : "bg-cca-surface/60 border-cca-border/80"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {isBlocking ? (
                                                                <AlertTriangle className="text-yellow-400 w-4 h-4" />
                                                            ) : (
                                                                <FileText className="text-brand-primary w-4 h-4" />
                                                            )}
                                                            <h3 className="font-semibold text-sm truncate">{title}</h3>
                                                        </div>

                                                        {!!body && (
                                                            <p className="text-sm text-cca-textSecondary whitespace-pre-wrap break-words">
                                                                {body}
                                                            </p>
                                                        )}

                                                        <div className="mt-2 flex items-center justify-between">
                                                            <div className="text-[11px] text-cca-textSecondary/80">
                                                                {n?.createdAt ? new Date(n.createdAt).toLocaleString("fr-FR") : ""}
                                                            </div>
                                                            {n.url && (
                                                                <button
                                                                    onClick={() => {
                                                                        navigate(n.url);
                                                                        onClose();
                                                                    }}
                                                                    className="px-3 py-1 bg-brand-primary/20 text-brand-primary text-xs font-bold rounded-md hover:bg-brand-primary hover:text-white transition-all"
                                                                >
                                                                    Voir
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-center justify-center gap-2 ml-3">
                                                        {!n?.isAcknowledged && (
                                                            <button
                                                                onClick={() => acknowledge(recipientId)}
                                                                className="p-1.5 rounded-full hover:bg-slate-700 transition"
                                                                title="Marquer comme lue"
                                                            >
                                                                <CheckCircle2 className="text-green-400 w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {!isBlocking && (
                                                            <button
                                                                onClick={() => remove(recipientId)}
                                                                className="p-1.5 rounded-full hover:bg-cca-surface/50 transition"
                                                                title="Supprimer"
                                                            >
                                                                <Trash2 className="text-red-400 w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default NotificationsBottomSheet;
