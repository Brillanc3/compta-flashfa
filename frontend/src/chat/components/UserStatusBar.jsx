import React, { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePresenceStore } from '../store/usePresenceStore';
import StatusPicker from './StatusPicker';

const STATUS_COLORS = {
    ONLINE: 'bg-green-500',
    IDLE: 'bg-yellow-500',
    DND: 'bg-red-500',
    INVISIBLE: 'bg-zinc-500',
    OFFLINE: 'bg-zinc-500',
};

export default function UserStatusBar({ onSetStatus }) {
    const { user } = useAuth();
    const status = usePresenceStore(s => s.presences[user?.id]?.status ?? 'ONLINE');
    const [pickerOpen, setPickerOpen] = useState(false);

    const initials = user?.username?.slice(0, 2).toUpperCase() ?? '??';

    useEffect(() => {
        if (!user?.id || status !== 'OFFLINE') return;
        onSetStatus?.('ONLINE');
        usePresenceStore.getState().updatePresence(user.id, { status: 'ONLINE' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    return (
        <div className="relative flex items-center gap-2 px-2 py-2 border-t border-cca-border bg-cca-surface/80">
            <div
                className="relative cursor-pointer shrink-0"
                onClick={() => setPickerOpen(v => !v)}
            >
                <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center text-xs font-bold text-brand-primary border border-brand-primary/30">
                    {initials}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-cca-surface ${STATUS_COLORS[status]}`} />
            </div>
            {pickerOpen && (
                <StatusPicker
                    currentStatus={status}
                    onSelect={(s) => {
                        onSetStatus?.(s);
                        usePresenceStore.getState().updatePresence(user?.id, { status: s });
                        setPickerOpen(false);
                    }}
                    onClose={() => setPickerOpen(false)}
                />
            )}
            <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-cca-textPrimary truncate">{user?.username ?? 'Moi'}</div>
                <div className="text-[10px] text-cca-textSecondary capitalize">{status?.toLowerCase()}</div>
            </div>
            <button
                className="p-1 rounded hover:bg-cca-base/60 text-cca-textSecondary/60 hover:text-cca-textPrimary transition-colors"
                title="Paramètres"
            >
                <Settings className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
