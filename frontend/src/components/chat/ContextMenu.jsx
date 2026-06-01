// frontend/src/components/chat/ContextMenu.jsx
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/* ------------------------------------------------------------
 * Composant principal du menu contextuel (glass + safeposition)
 * ------------------------------------------------------------ */
export default function ContextMenu({ x, y, onClose, children }) {
    const ref = useRef(null);

    // fermer sur ESC ou clic extérieur
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose?.();
        const onClick = (e) => {
            if (!ref.current) return;
            if (!ref.current.contains(e.target)) onClose?.();
        };

        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onClick);
        document.addEventListener("touchstart", onClick);

        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("touchstart", onClick);
        };
    }, [onClose]);

    // position auto pour éviter overflow
    const vw = typeof window !== "undefined" ? window.innerWidth : 800;
    const vh = typeof window !== "undefined" ? window.innerHeight : 600;
    const MENU_WIDTH = 260;
    const MENU_HEIGHT = 350; // approx

    const left = Math.min(x, vw - MENU_WIDTH - 8);
    const top = Math.min(y, vh - MENU_HEIGHT - 8);

    const menu = (
        <div className="fixed inset-0 z-[90] pointer-events-none">
            <div
                ref={ref}
                className="
                    pointer-events-auto absolute min-w-[260px]
                    bg-slate-900/80 backdrop-blur-xl
                    border border-slate-700/60 rounded-xl
                    shadow-2xl shadow-black/50
                    overflow-hidden
                "
                style={{ left, top }}
            >
                <ul className="py-1">{children}</ul>
            </div>
        </div>
    );

    return createPortal(menu, document.body);
}

/* ------------------------------------------------------------
 * Élément du menu (avec icône Lucide + hover glass)
 * ------------------------------------------------------------ */
export function ContextMenuItem({
                                    icon: Icon,
                                    onClick,
                                    children,
                                    danger = false,
                                    disabled = false,
                                }) {
    return (
        <li>
            <button
                disabled={disabled}
                onClick={disabled ? undefined : onClick}
                className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                    transition rounded-none
                    ${
                    danger
                        ? "text-red-400 hover:text-red-300"
                        : "text-slate-200 hover:text-white"
                }
                    ${
                    disabled
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-slate-800/60"
                }
                `}
            >
                {Icon && <Icon size={16} />}
                <span>{children}</span>
            </button>
        </li>
    );
}
