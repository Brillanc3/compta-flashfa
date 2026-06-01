import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, footer, width = 480, danger = false }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div className="tv2-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
            <div
                className={`tv2-modal ${danger ? 'is-danger' : ''}`}
                role="dialog"
                aria-modal="true"
                style={{ maxWidth: width }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="tv2-modal-head">
                    <h3 className="tv2-modal-title">{title}</h3>
                    <button type="button" className="tv2-modal-close" onClick={onClose} aria-label="Fermer">
                        <X size={18} />
                    </button>
                </div>
                <div className="tv2-modal-body">{children}</div>
                {footer && <div className="tv2-modal-foot">{footer}</div>}
            </div>
        </div>,
        document.body
    );
}
