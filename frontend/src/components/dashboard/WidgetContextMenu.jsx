// frontend/src/components/dashboard/WidgetContextMenu.jsx

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { createPortal } from "react-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import SettingsIcon from "@mui/icons-material/Settings";

const PADDING = 8;

const WidgetContextMenu = ({ x, y, onClose, onConfigure, onDelete, canConfigure }) => {
    const menuRef = useRef(null);
    const [pos, setPos] = useState({ left: x, top: y });

    // Base position = coords viewport
    useEffect(() => {
        setPos({ left: x, top: y });
    }, [x, y]);

    // Clamp pour rester dans l’écran
    useLayoutEffect(() => {
        const el = menuRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();

        let left = x;
        let top = y;

        if (left + rect.width > window.innerWidth - PADDING) {
            left = window.innerWidth - rect.width - PADDING;
        }
        if (top + rect.height > window.innerHeight - PADDING) {
            top = window.innerHeight - rect.height - PADDING;
        }

        left = Math.max(PADDING, left);
        top = Math.max(PADDING, top);

        setPos({ left, top });
    }, [x, y]);

    // Fermer au clic extérieur + ESC
    useEffect(() => {
        const onPointerDown = (e) => {
            if (!menuRef.current) return;
            if (!menuRef.current.contains(e.target)) onClose();
        };

        const onKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };

        window.addEventListener("pointerdown", onPointerDown, true);
        window.addEventListener("keydown", onKeyDown);

        return () => {
            window.removeEventListener("pointerdown", onPointerDown, true);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [onClose]);

    const menuStyle = {
        position: "fixed",
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        zIndex: 9999,
    };

    const content = (
        <div
            ref={menuRef}
            style={menuStyle}
            className="bg-cca-surface/95 border border-cca-border/50 backdrop-blur-2xl rounded-2xl shadow-2xl py-2 w-56 overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-brand-primary/5"
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="px-4 py-2 border-b border-cca-border/20 mb-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cca-textSecondary/40">Options du module</p>
            </div>
            <ul>
                <li>
                    <button
                        onClick={() => {
                            if (!canConfigure) return;
                            onConfigure();
                            onClose();
                        }}
                        disabled={!canConfigure}
                        className="w-full flex items-center px-4 py-3 text-xs font-bold text-cca-textPrimary hover:bg-brand-primary hover:text-white disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed transition-all"
                    >
                        <SettingsIcon sx={{ fontSize: 16 }} className="mr-3 opacity-60" />
                        CONFIGURATION
                    </button>
                </li>

                <li>
                    <button
                        onClick={() => {
                            onDelete();
                            onClose();
                        }}
                        className="w-full flex items-center px-4 py-3 text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-all font-black"
                    >
                        <DeleteIcon sx={{ fontSize: 16 }} className="mr-3 opacity-80" />
                        DÉSINSTALLER
                    </button>
                </li>
            </ul>
        </div>
    );

    // Portal => évite tous les offsets liés aux parents transformés
    return createPortal(content, document.body);
};

WidgetContextMenu.propTypes = {
    x: PropTypes.number.isRequired, // doit être clientX
    y: PropTypes.number.isRequired, // doit être clientY
    onClose: PropTypes.func.isRequired,
    onConfigure: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    canConfigure: PropTypes.bool.isRequired,
};

export default WidgetContextMenu;
