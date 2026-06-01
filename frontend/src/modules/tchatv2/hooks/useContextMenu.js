import { useState, useCallback } from 'react';

export function useContextMenu() {
    const [menu, setMenu] = useState(null);

    const openMenu = useCallback((e, items) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY, items });
    }, []);

    const closeMenu = useCallback(() => setMenu(null), []);

    return { menu, openMenu, closeMenu };
}
