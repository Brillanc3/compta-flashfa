// frontend/src/components/ProfileCompletionGuard.jsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import Spinner from './ui/Spinner';

const ProfileCompletionGuard = ({ children }) => {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    // Si l'utilisateur est suspendu et n'est PAS sur sa page de profil, on le redirige.
    if (user?.status === 'SUSPENDED' && location.pathname !== '/dashboard/me') {
        return <Navigate to="/dashboard/me" replace />;
    }

    // Sinon, on affiche la page demandée.
    return children;
};

export default ProfileCompletionGuard;