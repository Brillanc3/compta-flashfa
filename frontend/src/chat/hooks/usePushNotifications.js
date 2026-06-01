import { useEffect } from 'react';
import apiClient from '@/services/api';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

function isInIframe() {
    try { return window.self !== window.top; } catch { return true; }
}

async function registerPushViaPopup(apiBase) {
    const vapidKey = encodeURIComponent(VAPID_PUBLIC_KEY || '');
    const api = encodeURIComponent(apiBase || '');
    const popup = window.open(
        `${window.location.origin}/push-subscribe.html?vapidKey=${vapidKey}&api=${api}`,
        'push-subscribe',
        'width=500,height=400,toolbar=0,menubar=0'
    );
    if (!popup) {
        console.warn('[push] popup blocked by browser');
        return;
    }
    const onMessage = (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'PUSH_SUBSCRIBED') {
            window.removeEventListener('message', onMessage);
        }
    };
    window.addEventListener('message', onMessage);
    setTimeout(() => window.removeEventListener('message', onMessage), 60_000);
}

async function registerPush(apiBase) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    // CEF FiveM (Chrome 103) n'expose pas l'API Notification → référence nue =
    // ReferenceError. On vérifie l'existence avant tout accès.
    if (typeof Notification === 'undefined') return;
    if (!VAPID_PUBLIC_KEY) return;

    if (isInIframe()) {
        return registerPushViaPopup(apiBase);
    }

    const permission = Notification.permission;
    if (permission === 'denied') return;

    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Demander permission si pas encore accordée
    if (permission !== 'granted') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') return;
    }

    const existing = await reg.pushManager.getSubscription();
    if (existing) {
        // Déjà souscrit — enregistrer quand même pour mettre à jour lastUsedAt
        await postSubscription(apiBase, existing);
        return;
    }

    const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await postSubscription(apiBase, sub);
}

// Guard au niveau module : dédoublonne les montages concurrents (React StrictMode
// en dev double-monte l'effet → sinon 2 subscribe() en course = 2 endpoints).
let _registerPromise = null;
function registerPushOnce(apiBase) {
    if (!_registerPromise) {
        _registerPromise = registerPush(apiBase).catch(err => {
            _registerPromise = null; // permet un nouvel essai après échec
            throw err;
        });
    }
    return _registerPromise;
}

async function postSubscription(_apiBase, sub) {
    const json = sub.toJSON();
    // apiClient (axios) injecte le header Authorization: Bearer + gère le refresh.
    // baseURL = '/api' → chemin relatif sans préfixe.
    await apiClient.post('/tchatv2/push/subscribe', {
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        deviceType: 'web',
    });
}

/**
 * Enregistre le service worker et souscrit aux push notifications VAPID.
 * Ne fait rien si VITE_VAPID_PUBLIC_KEY est absent ou si le navigateur ne supporte pas l'API.
 *
 * @param {string} apiBase - Base URL de l'API (ex: '/api')
 */
export function usePushNotifications(apiBase = '/api') {
    useEffect(() => {
        // API Notification absente (CEF FiveM / Chrome 103) → ne rien faire
        if (typeof Notification === 'undefined') return;

        // Enregistrer seulement si permission déjà accordée ou demandable
        if (Notification.permission !== 'denied') {
            registerPushOnce(apiBase).catch(err => console.error('[push] registerPush échec:', err));
        }
    }, [apiBase]);
}
