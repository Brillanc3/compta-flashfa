import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import { useCompanyV2Flag } from '../hooks/useCompanyV2Flag';

/**
 * Redirige vers TchatV2 si useTchatV2 = true pour la company active,
 * sinon rend les enfants (ChatPage V1).
 */
export default function ChatGateway({ children }) {
    const { activeCompanyId } = useCompany();
    const { isV2, loading }   = useCompanyV2Flag(activeCompanyId);
    const location            = useLocation();

    if (loading) return null;

    if (isV2) {
        // Remplace /dashboard/chat/... par /dashboard/tchatv2/...
        const newPath = location.pathname.replace(/^\/dashboard\/chat/, '/dashboard/tchatv2');
        return <Navigate to={newPath + location.search} replace />;
    }

    return children;
}
