// src/hooks/useWebSocketListener.js

import { useEffect } from "react";
import { useWebSocket as useWebSocketContext } from "../contexts/WebSocketContext";

/**
 * Hook pour s'abonner à un événement WebSocket spécifique.
 * 
 * @param {string} event - Nom de l'événement (ex: 'PERMISSIONS_UPDATED')
 * @param {function} callback - Handler appelé à la réception
 */
export default function useWebSocketListener(event, callback) {
    const { on } = useWebSocketContext();

    useEffect(() => {
        if (!event || !callback || !on) return;

        // Abonnement via le context
        const unsubscribe = on(event, callback);

        // Nettoyage automatique au démontage ou changement de dépendances
        return () => {
            if (typeof unsubscribe === "function") {
                unsubscribe();
            }
        };
    }, [event, callback, on]);
}
