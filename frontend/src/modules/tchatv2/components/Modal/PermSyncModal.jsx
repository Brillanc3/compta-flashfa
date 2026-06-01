import React, { useState } from 'react';
import Modal from './Modal';

export default function PermSyncModal({ open, onClose, channelName, categoryName, onSync, onKeep }) {
    const [pending, setPending] = useState(null); // null, 'cancel', 'keep', 'sync'

    const handleCancel = () => {
        onClose?.();
    };

    const handleKeep = async () => {
        setPending('keep');
        try {
            await onKeep?.();
            onClose?.();
        } finally {
            setPending(null);
        }
    };

    const handleSync = async () => {
        setPending('sync');
        try {
            await onSync?.();
            onClose?.();
        } finally {
            setPending(null);
        }
    };

    const isDisabled = pending !== null;

    return (
        <Modal
            open={open}
            onClose={onClose}
            danger={false}
            title="Permissions différentes"
            footer={
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        className="tv2-btn-ghost"
                        onClick={handleCancel}
                        disabled={isDisabled}
                    >
                        Annuler le déplacement
                    </button>
                    <button
                        type="button"
                        className="tv2-btn-ghost"
                        onClick={handleKeep}
                        disabled={isDisabled}
                    >
                        {pending === 'keep' ? '…' : 'Garder les permissions du salon'}
                    </button>
                    <button
                        type="button"
                        className="tv2-btn-solid"
                        onClick={handleSync}
                        disabled={isDisabled}
                    >
                        {pending === 'sync' ? '…' : 'Synchroniser avec la catégorie'}
                    </button>
                </div>
            }
        >
            <div className="tv2-modal-text">
                <p>
                    Le salon <strong>#{channelName}</strong> a des permissions différentes de la catégorie <strong>{categoryName}</strong>.
                </p>
                <ul style={{ marginTop: '12px', paddingLeft: '20px', lineHeight: '1.6' }}>
                    <li>
                        <strong>Annuler le déplacement</strong> — remettra le salon à son emplacement d'origine.
                    </li>
                    <li>
                        <strong>Garder les permissions du salon</strong> — conserve les perms actuelles du salon, ignorant celles de la catégorie.
                    </li>
                    <li>
                        <strong>Synchroniser avec la catégorie</strong> — applique les perms de la catégorie au salon.
                    </li>
                </ul>
            </div>
        </Modal>
    );
}
