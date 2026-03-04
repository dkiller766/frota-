import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Map, Car, Bike, MapPin, Navigation, LogOut, Users, Wrench, ClipboardCheck } from 'lucide-react';

export default function DashboardLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const menuItems = React.useMemo(() => {
        const items = [
            { path: '/veiculos', label: 'Veículos', icon: <Car size={24} /> },
            { path: '/motos', label: 'Motos', icon: <Bike size={24} /> },
            { path: '/checklist-historico', label: 'Histórico Checklists', icon: <ClipboardCheck size={24} /> }
        ];

        // Só mostra Mapa, Postos e Rotas se NÃO for funcionário de posto
        if (user?.role !== 'FUNCIONARIO_POSTO') {
            items.unshift({ path: '/', label: 'Mapa em Tempo Real', icon: <Map size={24} /> });
            items.push({ path: '/postos', label: 'Postos', icon: <MapPin size={24} /> });
            items.push({ path: '/rotas', label: 'Rotas', icon: <Navigation size={24} /> });
        }

        if (user?.role === 'ADMIN' || user?.role === 'LIDER' || user?.role === 'FUNCIONARIO_POSTO') {
            items.push({ path: '/manutencoes', label: 'Oficina', icon: <Wrench size={24} /> });
        }

        if (user?.role === 'ADMIN') {
            items.push({ path: '/equipe', label: 'Equipe', icon: <Users size={24} /> });
        }
        return items;
    }, [user?.role]);

    const getRoleLabel = (role) => {
        switch (role) {
            case 'ADMIN': return 'Administrador';
            case 'LIDER': return 'Líder de Frota';
            case 'COLABORADOR': return 'Colaborador';
            default: return role;
        }
    };

    return (
        <div className="app-container">
            {/* Menu Lateral (Desktop) */}
            <aside className="hidden-mobile glass" style={{
                width: '280px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid var(--border-color)',
                padding: '1.5rem',
                zIndex: 50
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
                    <div style={{ background: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                        <Car size={24} color="white" />
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>FleetManager</h2>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Logado como:</p>
                    <p style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{user?.name}</p>
                    <div style={{ display: 'inline-block', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', padding: '0.25rem 0.625rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: '600', marginTop: '0.25rem' }}>
                        {getRoleLabel(user?.role)}
                    </div>
                </div>

                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {menuItems.map((item) => (
                        <NavLink
                            to={item.path}
                            key={item.path}
                            className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                            style={({ isActive }) => ({
                                justifyContent: 'flex-start',
                                padding: '0.875rem 1rem',
                                border: isActive ? 'none' : '1px solid transparent'
                            })}
                        >
                            {item.icon}
                            <span style={{ marginLeft: '0.5rem' }}>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <button onClick={handleLogout} className="btn btn-outline" style={{ marginTop: 'auto', width: '100%', display: 'flex', justifyContent: 'center', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}>
                    <LogOut size={18} />
                    <span>Sair do sistema</span>
                </button>
            </aside>

            {/* Conteúdo Principal */}
            <main className="main-content">
                <div style={{
                    padding: '1rem 1.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'var(--glass-bg)',
                    backdropFilter: 'blur(12px)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 40
                }} className="hidden-desktop">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ background: 'var(--primary)', padding: '0.375rem', borderRadius: '0.375rem' }}>
                            <Car size={18} color="white" />
                        </div>
                        <h2 style={{ fontSize: '1rem', fontWeight: 'bold' }}>FleetManager</h2>
                    </div>
                    <button onClick={handleLogout} style={{ color: 'var(--danger)', background: 'none', border: 'none', padding: '0.5rem' }}>
                        <LogOut size={20} />
                    </button>
                </div>

                <div className="page-container animate-fade-in" style={{ backgroundColor: 'var(--bg-primary)' }}>
                    <Outlet />
                </div>
            </main>

            {/* TabBar Inferior (Mobile) */}
            <nav className="hidden-desktop glass" style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: '4.5rem',
                display: 'flex',
                alignItems: 'center',
                borderTop: '1px solid var(--border-color)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                zIndex: 50,
                overflowX: 'auto',
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none', // Firefox
                msOverflowStyle: 'none',  // IE 10+
                padding: '0 0.5rem',
                gap: '0.25rem'
            }}>
                {/* Hide scrollbar for Chrome/Safari/Webkit */}
                <style>{`
                    .hidden-desktop::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>

                {menuItems.map((item) => (
                    <NavLink
                        to={item.path}
                        key={item.path}
                        style={({ isActive }) => ({
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                            textDecoration: 'none',
                            gap: '0.25rem',
                            flex: '0 0 auto',
                            minWidth: '4.5rem',
                            height: '100%',
                            transition: 'color 0.2s',
                            padding: '0.25rem',
                            borderRadius: '0.5rem',
                            backgroundColor: isActive ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                        })}
                    >
                        {item.icon}
                        <span style={{ fontSize: '0.625rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                            {item.label === 'Histórico Checklists' ? 'Checklists' : item.label === 'Mapa em Tempo Real' ? 'Mapa' : item.label}
                        </span>
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}
