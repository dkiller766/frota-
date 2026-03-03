import React, { useState } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, Mail, Phone, Building, Briefcase } from 'lucide-react';

export default function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [company, setCompany] = useState('');
    const [role, setRole] = useState(ROLES.COLABORADOR);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const { registerUser } = useAuth();
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (!name || !email || !password || !phone || !company || !role) {
            setError('Todos os campos são obrigatórios.');
            return;
        }

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        setLoading(true);

        try {
            console.log('Tentando registrar...', { name, email, role, company });
            const result = await registerUser(name, email, phone, password, role, company);
            console.log('Resultado do registro:', result);

            if (result.success) {
                if (result.needsConfirmation) {
                    setSuccessMsg(result.message);
                } else {
                    setSuccessMsg('Cadastro concluído! Redirecionando...');
                    setTimeout(() => navigate('/'), 1500);
                }
            } else {
                setError(result.message);
            }
        } catch (err) {
            console.error('Erro no handleRegister:', err);
            setError('Ocorreu um erro ao realizar o cadastro. Verifique o console do navegador para detalhes.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', backgroundImage: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', minHeight: '100vh', padding: '2rem 1rem' }}>

            <div className="glass animate-slide-up" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
                        <User size={32} color="#10b981" />
                    </div>
                    <h1 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 'bold' }}>Novo Cadastro</h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem', textAlign: 'center' }}>Preencha os dados abaixo para criar sua conta no sistema de frotas.</p>
                </div>

                {error && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.75rem', borderRadius: '0.5rem', color: '#fca5a5', fontSize: '0.875rem', textAlign: 'center' }}>
                        {error}
                    </div>
                )}

                {successMsg && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.75rem', borderRadius: '0.5rem', color: '#6ee7b7', fontSize: '0.875rem', textAlign: 'center' }}>
                        {successMsg}
                    </div>
                )}

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ color: '#cbd5e1' }}>Nome Completo</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} color="#64748b" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="text"
                                className="input-field"
                                style={{ width: '100%', paddingLeft: '2.75rem', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                                placeholder="João da Silva"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ color: '#cbd5e1' }}>E-mail corporativo</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} color="#64748b" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="email"
                                className="input-field"
                                style={{ width: '100%', paddingLeft: '2.75rem', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                                placeholder="joao@empresa.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
                            <label className="input-label" style={{ color: '#cbd5e1' }}>Telefone</label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={18} color="#64748b" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="tel"
                                    className="input-field"
                                    style={{ width: '100%', paddingLeft: '2.75rem', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                                    placeholder="(11) 99999-9999"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
                            <label className="input-label" style={{ color: '#cbd5e1' }}>Senha</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} color="#64748b" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="password"
                                    className="input-field"
                                    style={{ width: '100%', paddingLeft: '2.75rem', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                                    placeholder="Mínimo 6 chars"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ color: '#cbd5e1' }}>Nome da Empresa</label>
                        <div style={{ position: 'relative' }}>
                            <Building size={18} color="#64748b" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="text"
                                className="input-field"
                                style={{ width: '100%', paddingLeft: '2.75rem', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                                placeholder="Transportes Express Ltda"
                                value={company}
                                onChange={(e) => setCompany(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ color: '#cbd5e1' }}>Qual o seu Cargo?</label>
                        <div style={{ position: 'relative' }}>
                            <Briefcase size={18} color="#64748b" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                            <select
                                className="input-field"
                                style={{ width: '100%', paddingLeft: '2.75rem', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(255,255,255,0.1)', color: 'white', appearance: 'none' }}
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                required
                            >
                                <option value={ROLES.ADMIN} style={{ color: 'black' }}>Administrador / Dono da Frota</option>
                                <option value={ROLES.LIDER} style={{ color: 'black' }}>Líder de Frota / Gestor</option>
                                <option value={ROLES.COLABORADOR} style={{ color: 'black' }}>Colaborador / Motorista</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '1.5rem', padding: '0.75rem', fontSize: '1rem', backgroundColor: '#10b981' }}
                        disabled={loading}
                    >
                        {loading ? 'Cadastrando...' : 'Finalizar Cadastro'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                        <Link to="/login" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>
                            Já tem uma conta? <span style={{ color: '#3b82f6' }}>Voltar ao login</span>
                        </Link>
                    </div>
                </form>

            </div>
        </div>
    );
}
