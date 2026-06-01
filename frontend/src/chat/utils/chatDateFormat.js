import React, { useEffect, useState } from 'react';

export function formatTime(dateLike) {
    if (!dateLike) return '';
    try {
        const d = new Date(dateLike);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', dayPeriod: 'long' });
    } catch {
        return '';
    }
}

export function formatSmartDate(dateLike) {
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const diffInMinutes = Math.floor((now - d) / 60000);
    if (diffInMinutes < 60 && diffInMinutes >= 0) {
        if (diffInMinutes < 1) return "À l'instant";
        return `Il y a ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''}`;
    }
    const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return `Aujourd'hui à ${timeStr}`;
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `Hier à ${timeStr}`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}

export function LiveDate({ date, className = '' }) {
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(id);
    }, []);
    return <span className={className}>{formatSmartDate(date)}</span>;
}
