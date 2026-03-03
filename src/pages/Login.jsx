import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Car, Lock, Mail } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await login(email, password);
            if (result.success) {
                // Se for funcionário de posto, vai direto para veículos pois não tem acesso ao mapa
                if (result.user?.role === 'FUNCIONARIO_POSTO') {
                    navigate('/veiculos');
                } else {
                    navigate('/');
                }
            } else {
                setError(result.message);
            }
        } catch (err) {
            console.error(err);
            setError('Ocorreu um erro ao fazer login.');
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', backgroundImage: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>

            <div className="glass animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', margin: '1rem' }}>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
                        <Car size={32} color="#3b82f6" />
                    </div>
                    <h1 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 'bold' }}>FleetManager</h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>Acesso ao sistema de frotas</p>
                </div>

                {error && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.75rem', borderRadius: '0.5rem', color: '#fca5a5', fontSize: '0.875rem', textAlign: 'center' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* ... (rest of the form is unchanged) ... */}
                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ color: '#cbd5e1' }}>E-mail corporativo</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} color="#64748b" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="email"
                                className="input-field"
                                style={{ width: '100%', paddingLeft: '2.75rem', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                                placeholder="seu.email@frota.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ color: '#cbd5e1' }}>Senha</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} color="#64748b" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="password"
                                className="input-field"
                                style={{ width: '100%', paddingLeft: '2.75rem', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                                placeholder="Sua senha de acesso"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                            disabled={loading}
                        >
                            {loading ? 'Entrando...' : 'Entrar no Sistema'}
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate('/register')}
                            className="btn btn-outline"
                            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.2)' }}
                            disabled={loading}
                        >
                            Cadastrar
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}
