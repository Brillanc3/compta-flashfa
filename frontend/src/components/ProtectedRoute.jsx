// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCompany } from "../contexts/CompanyContext";
import { usePermissions } from "../contexts/PermissionsContext";
import Spinner from "@/components/ui/Spinner.jsx";

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const { selectedCompany } = useCompany();
    const { isLoading: permsLoading } = usePermissions();
    const location = useLocation();

    // Chargement auth
    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex justify-center items-center">
                <Spinner />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Si on est connecté et qu’une company est sélectionnée, on attend le chargement permissions
    if (selectedCompany?.id && permsLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex justify-center items-center">
                <Spinner />
            </div>
        );
    }

    return children;
};

export default ProtectedRoute;
