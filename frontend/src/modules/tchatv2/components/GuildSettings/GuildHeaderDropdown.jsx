import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, Settings, Hash, FolderPlus, Bell, Fingerprint } from 'lucide-react';

export default function GuildHeaderDropdown({
    open,
    onClose,
    guild,
    canInvite,
    canManage,
    onInvite,
    onSettings,
    onCreateChannel,
    onCreateCategory,
    onNotifSettings,
    anchorRef,
}) {
    const dropRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 220 });

    useEffect(() => {
        if (!open) return;

        if (anchorRef?.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 220) });
        }

        const handler = (e) => {
            if (dropRef.current && !dropRef.current.contains(e.target) &&
                anchorRef?.current && !anchorRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open, onClose, anchorRef]);

    if (!open) return null;

    return createPortal(
        <div
            ref={dropRef}
            className="tv2-guild-dropdown"
            style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999 }}
        >
            {canInvite && (
                <button className="tv2-guild-dropdown-item" onClick={() => { onInvite(); onClose(); }}>
                    <UserPlus size={14} /> Inviter sur le serveur
                </button>
            )}
            {canManage && (
                <button className="tv2-guild-dropdown-item" onClick={() => { onSettings(); onClose(); }}>
                    <Settings size={14} /> Paramètres du serveur
                </button>
            )}
            {canManage && <div className="tv2-guild-dropdown-sep" />}
            {canManage && (
                <button className="tv2-guild-dropdown-item" onClick={() => { onCreateChannel(); onClose(); }}>
                    <Hash size={14} /> Créer un salon
                </button>
            )}
            {canManage && (
                <button className="tv2-guild-dropdown-item" onClick={() => { onCreateCategory(); onClose(); }}>
                    <FolderPlus size={14} /> Créer une catégorie
                </button>
            )}
            <div className="tv2-guild-dropdown-sep" />
            <button className="tv2-guild-dropdown-item" onClick={() => { onNotifSettings(); onClose(); }}>
                <Bell size={14} /> Paramètres de notification
            </button>
            <button className="tv2-guild-dropdown-item" onClick={() => {
                navigator.clipboard.writeText(String(guild?.id ?? '')).catch(() => {});
                onClose();
            }}>
                <Fingerprint size={14} /> Copier l'ID
            </button>
        </div>,
        document.body,
    );
}
