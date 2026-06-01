import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Search, X } from 'lucide-react';

export default function SearchableSelect({ options, placeholder, onSelect, labelKey = 'name', valueKey = 'id' }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef(null);
    const inputRef = useRef(null);

    const filtered = useMemo(() => {
        if (!query.trim()) return options;
        const q = query.toLowerCase();
        return options.filter((o) => (o[labelKey] ?? '').toLowerCase().includes(q));
    }, [options, query, labelKey]);

    useEffect(() => {
        if (!open) { setQuery(''); return; }
        setTimeout(() => inputRef.current?.focus(), 50);
    }, [open]);

    useEffect(() => {
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('touchstart', handleClick);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('touchstart', handleClick);
        };
    }, []);

    if (!options.length) return null;

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 text-brand-primary transition-all active:scale-95">
                <Plus className="w-3.5 h-3.5" />
                {placeholder}
                <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-cca-border bg-cca-surface shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="p-2 border-b border-cca-border bg-cca-base">
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-cca-surface border border-cca-border focus-within:border-brand-primary transition-colors">
                            <Search className="w-3.5 h-3.5 text-cca-textSecondary flex-shrink-0" />
                            <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                                placeholder="Rechercher…"
                                className="flex-1 bg-transparent text-xs text-cca-textPrimary placeholder:text-cca-textSecondary/50 outline-none min-w-0" />
                            {query && (
                                <button type="button" onClick={() => setQuery('')} className="text-cca-textSecondary hover:text-cca-textPrimary">
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto overscroll-contain">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-cca-textSecondary/60 italic text-center">Aucun résultat</div>
                        ) : (
                            filtered.map((o) => (
                                <button key={o[valueKey]} type="button"
                                    onClick={() => { onSelect(o[valueKey]); setOpen(false); }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-cca-textPrimary hover:bg-cca-base active:bg-brand-primary/10 transition-colors">
                                    {o[labelKey]}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
