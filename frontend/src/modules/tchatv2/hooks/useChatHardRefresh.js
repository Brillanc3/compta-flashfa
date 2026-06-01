import { useEffect, useRef } from 'react';
import {
    fetchUserGuilds,
    fetchChannels,
    fetchMembers,
    refreshUserCache,
} from '../api/client';
import { useGuildStore } from '../stores/guildStore';
import { useChannelStore } from '../stores/channelStore';
import { useMemberStore } from '../stores/memberStore';

/**
 * Intercepte Ctrl+R / Cmd+R sur le tchatv2 : au lieu d'un rechargement complet
 * de la page, vide le localStorage tchatv2 + les caches Redis user-scoped, puis
 * refetch les guildes / channels / membres pour rafraîchir proprement les listes.
 * Shift+Ctrl+R (hard reload navigateur) reste intact.
 */
export function useChatHardRefresh() {
    const refreshingRef = useRef(false);

    useEffect(() => {
        const onKeyDown = (e) => {
            const isReloadCombo =
                (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey &&
                (e.key === 'r' || e.key === 'R');
            if (!isReloadCombo) return;

            e.preventDefault();
            if (refreshingRef.current) return;
            refreshingRef.current = true;

            // 1. Purge localStorage tchatv2
            try {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('tv2:')) localStorage.removeItem(k);
                }
            } catch { /* ignore */ }

            // 2. Purge caches Redis user-scoped puis refetch
            const activeGuildId = useGuildStore.getState().activeGuildId;
            refreshUserCache()
                .catch(() => {})
                .then(() => Promise.all([
                    fetchUserGuilds()
                        .then(gs => useGuildStore.getState().setGuilds(Array.isArray(gs) ? gs : []))
                        .catch(() => {}),
                    activeGuildId
                        ? fetchChannels(activeGuildId)
                            .then(cs => useChannelStore.getState().setChannels(
                                activeGuildId, Array.isArray(cs) ? cs : []))
                            .catch(() => {})
                        : Promise.resolve(),
                    activeGuildId
                        ? fetchMembers(activeGuildId, { channelId: useChannelStore.getState().activeChannelId })
                            .then(ms => useMemberStore.getState().setMembers(
                                activeGuildId, ms ?? []))
                            .catch(() => {})
                        : Promise.resolve(),
                ]))
                .finally(() => { refreshingRef.current = false; });
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
}
