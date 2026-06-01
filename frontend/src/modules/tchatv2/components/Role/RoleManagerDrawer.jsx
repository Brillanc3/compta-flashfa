import React from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, X } from 'lucide-react';
import RoleManager from './RoleManager';

export default function RoleManagerDrawer({ open, onClose, guildId }) {
    if (!open) return null;
    return createPortal(
        <div className="tv2-drawer">
            <div className="tv2-drawer-head">
                <ShieldAlert size={16} />
                <div className="tv2-drawer-title">Rôles</div>
                <button className="tv2-icon-btn" onClick={onClose}><X size={16} /></button>
            </div>
            <RoleManager guildId={guildId} variant="drawer" />
        </div>,
        document.body
    );
}
