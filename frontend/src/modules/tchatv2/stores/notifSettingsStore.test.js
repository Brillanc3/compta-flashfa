import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNotifSettingsStore } from './notifSettingsStore';

vi.mock('../api/client', () => ({
    getNotifSettings:     vi.fn(),
    setNotifSettings:     vi.fn(),
    listGuildNotifSettings: vi.fn(),
}));

import * as api from '../api/client';

describe('notifSettingsStore', () => {
    beforeEach(() => {
        useNotifSettingsStore.setState({ byChannel: {} });
        api.getNotifSettings.mockReset();
        api.setNotifSettings.mockReset();
        api.listGuildNotifSettings.mockReset();
    });

    it('returns default settings when nothing loaded', () => {
        const s = useNotifSettingsStore.getState().getSettings('123');
        expect(s).toEqual({ level: 0, mutedUntil: null, isMuted: false });
    });

    it('loads settings via API and caches them', async () => {
        api.getNotifSettings.mockResolvedValue({ level: 2, mutedUntil: null, isMuted: false });
        await useNotifSettingsStore.getState().load('g1', '123');
        const s = useNotifSettingsStore.getState().getSettings('123');
        expect(s.level).toBe(2);
        expect(api.getNotifSettings).toHaveBeenCalledTimes(1);
    });

    it('isMuted=false when mutedUntil in past', () => {
        useNotifSettingsStore.setState({
            byChannel: { '999': { level: 1, mutedUntil: new Date(Date.now() - 1000).toISOString() } },
        });
        const s = useNotifSettingsStore.getState().getSettings('999');
        expect(s.isMuted).toBe(false);
    });

    it('isMuted=true when mutedUntil in future', () => {
        useNotifSettingsStore.setState({
            byChannel: { '888': { level: 1, mutedUntil: new Date(Date.now() + 3600_000).toISOString() } },
        });
        const s = useNotifSettingsStore.getState().getSettings('888');
        expect(s.isMuted).toBe(true);
    });
});
