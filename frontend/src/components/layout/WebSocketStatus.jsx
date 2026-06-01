import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Wifi, WifiOff, Loader2, CheckCircle2 } from 'lucide-react';
import { useWebSocket } from '@/contexts/WebSocketContext';

const WebSocketStatus = () => {
    const { status, reconnectAttempts } = useWebSocket();
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (status === 'connected') {
            setShowSuccess(true);
            const timer = setTimeout(() => setShowSuccess(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    const isVisible = status === 'reconnecting' || status === 'disconnected' || showSuccess;

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20, x: '-50%' }}
                animate={{ opacity: 1, y: 20, x: '-50%' }}
                exit={{ opacity: 0, y: -20, x: '-50%' }}
                className="fixed top-0 left-1/2 z-[9999] pointer-events-none"
            >
                <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-cca-surface/80 backdrop-blur-xl border border-cca-border shadow-2xl">
                    {status === 'reconnecting' && (
                        <>
                            <div className="relative">
                                <WifiOff size={18} className="text-amber-500" />
                                <Loader2 size={24} className="absolute -top-[3px] -left-[3px] text-amber-500 animate-spin opacity-50" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-cca-textPrimary">
                                    Reconnexion en cours...
                                </span>
                                <span className="text-[10px] text-cca-textSecondary">
                                    Tentative {reconnectAttempts}
                                </span>
                            </div>
                        </>
                    )}

                    {status === 'disconnected' && (
                        <>
                            <WifiOff size={18} className="text-red-500" />
                            <span className="text-xs font-bold text-cca-textPrimary">
                                WebSocket déconnecté
                            </span>
                        </>
                    )}

                    {showSuccess && status === 'connected' && (
                        <>
                            <CheckCircle2 size={18} className="text-emerald-500" />
                            <span className="text-xs font-bold text-cca-textPrimary">
                                Connexion rétablie
                            </span>
                        </>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default WebSocketStatus;
