// frontend/src/components/dashboard/SidebarSubmenuPopover.jsx

import React, { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence  } from 'framer-motion';

/**
 * Popover de sous-menu pour la sidebar en mode "collapsed"
 *
 * props:
 * - anchorRect: DOMRect du bouton parent (collapsed)
 * - items:      [{ name, icon, path }]
 * - isOpen:     bool
 * - onClose:    () => void
 * - onHoverStateChange: (isHovering: boolean) => void
 */
const SidebarSubmenuPopover = ({
                                   anchorRect,
                                   items,
                                   isOpen,
                                   onClose,
                                   onHoverStateChange,
                               }) => {
    const ref = useRef(null);

    // Fermeture clic extérieur / ESC
    useEffect(() => {
        if (!isOpen) return;

        const handleDown = (e) => {
            if (!ref.current) return;
            if (!ref.current.contains(e.target)) onClose?.();
        };

        const handleKey = (e) => {
            if (e.key === "Escape") onClose?.();
        };

        document.addEventListener("mousedown", handleDown);
        document.addEventListener("touchstart", handleDown);
        document.addEventListener("keydown", handleKey);

        return () => {
            document.removeEventListener("mousedown", handleDown);
            document.removeEventListener("touchstart", handleDown);
            document.removeEventListener("keydown", handleKey);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !anchorRect || !items?.length) return null;

    // Positionnement "premium" : à droite du bouton, centré verticalement, sans sortir de l'écran
    const viewportHeight =
        typeof window !== "undefined" ? window.innerHeight : 800;
    const scrollY =
        typeof window !== "undefined"
            ? window.scrollY || window.pageYOffset
            : 0;

    const itemHeight = 40;
    const verticalPadding = 12;
    const estimatedHeight =
        items.length * itemHeight + verticalPadding * 2;

    let top =
        anchorRect.top +
        scrollY +
        anchorRect.height / 2 -
        estimatedHeight / 2;

    top = Math.max(
        scrollY + 8,
        Math.min(top, scrollY + viewportHeight - estimatedHeight - 8)
    );

    const left = anchorRect.right + 10;

    return (
        <AnimatePresence>
            <motion.div
                ref={ref}
                onMouseEnter={() => onHoverStateChange?.(true)}
                onMouseLeave={() => onHoverStateChange?.(false)}
                initial={{ opacity: 0, y: 4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="
                    fixed z-[80] min-w-[210px] max-w-xs
                    rounded-xl border border-cca-border/70
                    bg-cca-base/90 backdrop-blur-xl
                    shadow-xl shadow-black/50
                    overflow-hidden
                "
                style={{ top, left }}
            >
                <div className="
                    px-3 py-2 text-[11px] font-semibold uppercase tracking-wide
                    text-cca-textSecondary border-b border-cca-border/60
                ">
                    Sous-menu
                </div>
                <ul className="py-1">
                    {items.map((child) => {
                        const Icon = child.icon;
                        return (
                            <li key={child.name}>
                                <NavLink
                                    to={child.path}
                                    className={({ isActive }) =>
                                        [
                                            "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                                            isActive
                                                ? "bg-cca-surface text-cca-textPrimary"
                                                : "text-cca-textSecondary hover:bg-cca-surface hover:text-cca-textPrimary",
                                        ].join(" ")
                                    }
                                    onClick={onClose}
                                >
                                    {Icon && (
                                        <Icon className="h-4 w-4 text-cca-textSecondary shrink-0" />
                                    )}
                                    <span className="truncate">
                                        {child.name}
                                    </span>
                                </NavLink>
                            </li>
                        );
                    })}
                </ul>
            </motion.div>
        </AnimatePresence>
    );
};

export default SidebarSubmenuPopover;
