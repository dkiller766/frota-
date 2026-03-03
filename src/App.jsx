import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy loaded pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Veiculos = lazy(() => import('./pages/Veiculos'));
const Postos = lazy(() => import('./pages/Postos'));
const Rotas = lazy(() => import('./pages/Rotas'));
const Equipe = lazy(() => import('./pages/Equipe'));
const Manutencoes = lazy(() => import('./pages/Manutencoes'));
const ChecklistHistorico = lazy(() => import('./pages/ChecklistHistorico'));

const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)', color: 'var(--primary)' }}>
    <div className="animate-pulse" style={{ fontWeight: '600' }}>Carregando...</div>
  </div>
);

function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/veiculos" element={<Veiculos />} />
            <Route path="/postos" element={<Postos />} />
            <Route path="/rotas" element={<Rotas />} />
            <Route path="/equipe" element={<Equipe />} />
            <Route path="/manutencoes" element={<Manutencoes />} />
            <Route path="/checklist-historico" element={<ChecklistHistorico />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
