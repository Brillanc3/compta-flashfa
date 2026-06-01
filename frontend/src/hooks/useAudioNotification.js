import { useCallback, useEffect, useRef, useState } from 'react';
import { playNotification, unlockAudio } from '@/services/audioNotificationService';

const MUTE_KEY = 'audio_notifications_muted';
const PREFS_KEY = 'audio_notifications_prefs';
const MUTED_SCOPES_KEY = 'chat:muted_scopes';

const DEFAULT_PREFS = {
    messages: true,
    mention_everyone: true,
    mention_user: true,
    mention_rank: true,
};

function loadPrefs() {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
    } catch {
        return { ...DEFAULT_PREFS };
    }
}

function loadMutedScopes() {
    try {
        const raw = localStorage.getItem(MUTED_SCOPES_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

function saveMutedScopes(set) {
    localStorage.setItem(MUTED_SCOPES_KEY, JSON.stringify([...set]));
}

export function useAudioNotification() {
    const mutedRef = useRef(
        typeof window !== 'undefined' && localStorage.getItem(MUTE_KEY) === 'true'
    );
    const [muted, setMutedState] = useState(mutedRef.current);
    const [prefs, setPrefsState] = useState(loadPrefs);
    const prefsRef = useRef(prefs);

    const mutedScopesRef = useRef(loadMutedScopes());
    const [mutedScopes, setMutedScopesState] = useState(mutedScopesRef.current);

    useEffect(() => {
        const handler = () => unlockAudio();
        window.addEventListener('click', handler, { once: true });
        window.addEventListener('keydown', handler, { once: true });
        return () => {
            window.removeEventListener('click', handler);
            window.removeEventListener('keydown', handler);
        };
    }, []);

    useEffect(() => {
        const handler = (e) => {
            if (e.data?.type === 'AUDIO_NOTIFICATION') {
                playNotification(e.data.notifType);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    // type: 'message' | 'mention_everyone' | 'mention_user' | 'mention_rank'
    // scopeIds: array of IDs to check against muted scopes (channelId, categoryId)
    const play = useCallback((type = 'message', scopeIds = []) => {
        if (mutedRef.current) return;
        if (scopeIds.some(id => id != null && mutedScopesRef.current.has(String(id)))) return;
        const p = prefsRef.current;
        if (type === 'mention_everyone' && !p.mention_everyone) return;
        if (type === 'mention_user' && !p.mention_user) return;
        if (type === 'mention_rank' && !p.mention_rank) return;
        if (type === 'message' && !p.messages) return;
        const audioType = type === 'message' ? 'message' : 'mention';
        playNotification(audioType);
    }, []);

    const setMuted = useCallback((val) => {
        mutedRef.current = val;
        setMutedState(val);
        localStorage.setItem(MUTE_KEY, String(val));
    }, []);

    const setPref = useCallback((key, val) => {
        setPrefsState(prev => {
            const next = { ...prev, [key]: val };
            prefsRef.current = next;
            localStorage.setItem(PREFS_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const muteScope = useCallback((id) => {
        const next = new Set(mutedScopesRef.current);
        next.add(String(id));
        mutedScopesRef.current = next;
        setMutedScopesState(new Set(next));
        saveMutedScopes(next);
    }, []);

    const unmuteScope = useCallback((id) => {
        const next = new Set(mutedScopesRef.current);
        next.delete(String(id));
        mutedScopesRef.current = next;
        setMutedScopesState(new Set(next));
        saveMutedScopes(next);
    }, []);

    const isScopeMuted = useCallback((id) => {
        return mutedScopesRef.current.has(String(id));
    }, []);

    const isMuted = () => mutedRef.current;

    return { play, setMuted, isMuted, muted, prefs, setPref, muteScope, unmuteScope, isScopeMuted, mutedScopes };
}
