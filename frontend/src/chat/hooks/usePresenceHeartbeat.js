import { useEffect, useRef, useCallback } from 'react';
import apiClient from '@/services/api';

const HEARTBEAT_INTERVAL = 30_000; // 30s
const IDLE_TIMEOUT = 5 * 60_000;  // 5min

export function usePresenceHeartbeat(companyId, onStatusChange) {
    const lastActivityRef = useRef(Date.now());
    const currentStatusRef = useRef('ONLINE');

    const sendHeartbeat = useCallback(async () => {
        if (!companyId) return;
        try {
            await apiClient.post('/chat/presence/heartbeat', {});
        } catch { /* empty */ }
    }, [companyId]);

    const checkIdle = useCallback(async () => {
        if (!companyId) return;
        const idle = Date.now() - lastActivityRef.current > IDLE_TIMEOUT;
        const target = idle ? 'IDLE' : 'ONLINE';
        if (currentStatusRef.current === 'DND' || currentStatusRef.current === 'INVISIBLE') return;
        if (target !== currentStatusRef.current) {
            currentStatusRef.current = target;
            try {
                await apiClient.put('/chat/presence', { status: target });
                onStatusChange?.(target);
            } catch { /* empty */ }
        }
    }, [companyId, onStatusChange]);

    useEffect(() => {
        const onActivity = () => { lastActivityRef.current = Date.now(); };
        window.addEventListener('mousemove', onActivity, { passive: true });
        window.addEventListener('keydown', onActivity, { passive: true });
        window.addEventListener('click', onActivity, { passive: true });
        return () => {
            window.removeEventListener('mousemove', onActivity);
            window.removeEventListener('keydown', onActivity);
            window.removeEventListener('click', onActivity);
        };
    }, []);

    useEffect(() => {
        if (!companyId) return;
        sendHeartbeat();
        const hb = setInterval(() => {
            sendHeartbeat();
            checkIdle();
        }, HEARTBEAT_INTERVAL);
        return () => clearInterval(hb);
    }, [companyId, sendHeartbeat, checkIdle]);

    const setStatus = useCallback(async (status, customEmoji, customText) => {
        if (!companyId) return;
        currentStatusRef.current = status;
        try {
            await apiClient.put('/chat/presence', { status, customEmoji, customText });
            onStatusChange?.(status);
        } catch { /* empty */ }
    }, [companyId, onStatusChange]);

    return { setStatus };
}
