// frontend/src/components/ui/ContextMenu.jsx
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function ContextMenu({ x, y, onClose, children }) {
    const ref = useRef(null);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        const onClick = (e) => {
            if (!ref.current) return;
            if (!ref.current.contains(e.target)) onClose?.();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onClick);
        document.addEventListener('touchstart', onClick);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('touchstart', onClick);
        };
    }, [onClose]);

    // position dans l'écran avec garde-fou
    const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
    const menuW = 220, menuH = 8 * 40; // approx
    const left = Math.min(x, vw - menuW - 12);
    const top = Math.min(y, vh - menuH - 12);

    const menu = (
        <div className="fixed inset-0 z-[70] pointer-events-none">
            <div
                ref={ref}
                className="
                    pointer-events-auto absolute min-w-[220px] 
                    bg-cca-surface/90 border border-cca-border/50 
                    backdrop-blur-2xl rounded-2xl shadow-2xl glass-scroll
                    overflow-hidden animate-in fade-in zoom-in-95 duration-200
                "
                style={{ left, top }}
            >
                 <div className="
                    pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay
                    bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]
                " />
                <ul className="py-2 relative">{children}</ul>
            </div>
        </div>
    );
    return createPortal(menu, document.body);
}

export function ContextMenuItem({ icon: Icon, children, onClick, danger = false }) {
    return (
        <li>
            <button
                onClick={onClick}
                className={`
                    w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                    ${danger 
                        ? 'text-rose-500 hover:bg-rose-500/10' 
                        : 'text-cca-textPrimary hover:bg-brand-primary/10 hover:text-brand-primary'}
                `}
            >
                {Icon ? <Icon size={16} /> : null}
                <span className="font-semibold tracking-tight">{children}</span>
            </button>
        </li>
    );
}
