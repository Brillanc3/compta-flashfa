// frontend/src/components/AdminRoute.jsx

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';

/** Règle stricte:
 *  - autorisé si ADMIN.* (super-admin)
 *  - sinon exiger EXACTEMENT ADMIN.PANEL.ACCESS
 */
function useAdminPanelAllowed() {
    const { user } = useAuth();
    const perms = new Set(user?.permissions || []);
    if (perms.has('ADMIN.*')) return true;
    return perms.has('ADMIN.PANEL.ACCESS');
}

export default function AdminRoute({ children }) {
    const location = useLocation();
    const { isLoading } = useAuth();
    const allowed = useAdminPanelAllowed();

    if (isLoading) return null; // skeleton possible
    if (!allowed) return <Navigate to="/forbidden" state={{ from: location }} replace />;

    return <>{children}</>;
}
