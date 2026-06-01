// frontend/src/components/ui/Pagination.jsx
// Je préfère que la première ligne d'un fichier soit la route du fichier.

import React, { useMemo } from 'react';

/**
 * Pagination générique (client-side friendly).
 *
 * Props:
 * - page               (number, required) : page courante (1-based)
 * - totalPages         (number, required)
 * - totalItems         (number, optional) : pour l'affichage "x–y sur N"
 * - pageSize           (number, optional)
 * - pageSizeOptions    (number[], optional) : ex [10, 25, 50, 100]
 * - onPageChange       (fn, required) : (nextPage:number) => void
 * - onPageSizeChange   (fn, optional) : (nextSize:number) => void
 * - className          (string, optional)
 *
 * Accessibilité: boutons <button>, aria-current sur la page active.
 */
export default function Pagination({
                                       page,
                                       totalPages,
                                       totalItems,
                                       pageSize,
                                       pageSizeOptions = [10, 25, 50, 100],
                                       onPageChange,
                                       onPageSizeChange,
                                       className = '',
                                   }) {
    const pages = useMemo(() => {
        // Construit une pagination compacte: 1 … (page-1) page (page+1) … N
        const p = Number(page) || 1;
        const t = Math.max(1, Number(totalPages) || 1);

        // Si peu de pages, on les liste toutes
        if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);

        const windowLeft = Math.max(2, p - 1);
        const windowRight = Math.min(t - 1, p + 1);
        const set = new Set([1, t, windowLeft, p, windowRight]);

        // Élargir un peu au voisinage si on est aux extrêmes
        if (p <= 3) { set.add(2); set.add(3); set.add(4); }
        if (p >= t - 2) { set.add(t - 1); set.add(t - 2); set.add(t - 3); }

        const arr = Array.from(set).filter(n => n >= 1 && n <= t).sort((a, b) => a - b);

        // Injecter des ellipses virtuelles (null)
        const withGaps = [];
        for (let i = 0; i < arr.length; i++) {
            withGaps.push(arr[i]);
            if (i < arr.length - 1 && arr[i + 1] - arr[i] > 1) {
                withGaps.push(null); // ellipsis
            }
        }
        return withGaps;
    }, [page, totalPages]);

    const fromTo = useMemo(() => {
        if (!totalItems || !pageSize) return null;
        const start = (page - 1) * pageSize + 1;
        const end = Math.min(page * pageSize, totalItems);
        return `${start}–${end} sur ${totalItems}`;
    }, [page, pageSize, totalItems]);

    const canPrev = page > 1;
    const canNext = page < totalPages;

    return (
        <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
            {/* Info + sélecteur pageSize */}
            <div className="flex items-center gap-3">
                {fromTo && (
                    <span className="text-sm text-slate-400">{fromTo}</span>
                )}

                {onPageSizeChange && (
                    <label className="inline-flex items-center gap-2 text-sm text-slate-400">
                        <span>Par page</span>
                        <select
                            className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                            value={pageSize}
                            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
                        >
                            {pageSizeOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </label>
                )}
            </div>

            {/* Contrôles de page */}
            <nav className="inline-flex items-center gap-1" aria-label="Pagination">
                <button
                    type="button"
                    onClick={() => canPrev && onPageChange(page - 1)}
                    disabled={!canPrev}
                    className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-800"
                    aria-label="Page précédente"
                >
                    ←
                </button>

                {pages.map((p, idx) => {
                    if (p === null) {
                        return (
                            <span
                                key={`gap-${idx}`}
                                className="px-2 text-slate-500 select-none"
                                aria-hidden="true"
                            >
                …
              </span>
                        );
                    }
                    const active = p === page;
                    return (
                        <button
                            key={p}
                            type="button"
                            onClick={() => onPageChange(p)}
                            aria-current={active ? 'page' : undefined}
                            className={[
                                'min-w-[2.25rem] rounded-md border px-3 py-1.5 text-sm',
                                active
                                    ? 'border-blue-500 bg-blue-600 text-white'
                                    : 'border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800',
                            ].join(' ')}
                        >
                            {p}
                        </button>
                    );
                })}

                <button
                    type="button"
                    onClick={() => canNext && onPageChange(page + 1)}
                    disabled={!canNext}
                    className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-800"
                    aria-label="Page suivante"
                >
                    →
                </button>
            </nav>
        </div>
    );
}
