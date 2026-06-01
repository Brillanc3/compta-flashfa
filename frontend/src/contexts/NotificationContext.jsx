/* eslint-disable react-refresh/only-export-components */
import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
} from "react";

import { useAuth } from "./AuthContext";
import { useWebSocket } from "./WebSocketContext";
import {
    getUserNotifications,
    acknowledgeNotification,
    deleteNotification,
} from "../services/notificationService";
import toast from "react-hot-toast";

import BlockingNotificationModal from "../components/layout/BlockingNotificationModal";

/* -------------------------------------------------------------------------- */
/* CONTEXT                                                                    */
/* -------------------------------------------------------------------------- */

const NotificationContext = createContext(null);

export function useNotifications() {
    return useContext(NotificationContext);
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Normalise une notification backend (NotificationRecipient)
 * vers le format canonique frontend.
 */
function normalizeNotification(recipient) {
    let parsedContent = { title: "Notification", body: "" };

    try {
        if (typeof recipient.notification?.content === "string") {
            parsedContent = JSON.parse(recipient.notification.content);
        } else if (recipient.notification?.content) {
            parsedContent = recipient.notification.content;
        }
    } catch (err) {
        console.error("[Notification] Invalid JSON content", err);
    }

    return {
        id: recipient.id, // NotificationRecipient.id
        notificationId: recipient.notification.id,
        title: parsedContent.title || "Notification",
        body: parsedContent.body || "",
        createdAt: recipient.notification.createdAt, // ✅ NE PAS TOUCHER
        behavior: recipient.notification.behavior,
        isAcknowledged: recipient.isAcknowledged,

        // Extensions (BlockingNotificationModal.jsx)
        formFields: Array.isArray(parsedContent.formFields) ? parsedContent.formFields : [],
        submitEndpoint: parsedContent.submitEndpoint,
        submitMethod: parsedContent.submitMethod,
        assignedContractId: parsedContent.assignedContractId,
        url: parsedContent.url,
    };
}

/* -------------------------------------------------------------------------- */
/* PROVIDER                                                                   */
/* -------------------------------------------------------------------------- */

export function NotificationProvider({ children }) {
    const { user, isAuthenticated } = useAuth();
    const { subscribe, unsubscribe } = useWebSocket();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    /* ======================================================================
       FETCH INITIAL (REST)
    ====================================================================== */

    const fetchNotifications = useCallback(async () => {
        if (!isAuthenticated) {
            setNotifications([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await getUserNotifications();

            const normalized = Array.isArray(data)
                ? data.map(normalizeNotification)
                : [];

            setNotifications(normalized);
        } catch (err) {
            console.error("[Notification] Fetch error", err);
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    /* ======================================================================
       LIVE WEBSOCKET — NOTIFICATION_CREATED
       → injection directe, FORMAT IDENTIQUE
    ====================================================================== */

    useEffect(() => {
        if (!user) return;

        const onNotificationCreated = (payload) => {
            try {
                if (!payload?.notificationId) return;

                const recipientId = payload.recipientId;

                // Si c'est une notif bloquante et qu'on n'a pas reçu le recipientId en temps réel, 
                // on force un refresh pour être sûr de pouvoir l'acknowledge.
                if (!recipientId && payload.behavior === "BLOCKING") {
                    console.warn("[Notification] Received blocking notification without recipientId, refetching...");
                    fetchNotifications();
                }

                // --- TOAST GLOBAL ---
                const title = payload.content?.title || "Notification";
                const body = payload.content?.body || "";
                
                toast.success((t) => (
                    <div onClick={() => toast.dismiss(t.id)} className="cursor-pointer">
                        <div className="font-bold">{title}</div>
                        {body && <div className="text-xs opacity-80">{body}</div>}
                    </div>
                ), { duration: 4000 });
                // --- FIN TOAST ---

                setNotifications((prev) => {
                    if (
                        prev.some(
                            (n) => n.notificationId === payload.notificationId
                        )
                    ) {
                        return prev;
                    }

                    return [
                        {
                            id: recipientId ?? `ws-${payload.notificationId}`,
                            notificationId: payload.notificationId,
                            title: payload.content?.title || "Notification",
                            body: payload.content?.body || "",
                            createdAt: payload.createdAt || new Date().toISOString(),
                            behavior: payload.behavior,
                            isAcknowledged: false,

                            // Extensions (BlockingNotificationModal.jsx)
                            formFields: Array.isArray(payload.content?.formFields)
                                ? payload.content.formFields
                                : [],
                            submitEndpoint: payload.content?.submitEndpoint,
                            submitMethod: payload.content?.submitMethod,
                            assignedContractId: payload.content?.assignedContractId,
                            url: payload.content?.url,
                        },
                        ...prev,
                    ];
                });
            } catch (err) {
                console.error("[Notification][WS] handler error:", err);
            }
        };

        subscribe("NOTIFICATION_CREATED", onNotificationCreated);
        return () =>
            unsubscribe("NOTIFICATION_CREATED", onNotificationCreated);
    }, [user, subscribe, unsubscribe, fetchNotifications]);

    /* ======================================================================
       ACTIONS
    ====================================================================== */

    const acknowledge = async (recipientId) => {
        await acknowledgeNotification(recipientId);

        setNotifications((prev) =>
            prev.map((n) =>
                n.id === recipientId
                    ? { ...n, isAcknowledged: true }
                    : n
            )
        );
    };

    const remove = async (recipientId) => {
        await deleteNotification(recipientId);

        setNotifications((prev) =>
            prev.filter((n) => n.id !== recipientId)
        );
    };

    const unreadCount = notifications.filter(
        (n) => !n.isAcknowledged
    ).length;

    /* ======================================================================
       🔒 BLOCKING NOTIFICATION (GLOBAL)
    ====================================================================== */

    const blockingNotification = useMemo(() => {
        return (
            notifications
                .filter(
                    (n) =>
                        !n.isAcknowledged &&
                        n.behavior === "BLOCKING"
                )
                .sort(
                    (a, b) =>
                        new Date(a.createdAt) -
                        new Date(b.createdAt)
                )[0] || null
        );
    }, [notifications]);

    /* ======================================================================
       CONTEXT VALUE
    ====================================================================== */

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                loading,
                unreadCount,
                acknowledge,
                remove,
                refetch: fetchNotifications,
                blockingNotification,
            }}
        >
            {children}

            {/* 🔒 MODAL GLOBAL PERMANENT */}
            {blockingNotification && <BlockingNotificationModal />}
        </NotificationContext.Provider>
    );
}
