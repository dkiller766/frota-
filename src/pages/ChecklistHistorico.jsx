import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFleet } from '../contexts/FleetContext';
import { ClipboardCheck, Search, Filter, Calendar, User, Car, Eye, X, AlertCircle, Edit2, Trash2, Save } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

export default function ChecklistHistorico() {
    const { getChecklists } = useFleet();
    const [checklists, setChecklists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChecklist, setSelectedChecklist] = useState(null);

    useEffect(() => {
        const fetchChecklists = async () => {
            setLoading(true);
            const data = await getChecklists();
            setChecklists(data);
            setLoading(false);
        };
        fetchChecklists();

        // Listen for new checklists
        const channel = supabase
            .channel('checklists-changes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'checklists' },
                () => {
                    console.log('New checklist inserted, refreshing...');
                    fetchChecklists();
                }
            )
            .subscribe();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    const filteredChecklists = checklists.filter(c => {
        const plateMatch = c.vehicle?.plate ? c.vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const modelMatch = c.vehicle?.model ? c.vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const userMatch = c.userName ? c.userName.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        return plateMatch || modelMatch || userMatch;
    });

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', color: 'var(--text-secondary)' }}>
                <div className="animate-pulse">Carregando histórico...</div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Histórico de Checklists</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Registros de vistorias da frota</p>
            </div>

            <div className="glass" style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Search size={20} color="var(--text-secondary)" />
                <input
                    type="text"
                    placeholder="Pesquisar por placa, modelo ou usuário..."
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', outline: 'none', fontSize: '1rem' }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                {filteredChecklists.length > 0 ? (
                    filteredChecklists.map(c => (
                        <div key={c.id} className="glass" style={{ padding: '1rem', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                                    <ClipboardCheck size={24} />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{c.vehicle?.model}</span>
                                        <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>({c.vehicle?.plate})</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Calendar size={14} /> {new Date(c.created_at).toLocaleDateString('pt-BR')} {new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <User size={14} /> {c.userName}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                className="btn btn-ghost"
                                style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                onClick={() => setSelectedChecklist(c)}
                            >
                                <Eye size={18} />
                                <span className="hidden-mobile">Ver Detalhes</span>
                            </button>
                        </div>
                    ))
                ) : (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                        <ClipboardCheck size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <p>Nenhum checklist encontrado.</p>
                    </div>
                )}
            </div>

            {selectedChecklist && (
                <ChecklistDetailModal
                    checklist={selectedChecklist}
                    onClose={() => {
                        setSelectedChecklist(null);
                        getChecklists().then(setChecklists); // Refresh parent data when closing modal
                    }}
                />
            )}
        </div>
    );
}

function ChecklistDetailModal({ checklist, onClose }) {
    const { user } = useAuth();
    const { updateChecklist, deleteChecklist } = useFleet();
    const isAdmin = user?.role === 'ADMIN';

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        tires: checklist.tires || '',
        oil: checklist.oil || '',
        cleanliness: checklist.cleanliness || '',
        windows_mirrors: checklist.windows_mirrors || '',
        lights: checklist.lights ?? true,
        fuel_level: checklist.fuel_level || '',
        observations: checklist.observations || ''
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        const { success, message } = await updateChecklist(checklist.id, formData);
        setIsSaving(false);
        if (success) {
            // Update local state temporarily so it reflects without refetching inside modal immediately
            checklist.tires = formData.tires;
            checklist.oil = formData.oil;
            checklist.cleanliness = formData.cleanliness;
            checklist.windows_mirrors = formData.windows_mirrors;
            checklist.lights = formData.lights;
            checklist.fuel_level = formData.fuel_level;
            checklist.observations = formData.observations;
            setIsEditing(false);
        } else {
            alert('Erro ao salvar: ' + message);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Tem certeza que deseja excluir este checklist permanentemente?')) return;
        setIsDeleting(true);
        const { success, message } = await deleteChecklist(checklist.id);
        setIsDeleting(false);
        if (success) {
            onClose();
        } else {
            alert('Erro ao excluir: ' + message);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
            <div className="glass animate-slide-up" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', borderRadius: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Detalhes do Checklist</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Realizado em {new Date(checklist.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {isAdmin && !isEditing && (
                            <>
                                <button className="btn btn-ghost" onClick={() => setIsEditing(true)} style={{ color: 'var(--primary)', padding: '0.5rem' }} title="Editar">
                                    <Edit2 size={20} />
                                </button>
                                <button className="btn btn-ghost" onClick={handleDelete} disabled={isDeleting} style={{ color: 'var(--danger)', padding: '0.5rem' }} title="Excluir">
                                    <Trash2 size={20} />
                                </button>
                            </>
                        )}
                        {isEditing && (
                            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
                                <Save size={18} /> Salvar
                            </button>
                        )}
                        <button className="btn btn-ghost" onClick={onClose} style={{ padding: '0.5rem' }} title="Fechar"><X size={24} /></button>
                    </div>
                </div>

                {!isEditing ? (
                    <div className="detail-grid-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        <DetailItem label="Veículo" value={`${checklist.vehicle?.model} (${checklist.vehicle?.plate})`} icon={<Car size={16} />} />
                        <DetailItem label="Responsável" value={checklist.userName} icon={<User size={16} />} />
                        <DetailItem label="Pneus" value={checklist.tires} color={checklist.tires === 'Ruim' ? 'var(--danger)' : 'var(--success)'} />
                        <DetailItem label="Óleo" value={checklist.oil} color={checklist.oil === 'Baixo' ? 'var(--danger)' : 'var(--success)'} />
                        <DetailItem label="Limpeza" value={checklist.cleanliness} />
                        <DetailItem label="Vidros/Espelhos" value={checklist.windows_mirrors} />
                        <DetailItem label="Luzes" value={checklist.lights ? 'Funcionando' : 'Avariadas'} color={!checklist.lights ? 'var(--danger)' : 'var(--success)'} />
                        <DetailItem label="Combustível" value={checklist.fuel_level} />
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Pneus</label>
                                <select className="input" name="tires" value={formData.tires} onChange={handleChange}>
                                    <option value="Bom">Bom</option>
                                    <option value="Regular">Regular</option>
                                    <option value="Ruim">Ruim</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Óleo</label>
                                <select className="input" name="oil" value={formData.oil} onChange={handleChange}>
                                    <option value="Normal">Normal</option>
                                    <option value="Baixo">Baixo</option>
                                    <option value="Necessita Troca">Necessita Troca</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Limpeza</label>
                                <select className="input" name="cleanliness" value={formData.cleanliness} onChange={handleChange}>
                                    <option value="Limpo">Limpo</option>
                                    <option value="Sujo">Sujo</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Vidros e Espelhos</label>
                                <select className="input" name="windows_mirrors" value={formData.windows_mirrors} onChange={handleChange}>
                                    <option value="Intactos">Intactos</option>
                                    <option value="Danificados">Danificados</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Luzes</label>
                                <select className="input" name="lights" value={formData.lights} onChange={(e) => setFormData(prev => ({ ...prev, lights: e.target.value === 'true' }))}>
                                    <option value="true">Todas Funcionando</option>
                                    <option value="false">Verificado Avarias</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Nível de Combustível</label>
                                <select className="input" name="fuel_level" value={formData.fuel_level} onChange={handleChange}>
                                    <option value="Cheio">Cheio (1/1)</option>
                                    <option value="3/4">3/4</option>
                                    <option value="Meio">Meio (1/2)</option>
                                    <option value="1/4">1/4</option>
                                    <option value="Reserva">Reserva</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Observações</label>
                            <textarea
                                className="input"
                                name="observations"
                                rows="3"
                                value={formData.observations}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                )}

                {checklist.damages_diagram && (
                    <div style={{ marginBottom: '2rem', opacity: isEditing ? 0.5 : 1 }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={18} /> Diagrama de Avarias {isEditing && "(Somente Leitura)"}
                        </h3>
                        <div style={{ background: 'white', borderRadius: '0.5rem', border: '1px solid var(--border-color)', padding: '0.5rem' }}>
                            <img src={checklist.damages_diagram} alt="Diagrama de Avarias" style={{ width: '100%', height: 'auto', display: 'block' }} />
                        </div>
                    </div>
                )}

                {!isEditing && checklist.observations && (
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Observações</h3>
                        <p style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                            {checklist.observations}
                        </p>
                    </div>
                )}

                {checklist.signature && (
                    <div style={{ marginBottom: '2rem', opacity: isEditing ? 0.5 : 1 }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Assinatura do Responsável {isEditing && "(Somente Leitura)"}
                        </h3>
                        <div style={{ background: 'white', borderRadius: '0.5rem', border: '1px solid var(--border-color)', padding: '0.5rem', maxWidth: '300px' }}>
                            <img src={checklist.signature} alt="Assinatura" style={{ width: '100%', height: 'auto', display: 'block' }} />
                        </div>
                    </div>
                )}

                {!isEditing && <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>Fechar</button>}
            </div>
        </div>
    );
}

function DetailItem({ label, value, icon, color }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {icon} {label}
            </span>
            <span style={{ fontSize: '1rem', fontWeight: '500', color: color || 'var(--text-primary)' }}>{value}</span>
        </div>
    );
}
