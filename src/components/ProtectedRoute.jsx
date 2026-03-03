import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute() {
    const { isAuthenticated, bootstrapping, loading } = useAuth();

    // Enquanto estiver inicializando (bootstrapping) OU processando login (loading),
    // mostramos o carregador para garantir que o estado do usuário seja sincronizado.
    if (bootstrapping || loading) {
        return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: 'white' }}>Carregando acesso...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
