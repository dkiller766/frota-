import React, { useState } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useFleet } from '../contexts/FleetContext';
import { Users, Mail, UserPlus, CheckCircle, MapPin } from 'lucide-react';

export default function Equipe() {
    const { user, getCompanyUsers, inviteUser } = useAuth();
    const { stations } = useFleet();
    const allowInvite = user?.role === 'ADMIN';

    const [team, setTeam] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const [inviteName, setInviteName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState(ROLES.COLABORADOR);
    const [inviteStationId, setInviteStationId] = useState('');
    const [invitePassword, setInvitePassword] = useState('');
    const [invitationSent, setInvitationSent] = useState(null);

    React.useEffect(() => {
        const fetchTeam = async () => {
            setLoading(true);
            const data = await getCompanyUsers();
            setTeam(data || []);
            setLoading(false);
        };
        fetchTeam();
    }, [getCompanyUsers]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', color: 'var(--text-secondary)' }}>
                <div className="animate-pulse">Carregando equipe...</div>
            </div>
        );
    }

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!allowInvite) return;

        const result = await inviteUser(inviteName, inviteEmail, inviteRole, invitePassword, inviteStationId || null);
        if (result.success) {
            setInvitationSent({ email: inviteEmail, password: result.temporaryPassword });

            // Reseta form
            setInviteName('');
            setInviteEmail('');
            setInviteRole(ROLES.COLABORADOR);
            setInviteStationId('');
            setInvitePassword('');
        } else {
            alert(result.message);
        }
    };

    const getRoleColor = (role) => {
        switch (role) {
            case 'ADMIN': return 'var(--primary)';
            case 'LIDER': return 'var(--warning)';
            case 'FUNCIONARIO_POSTO': return 'var(--primary)';
            case 'COLABORADOR': return 'var(--success)';
            default: return 'var(--text-secondary)';
        }
    };

    const getRoleLabel = (role) => {
        switch (role) {
            case 'ADMIN': return 'Administrador';
            case 'LIDER': return 'Líder (Rotas/Mnt)';
            case 'FUNCIONARIO_POSTO': return 'Staff Posto';
            case 'COLABORADOR': return 'Colaborador (Visualização)';
            default: return role;
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Minha Equipe</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Usuários alocados na empresa <strong>{user?.company}</strong></p>
                </div>

                {allowInvite && (
                    <button className="btn btn-primary" onClick={() => { setShowModal(true); setInvitationSent(null); }}>
                        <UserPlus size={18} />
                        <span className="hidden-mobile">Convidar Pessoas</span>
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '0.5rem', color: 'var(--primary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Users size={18} /> Equipe listada abaixo. Integrantes logarão com o email e a senha enviada ou padrão.
                </div>

                {team.map(member => (
                    <div key={member.id} className="glass animate-fade-in" style={{ padding: '1rem 1.5rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: getRoleColor(member.role), color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.125rem' }}>
                                {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p style={{ fontWeight: 'bold' }}>{member.name}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    <Mail size={14} /> {member.email}
                                </div>
                            </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                            <span style={{
                                fontSize: '0.75rem', fontWeight: 'bold', color: getRoleColor(member.role),
                                border: `1px solid ${getRoleColor(member.role)}`, padding: '0.25rem 0.625rem', borderRadius: '1rem'
                            }}>
                                {getRoleLabel(member.role)}
                            </span>
                            {member.station_id && (
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                                    <MapPin size={10} /> {stations.find(s => s.id === member.station_id)?.name || 'Posto vinculado'}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {showModal && allowInvite && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div className="glass animate-slide-up" style={{ width: '100%', maxWidth: '500px', padding: '2rem', borderRadius: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Convidar Membro</h2>

                        {invitationSent ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>
                                <CheckCircle size={48} color="var(--success)" style={{ margin: '0 auto 1rem auto' }} />
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Convite Criado!</h3>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>O usuário foi criado e poderá acessar com as credenciais abaixo:</p>
                                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '1rem', borderRadius: '0.5rem', margin: '1rem 0', textAlign: 'left', border: '1px solid var(--border-color)' }}>
                                    <p><strong>E-mail:</strong> {invitationSent.email}</p>
                                    <p><strong>Senha:</strong> {invitationSent.password}</p>
                                </div>
                                <button className="btn btn-primary" onClick={() => setShowModal(false)} style={{ width: '100%' }}>Fechar</button>
                            </div>
                        ) : (
                            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="input-group">
                                    <label className="input-label">Nome Completo</label>
                                    <input type="text" className="input-field" placeholder="Ex: Roberto Alves" value={inviteName} onChange={e => setInviteName(e.target.value)} required />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">E-mail Corporativo</label>
                                    <input type="email" className="input-field" placeholder="roberto@empresa.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Papel / Nível de Acesso</label>
                                    <select className="input-field" value={inviteRole} onChange={e => { setInviteRole(e.target.value); if (e.target.value !== ROLES.FUNCIONARIO_POSTO) setInviteStationId(''); }} required>
                                        <option value={ROLES.COLABORADOR}>Colaborador Base (Visão Guiada)</option>
                                        <option value={ROLES.LIDER}>Líder / Sub-gestor (Rotas/Mnt)</option>
                                        <option value={ROLES.FUNCIONARIO_POSTO}>Funcionário de Posto (Restrito)</option>
                                        <option value={ROLES.ADMIN}>Co-Administrador (Acesso Total)</option>
                                    </select>
                                </div>

                                {inviteRole === ROLES.FUNCIONARIO_POSTO && (
                                    <div className="input-group animate-slide-up">
                                        <label className="input-label">Selecionar Posto de Trabalho</label>
                                        <select className="input-field" value={inviteStationId} onChange={e => setInviteStationId(e.target.value)} required>
                                            <option value="">Selecione um posto...</option>
                                            {stations.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} - {s.address}</option>
                                            ))}
                                        </select>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                            Este usuário verá apenas os carros deste local.
                                        </p>
                                    </div>
                                )}

                                <div className="input-group">
                                    <label className="input-label">Senha (Opcional)</label>
                                    <input type="text" className="input-field" placeholder="Deixe em branco para auto-gerar" value={invitePassword} onChange={e => setInvitePassword(e.target.value)} />
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                    <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Mail size={18} /> Confirmar Convite</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
