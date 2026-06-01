// /frontend/src/components/calendar/CalendarContextMenu.jsx
import React, { useRef, useEffect } from 'react';

const CalendarContextMenu = ({ x, y, event, onAddEvent, onEditEvent, onDeleteEvent, onFinishEvent, onClose }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Un service est "en cours" s'il n'a pas de endTime
    const isInProgress = event && !event.endTime;

    // Effet pour ajuster la position en fonction des bords de l'écran
    useEffect(() => {
        if (!menuRef.current) return;

        const menu = menuRef.current;
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let finalX = x;
        let finalY = y;

        // Débordement à droite ?
        if (x + rect.width > viewportWidth) {
            finalX = viewportWidth - rect.width - 10;
        }

        // Débordement en bas ?
        if (y + rect.height > viewportHeight) {
            finalY = viewportHeight - rect.height - 10;
        }

        // Sécurité bord gauche / haut
        finalX = Math.max(10, finalX);
        finalY = Math.max(10, finalY);

        menu.style.left = `${finalX}px`;
        menu.style.top = `${finalY}px`;
    }, [x, y]);

    return (
        <div
            ref={menuRef}
            className="
                fixed z-[9999] p-1.5 min-w-[240px]
                bg-cca-surface/80 backdrop-blur-2xl border border-cca-border rounded-2xl shadow-2xl
                animate-in fade-in zoom-in-95 duration-200
                pointer-events-auto
            "
            style={{ top: y, left: x }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cca-textSecondary/50 border-b border-cca-border/50 mb-1">
                Options de service
            </div>

            {event ? (
                <div className="space-y-1">
                    {isInProgress && (
                        <button 
                            onClick={onFinishEvent} 
                            className="flex items-center w-full px-4 py-2.5 text-sm font-bold text-green-400 hover:bg-green-500/10 rounded-xl transition-all group"
                        >
                            <span className="mr-3 p-1.5 rounded-lg bg-green-500/10 text-green-400 group-hover:scale-110 transition-transform">✅</span> 
                            Terminer le service
                        </button>
                    )}
                    
                    <button 
                        onClick={onEditEvent} 
                        className="flex items-center w-full px-4 py-2.5 text-sm font-bold text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-base rounded-xl transition-all group"
                    >
                        <span className="mr-3 p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">⏱️</span> 
                        Modifier la durée
                    </button>

                    <div className="my-1 border-t border-cca-border/30" />

                    <button 
                        onClick={onDeleteEvent} 
                        className="flex items-center w-full px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-all group"
                    >
                        <span className="mr-3 p-1.5 rounded-lg bg-red-500/10 text-red-400 group-hover:scale-110 transition-transform">⚠️</span> 
                        Annuler le service
                    </button>
                </div>
            ) : (
                <button 
                    onClick={onAddEvent} 
                    className="flex items-center w-full px-4 py-2.5 text-sm font-bold text-brand-primary hover:bg-brand-primary/10 rounded-xl transition-all group"
                >
                    <span className="mr-3 p-1.5 rounded-lg bg-brand-primary/10 text-brand-primary group-hover:scale-110 transition-transform">➕</span> 
                    Planifier un service
                </button>
            )}
        </div>
    );
};

export default CalendarContextMenu;