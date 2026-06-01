// frontend/src/hooks/usePagination.js
// Hook générique de pagination client-side, simple et sans dépendance.

import { useMemo, useState, useCallback, useEffect } from 'react';

/**
 * @template T
 * @param {T[]} items - Liste complète (non paginée)
 * @param {{ pageSize?: number, initialPage?: number }} [opts]
 * @returns {{
 *   page: number,
 *   pageSize: number,
 *   totalItems: number,
 *   totalPages: number,
 *   setPageSize: (n:number)=>void,
 *   goTo: (p:number)=>void,
 *   next: ()=>void,
 *   prev: ()=>void,
 *   slice: T[]
 * }}
 */
export default function usePagination(items, opts = {}) {
    const [page, setPage] = useState(opts.initialPage ?? 1);
    const [pageSize, setPageSizeState] = useState(opts.pageSize ?? 10);

    const totalItems = Array.isArray(items) ? items.length : 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)));

    // Recalage de la page si la taille change ou si on dépasse
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const setPageSize = useCallback((n) => {
        const size = Math.max(1, Number(n) || 10);
        setPageSizeState(size);
        setPage(1);
    }, []);

    const goTo = useCallback((p) => {
        const next = Math.min(Math.max(1, Number(p) || 1), totalPages);
        setPage(next);
    }, [totalPages]);

    const next = useCallback(() => setPage(p => Math.min(p + 1, totalPages)), [totalPages]);
    const prev = useCallback(() => setPage(p => Math.max(p - 1, 1)), []);

    const slice = useMemo(() => {
        if (!Array.isArray(items) || items.length === 0) return [];
        const start = (page - 1) * pageSize;
        return items.slice(start, start + pageSize);
    }, [items, page, pageSize]);

    return { page, pageSize, totalItems, totalPages, setPageSize, goTo, next, prev, slice };
}
