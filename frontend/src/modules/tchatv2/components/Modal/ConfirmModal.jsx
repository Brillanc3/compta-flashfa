import React, { useState } from 'react';
import Modal from './Modal';

export default function ConfirmModal({
    open, onClose, onConfirm,
    title = 'Confirmer',
    body = 'Cette action est irréversible.',
    confirmLabel = 'Supprimer',
    cancelLabel = 'Annuler',
    danger = true,
    preview = null,
}) {
    const [pending, setPending] = useState(false);

    const handleConfirm = async () => {
        setPending(true);
        try { await onConfirm?.(); onClose?.(); }
        finally { setPending(false); }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            danger={danger}
            footer={
                <>
                    <button className="tv2-btn-ghost" disabled={pending} onClick={onClose}>{cancelLabel}</button>
                    <button
                        className={danger ? 'tv2-btn-danger' : 'tv2-btn-solid'}
                        disabled={pending}
                        onClick={handleConfirm}
                    >
                        {pending ? '…' : confirmLabel}
                    </button>
                </>
            }
        >
            <p className="tv2-modal-text">{body}</p>
            {preview && <div className="tv2-modal-quote">{preview}</div>}
        </Modal>
    );
}
