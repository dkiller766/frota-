import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFleet } from '../contexts/FleetContext';
import { canManageMaintenance } from '../utils/permissions';
import { Wrench, Car, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Manutencoes() {
    const { user } = useAuth();
    const allowManage = canManageMaintenance(user?.role);
    const { vehicles, loading, finishMaintenance } = useFleet();

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', color: 'var(--text-secondary)' }}>
                <div className="animate-pulse">Carregando manutenções...</div>
            </div>
        );
    }

    // Filtrar todos que estão em manutenção
    let brokenCars = vehicles.filter(v => v.status === 'MANUTENÇÃO');

    // Se for funcionário de posto, vê apenas os do seu posto
    if (user?.role === 'FUNCIONARIO_POSTO' && user?.station_id) {
        brokenCars = brokenCars.filter(v => v.stationId === user.station_id);
    }

    if (!allowManage) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
                <h2 style={{ color: 'var(--danger)' }}>Acesso Negado</h2>
                <p>Você não possui permissão para gerenciar as manutenções da frota.</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Central de Reparos</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Acompanhamento de veículos na mecânica</p>
                </div>

                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={20} />
                    {brokenCars.length} Avariado(s)
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {brokenCars.length === 0 ? (
                    <div className="glass" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', borderRadius: '1rem', border: '1px dashed var(--border-color)' }}>
                        <Wrench size={48} color="var(--success)" style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}>Tudo em Ordem!</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Nenhum veículo encontra-se em estado de manutenção no momento.</p>
                        <Link to="/veiculos" className="btn btn-outline" style={{ marginTop: '1.5rem' }}>
                            Ver Frota Completa
                        </Link>
                    </div>
                ) : (
                    brokenCars.map(v => (
                        <div key={v.id} className="glass animate-fade-in" style={{ padding: '1.5rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '0.75rem' }}>
                                        <Wrench size={28} color="var(--danger)" />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>{v.model}</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '1rem', marginTop: '0.25rem' }}>{v.plate}</p>
                                    </div>
                                </div>
                            </div>

                            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                                <strong style={{ color: 'var(--danger)', display: 'block', marginBottom: '0.25rem' }}>Motivo Reportado:</strong>
                                {v.maintenanceReason || 'Motivo de reparo não especificado pelo sistema.'}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                <span>KM Atual: {v.currentKm}</span>
                                <span>Pátio Base: {v.stationId ? `ID ${v.stationId}` : 'Nenhum'}</span>
                            </div>

                            {v.maintenanceDate && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: '0.5rem', fontWeight: '500' }}>
                                    <Calendar size={16} /> Data Agendada: {new Date(v.maintenanceDate).toLocaleDateString('pt-BR')}
                                </div>
                            )}

                            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                <button
                                    onClick={() => finishMaintenance(v.id)}
                                    className="btn btn-primary"
                                    style={{ width: '100%', backgroundColor: 'var(--success)', color: 'white', border: 'none' }}
                                >
                                    <CheckCircle size={18} /> Validar Reparo como Concluído
                                </button>
                            </div>

                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
