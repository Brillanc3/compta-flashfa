// src/contexts/WebSocketContext.jsx
/* eslint-disable react-refresh/only-export-components */
import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useCallback,
    useState,
} from "react";
import { useAuth } from "./AuthContext";

/* =========================
   Discord-like OPCODES
========================= */
export const OPCODES = {
    DISPATCH: 0,
    HEARTBEAT: 1,
    IDENTIFY: 2,
    INVALID_SESSION: 9,
    HELLO: 10,
    HEARTBEAT_ACK: 11,
    RESUME: 6,
};

export const WebSocketContext = createContext(null);

export function useWebSocket() {
    const ctx = useContext(WebSocketContext);
    if (!ctx) {
        throw new Error("useWebSocket must be used inside WebSocketProvider");
    }
    return ctx;
}

export function WebSocketProvider({ children }) {
    const { accessToken, isAuthenticated } = useAuth();

    const socketRef          = useRef(null);
    const heartbeatRef       = useRef(null);   // setInterval pour HEARTBEAT
    const reconnectTimerRef  = useRef(null);   // setTimeout pour reconnexion
    const pendingAckRef      = useRef(false);  // true si on attend un HEARTBEAT_ACK
    const accessTokenRef     = useRef(accessToken);
    const isAuthRef          = useRef(isAuthenticated);

    const sessionIdRef           = useRef(null);
    const reconnectAttemptsRef   = useRef(0);

    const listenersRef = useRef(new Map());
    const [connected, setConnected] = useState(false);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const [status, setStatus] = useState('disconnected'); // 'connected' | 'reconnecting' | 'connecting' | 'disconnected'

    // Maintenir les refs à jour sans déclencher de re-render
    useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);
    useEffect(() => { isAuthRef.current = isAuthenticated; }, [isAuthenticated]);

    /* =========================
       Event system
    ========================= */
    const subscribe = useCallback((event, handler) => {
        if (!listenersRef.current.has(event)) {
            listenersRef.current.set(event, new Set());
        }
        listenersRef.current.get(event).add(handler);
    }, []);

    const unsubscribe = useCallback((event, handler) => {
        const set = listenersRef.current.get(event);
        if (!set) return;
        set.delete(handler);
        if (set.size === 0) listenersRef.current.delete(event);
    }, []);

    const dispatch = useCallback((event, payload) => {
        const set = listenersRef.current.get(event);
        if (!set) return;
        for (const fn of set) {
            try { fn(payload); } catch { /* silencieux */ }
        }
    }, []);

    /* =========================
       Arrêt du heartbeat
    ========================= */
    const stopHeartbeat = useCallback(() => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
        pendingAckRef.current = false;
    }, []);

    /* =========================
       Cleanup (sans reconnexion)
    ========================= */
    const cleanup = useCallback(() => {
        setConnected(false);
        stopHeartbeat();

        const sock = socketRef.current;
        socketRef.current = null;   // on clear d'abord pour éviter les doubles appels

        if (sock) {
            // Supprimer les handlers pour éviter un onclose qui re-schedule
            sock.onopen    = null;
            sock.onclose   = null;
            sock.onerror   = null;
            sock.onmessage = null;
            try { sock.close(); } catch { /* silencieux */ }
        }
    }, [stopHeartbeat]);

    /* =========================
       Reconnect (ref pour éviter
       la dépendance circulaire)
    ========================= */
    const connectRef = useRef(null); // sera rempli plus bas

    const scheduleReconnect = useCallback(() => {
        if (reconnectTimerRef.current) return;
        if (!isAuthRef.current) return;

        const delay = Math.min(30_000, 1_000 * Math.pow(2, reconnectAttemptsRef.current));
        reconnectAttemptsRef.current++;
        setReconnectAttempts(reconnectAttemptsRef.current);
        setStatus('reconnecting');

        reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connectRef.current?.();
        }, delay);
    }, []); // aucune dépendance : utilise les refs

    /* =========================
       Démarrage du heartbeat
    ========================= */
    const startHeartbeat = useCallback((socket, intervalMs) => {
        stopHeartbeat();
        pendingAckRef.current = false;

        heartbeatRef.current = setInterval(() => {
            if (socket.readyState !== WebSocket.OPEN) return;

            if (pendingAckRef.current) {
                // Le serveur n'a pas répondu au dernier HEARTBEAT → connexion morte
                try { socket.close(4001, 'Heartbeat timeout'); } catch { /* silencieux */ }
                return;
            }

            pendingAckRef.current = true;
            try {
                socket.send(JSON.stringify({ op: OPCODES.HEARTBEAT, d: null }));
            } catch { /* silencieux */ }
        }, intervalMs);
    }, [stopHeartbeat]);

    /* =========================
       Connect
    ========================= */
    const connect = useCallback(() => {
        if (!isAuthRef.current || !accessTokenRef.current) return;
        if (socketRef.current) return; // déjà connecté ou en cours

        const url =
            (window.location.protocol === "https:" ? "wss://" : "ws://") +
            window.location.host +
            "/ws/gateway";

        const socket = new WebSocket(url);
        socketRef.current = socket;

        socket.onopen = () => {
            reconnectAttemptsRef.current = 0;
            setReconnectAttempts(0);
            // On attend le HELLO serveur avant d'agir
        };

        socket.onclose = () => {
            // Éviter les logs inutiles — sauf codes critiques
            cleanup();
            if (isAuthRef.current) {
                setStatus('reconnecting');
                scheduleReconnect();
            } else {
                setStatus('disconnected');
            }
        };

        socket.onerror = () => {
            // L'erreur sera suivie d'un onclose — pas de log pour éviter le spam
        };

        socket.onmessage = (event) => {
            let frame;
            try { frame = JSON.parse(event.data); } catch { return; }

            const { op, t, d } = frame;

            switch (op) {
                case OPCODES.HELLO: {
                    const interval = d?.heartbeat_interval ?? 30_000;
                    startHeartbeat(socket, interval);

                    // Tenter un RESUME si on a une session, sinon IDENTIFY
                    if (sessionIdRef.current) {
                        try {
                            socket.send(JSON.stringify({
                                op: OPCODES.RESUME,
                                d: { session_id: sessionIdRef.current },
                            }));
                        } catch { /* silencieux */ }
                    } else {
                        try {
                            socket.send(JSON.stringify({
                                op: OPCODES.IDENTIFY,
                                d: { token: accessTokenRef.current },
                            }));
                        } catch { /* silencieux */ }
                    }
                    break;
                }

                case OPCODES.HEARTBEAT_ACK:
                    pendingAckRef.current = false;
                    break;

                case OPCODES.DISPATCH:
                    if (t === "READY" && d?.session_id) {
                        sessionIdRef.current = d.session_id;
                        setConnected(true);
                        setStatus('connected');
                    } else if (t === "RESUMED") {
                        setConnected(true);
                        setStatus('connected');
                    }
                    dispatch(t, d);
                    break;

                case OPCODES.INVALID_SESSION:
                    // Session invalide : oublier l'ancien session_id et re-IDENTIFY
                    sessionIdRef.current = null;
                    try {
                        socket.send(JSON.stringify({
                            op: OPCODES.IDENTIFY,
                            d: { token: accessTokenRef.current },
                        }));
                    } catch { /* silencieux */ }
                    break;

                default:
                    break;
            }
        };
    }, [cleanup, scheduleReconnect, startHeartbeat, dispatch]);

    // Exposer connect via ref pour scheduleReconnect (évite la dépendance circulaire)
    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

    /* =========================
       Lifecycle
    ========================= */
    useEffect(() => {
        if (isAuthenticated && accessToken) {
            // Annuler tout timer de reconnexion en attente
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            connect();
        } else {
            // Déconnexion volontaire (logout)
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            cleanup();
            sessionIdRef.current = null;
            reconnectAttemptsRef.current = 0;
            setReconnectAttempts(0);
            setStatus('disconnected');
        }

        return () => {
            // Nettoyage au démontage du provider
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            cleanup();
        };
    }, [isAuthenticated, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

    /* =========================
       API exposée
    ========================= */
    const value = {
        connected,
        reconnectAttempts,
        status,

        subscribe,
        unsubscribe,

        // Compatibilité legacy
        on: (event, handler) => {
            subscribe(event, handler);
            return () => unsubscribe(event, handler);
        },
        off: (event, handler) => {
            unsubscribe(event, handler);
        },

        send: (op, d, t) => {
            const s = socketRef.current;
            if (!s || s.readyState !== WebSocket.OPEN) return;
            try { s.send(JSON.stringify({ op, d, t })); } catch { /* silencieux */ }
        },
    };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
}
