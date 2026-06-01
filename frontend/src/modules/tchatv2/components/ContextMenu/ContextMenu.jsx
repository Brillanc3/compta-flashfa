import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';

function MenuPanel({ x, y, items, onClose, depth = 0 }) {
    const ref                    = useRef(null);
    const [pos, setPos]          = useState({ x, y });
    const [openSub, setOpenSub]  = useState(null);
    const [subRect, setSubRect]  = useState(null);

    useLayoutEffect(() => {
        if (!ref.current) return;
        const { width, height } = ref.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let nx = x;
        let ny = y;
        if (nx + width  > vw - 8) nx = Math.max(8, vw - width  - 8);
        if (ny + height > vh - 8) ny = Math.max(8, vh - height - 8);
        if (nx !== x || ny !== y) setPos({ x: nx, y: ny });
    }, [x, y]);

    useEffect(() => {
        if (depth !== 0) return;
        const onKey  = (e) => { if (e.key === 'Escape') onClose(); };
        const onDown = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown, true);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDown, true);
        };
    }, [onClose, depth]);

    const handleEnter = (i, item) => {
        if (item.submenu && !item.disabled) {
            const li = ref.current?.children?.[i];
            const rect = li?.getBoundingClientRect() ?? null;
            setSubRect(rect);
            setOpenSub(i);
        } else {
            setOpenSub(null);
        }
    };

    const renderItem = (item, i) => {
        if (item.type === 'separator') return <div key={i} className="tv2-ctx-sep" />;
        if (item.type === 'label')     return <div key={i} className="tv2-ctx-label">{item.text}</div>;

        const hasSubmenu = Array.isArray(item.submenu) && item.submenu.length > 0;

        return (
            <button
                key={i}
                type="button"
                className={[
                    'tv2-ctx-item',
                    item.danger   ? 'is-danger'       : '',
                    item.disabled ? 'is-disabled'      : '',
                    item.active   ? 'is-active'        : '',
                    hasSubmenu    ? 'tv2-ctx-item--has-submenu' : '',
                    openSub === i ? 'is-submenu-open'  : '',
                ].filter(Boolean).join(' ')}
                disabled={item.disabled}
                onMouseEnter={() => handleEnter(i, item)}
                onClick={() => {
                    if (item.disabled) return;
                    if (hasSubmenu) return;
                    item.action?.();
                    onClose();
                }}
            >
                {item.icon && <span className="tv2-ctx-icon">{item.icon}</span>}
                <span className="tv2-ctx-text">{item.text}</span>
                {item.shortcut && <span className="tv2-ctx-shortcut">{item.shortcut}</span>}
                {hasSubmenu && <span className="tv2-ctx-sub-caret"><ChevronRight size={12} /></span>}
            </button>
        );
    };

    const node = (
        <div
            ref={ref}
            className="tv2-ctx-menu"
            style={{ left: pos.x, top: pos.y }}
            onContextMenu={e => e.preventDefault()}
        >
            {items.map(renderItem)}
            {openSub !== null && subRect && items[openSub]?.submenu && (
                <MenuPanel
                    x={subRect.right + 2}
                    y={subRect.top}
                    items={items[openSub].submenu}
                    onClose={onClose}
                    depth={depth + 1}
                />
            )}
        </div>
    );

    return depth === 0 ? createPortal(node, document.body) : node;
}

export default function ContextMenu({ x, y, items, onClose }) {
    return <MenuPanel x={x} y={y} items={items} onClose={onClose} />;
}
