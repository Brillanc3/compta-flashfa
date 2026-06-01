// frontend/src/layouts/AdminLayout.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminSidebar from '@/components/AdminSidebar';
import { Menu, X } from 'lucide-react';

const AdminLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();

    // Ferme le drawer quand on change de route
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    const mobileDrawerClassName = useMemo(() => {
        const base = [
            'md:hidden fixed inset-y-0 left-0 z-50',
            'w-[min(85vw,20rem)]',
            'bg-slate-800 border-r border-slate-700',
            'transform transition-transform duration-200',
        ].join(' ');

        return `${base} ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`;
    }, [isSidebarOpen]);

    return (
        <div className="min-h-screen bg-cca-base text-cca-textPrimary flex transition-colors duration-300">

            {/* Sidebar desktop */}
            <aside className="w-64 bg-cca-surface flex-shrink-0 border-r border-cca-border h-screen sticky top-0 hidden md:block transition-colors duration-300">
                <AdminSidebar />
            </aside>

            {/* Drawer mobile */}
            <aside
                className={mobileDrawerClassName}
                onClick={(e) => {
                    // Ferme le drawer si on clique sur un lien
                    const target = e.target;
                    if (target?.closest?.('a')) {
                        setIsSidebarOpen(false);
                    }
                }}
            >
                <div className="h-14 px-3 border-b border-cca-border flex items-center justify-between bg-cca-surface transition-colors duration-300">
                    <div className="text-sm font-semibold font-heading">Administration</div>
                    <button
                        type="button"
                        aria-label="Fermer le menu"
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-2 rounded hover:bg-cca-base transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="h-[calc(100%-3.5rem)] overflow-y-auto bg-cca-surface transition-colors duration-300">
                    <AdminSidebar />
                </div>
            </aside>

            {isSidebarOpen && (
                <button
                    type="button"
                    aria-label="Fermer le menu"
                    onClick={() => setIsSidebarOpen(false)}
                    className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
                />
            )}

            {/* Contenu principal */}
            <div className="flex-1 min-w-0 flex flex-col">
                {/* Top bar mobile */}
                <div className="md:hidden h-14 sticky top-0 z-30 border-b border-cca-border bg-cca-surface/70 backdrop-blur flex items-center gap-2 px-4 transition-colors duration-300">
                    <button
                        type="button"
                        aria-label="Ouvrir le menu"
                        onClick={() => setIsSidebarOpen(true)}
                        className="-ml-2 p-2 rounded hover:bg-cca-base transition-colors"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="text-sm font-semibold font-heading">Panneau Admin</div>
                </div>

                <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-cca-base transition-colors duration-300">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;