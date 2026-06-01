import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Building,
    ClipboardList,
    LogOut,
    Activity,
    GraduationCap,
    Megaphone,
    ImageIcon,
    BarChart2,
} from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionsContext';

const AdminSidebar = () => {
    const { isReady, has } = usePermissions();

    // Tant que les permissions ne sont pas prêtes,
    // on n’affiche rien (ou un skeleton si tu veux)
    if (!isReady) {
        return null;
    }

    const canSeeTickets = has('ADMIN.*') || has('ADMIN.TICKETS.*') || has('ADMIN.TICKETS.BILLS') || has('ADMIN.TICKETS.SUPPORT') || has('ADMIN.TICKETS.OTHERS');


    const navItems = [
        {
            name: 'Tableau de Bord',
            path: '/admin/dashboard',
            icon: LayoutDashboard,
        },
        {
            name: 'Tickets',
            path: '/admin/tickets',
            icon: ClipboardList,
            visible: canSeeTickets,
        },
        {
            name: 'Quiz T.T.E',
            path: '/admin/quiz',
            icon: GraduationCap,
            permission: 'ADMIN.QUIZ.SEND',
        },
        {
            name: 'Support Facturation',
            path: '/admin/billing-support',
            icon: ClipboardList,
            permission: 'ADMIN.BILLING.SUPPORT.VIEW',
        },
        {
            name: 'Gestion Entreprises',
            path: '/admin/companies',
            icon: Building,
            permission: 'ADMIN.PANEL.COMPANY.VIEW',
        },
        {
            name: 'Gestion des Logs',
            path: '/admin/logs',
            icon: Activity,
            permission: 'ADMIN.PANEL.ACCESS',
        },
        {
            name: 'Annonces',
            path: '/admin/announcements',
            icon: Megaphone,
            permission: 'ADMIN.ANNOUNCEMENT.VIEW',
        },
        {
            name: 'Images',
            path: '/admin/images',
            icon: ImageIcon,
            permission: 'ADMIN.IMAGE.MANAGE',
        },
        {
            name: 'Tchat Monitoring',
            path: '/admin/tchat-monitoring',
            icon: BarChart2,
            permission: 'ADMIN.PANEL.ACCESS',
        },
    ];

    const linkClasses = ({ isActive }) =>
        `flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 active:scale-95 ${
            isActive
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-cca-textSecondary hover:bg-cca-base hover:text-cca-textPrimary'
        }`;

    return (
        <nav className="flex flex-col h-full">
            <div className="p-4 space-y-2 flex-grow">
                <h3 className="text-xs font-heading font-semibold uppercase text-brand-primary mb-4 tracking-wider">
                    Panneau Admin
                </h3>

                {navItems.map((item) => {
                    if (item.visible === false) {
                        return null;
                    }

                    if (item.permission && !has(item.permission)) {
                        return null;
                    }

                    const Icon = item.icon;

                    return (
                        <NavLink
                            key={item.name}
                            to={item.path}
                            end={item.path === '/admin/dashboard'}
                            className={linkClasses}
                        >
                            <Icon size={18} className="mr-3" />
                            {item.name}
                        </NavLink>
                    );
                })}
            </div>

            <div className="p-4 border-t border-cca-border">
                <NavLink
                    to="/dashboard"
                    className="flex items-center px-4 py-2 text-sm font-medium rounded-md
                               text-red-500 hover:bg-cca-base transition-colors duration-200"
                >
                    <LogOut size={18} className="mr-3" />
                    Retour Dashboard
                </NavLink>
            </div>
        </nav>
    );
};

export default AdminSidebar;
