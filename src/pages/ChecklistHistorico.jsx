import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFleet } from '../contexts/FleetContext';
import { ClipboardCheck, Search, Filter, Calendar, User, Car, Eye, X, AlertCircle, Edit2, Trash2, Save, FileSpreadsheet, Download, Gauge, Camera } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import * as XLSX from 'xlsx';

export default function ChecklistHistorico() {
    const { getChecklists } = useFleet();
    const [checklists, setChecklists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
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
        const termMatch = searchTerm === '' ||
            (c.vehicle?.plate && c.vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (c.vehicle?.model && c.vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()));

        const userMatch = userFilter === '' ||
            (c.userName && c.userName.toLowerCase().includes(userFilter.toLowerCase()));

        const dateMatch = dateFilter === '' ||
            (c.created_at && c.created_at.startsWith(dateFilter));

        return termMatch && userMatch && dateMatch;
    });

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', color: 'var(--text-secondary)' }}>
                <div className="animate-pulse">Carregando histórico...</div>
            </div>
        );
    }

    const handleExportExcel = () => {
        try {
            const dataToExport = filteredChecklists.map(c => ({
                'ID': c.id,
                'Data/Hora': new Date(c.created_at).toLocaleString('pt-BR'),
                'Tipo': c.type || 'Saída',
                'Hodômetro (KM)': c.current_km ? `${c.current_km} km` : 'Não Registrado',
                'Veículo (Modelo)': c.vehicle?.model || 'N/A',
                'Placa': c.vehicle?.plate || 'N/A',
                'Responsável': c.userName || 'N/A',

                // Equipamentos
                'Macaco': c.macaco ? 'Sim' : 'Não',
                'Estepe': c.estepe ? 'Sim' : 'Não',
                'Chave de Roda': c.chave_roda ? 'Sim' : 'Não',
                'Triângulo': c.triangulo ? 'Sim' : 'Não',
                'Rádio': c.radio ? 'Sim' : 'Não',
                'Antena': c.antena ? 'Sim' : 'Não',
                'Sem Parar': c.sem_parar ? 'Sim' : 'Não',
                'Tapetes': c.tapetes ? 'Sim' : 'Não',
                'Calotas': c.calotas ? 'Sim' : 'Não',
                'Extintor': c.extintor ? 'Sim' : 'Não',
                'Cartão Ticket Car': c.cartao_ticket_car ? 'Sim' : 'Não',
                'Ar Condicionado': c.ar_condicionado ? 'Sim' : 'Não',
                'CRLV': c.crlv ? 'Sim' : 'Não',
                'Bateria': c.bateria ? 'Sim' : 'Não',
                'Trava': c.trava ? 'Sim' : 'Não',
                'Manual': c.manual ? 'Sim' : 'Não',
                'Giroflex': c.giroflex ? 'Sim' : 'Não',

                // Pneus / Combustível
                'Combustível': c.fuel_level || 'N/A',
                'Pneus Dianteiros': c.pneus_dianteiros || 'N/A',
                'Pneus Traseiros': c.pneus_traseiros || 'N/A',
                'Pneu Estepe': c.pneu_estepe || 'N/A',

                'Observações': c.observations || ''
            }));

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Checklists");
            XLSX.writeFile(workbook, `historico_checklists_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            console.error('Erro ao exportar:', err);
            alert('Erro ao gerar arquivo de exportação.');
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Histórico de Checklists</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Registros de vistorias da frota</p>
            </div>

            <div className="glass" style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                <div style={{ flex: '1 1 250px', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>
                    <Search size={18} color="var(--text-secondary)" />
                    <input type="text" placeholder="Buscar placa ou modelo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', outline: 'none', fontSize: '1rem' }} />
                </div>

                <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>
                    <User size={18} color="var(--text-secondary)" />
                    <input type="text" placeholder="Colaborador..." value={userFilter} onChange={e => setUserFilter(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', outline: 'none', fontSize: '1rem' }} />
                </div>

                <div style={{ flex: '1 1 180px', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>
                    <Calendar size={18} color="var(--text-secondary)" />
                    <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', outline: 'none', cursor: 'pointer', fontSize: '1rem' }} />
                </div>

                <button
                    className="btn btn-outline"
                    onClick={handleExportExcel}
                    style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', borderColor: 'rgba(34, 197, 94, 0.2)', background: 'rgba(34, 197, 94, 0.05)' }}
                >
                    <Download size={18} />
                    <span className="hidden-mobile">Exportar Planilha</span>
                </button>
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
                                        <span style={{
                                            marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 'bold', padding: '0.1rem 0.5rem', borderRadius: '1rem',
                                            backgroundColor: c.type === 'Saída' ? 'var(--primary)' : 'var(--warning)',
                                            color: 'white'
                                        }}>
                                            {c.type || 'Saída'}
                                        </span>
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
        type: checklist.type || 'Saída',
        macaco: checklist.macaco ?? false,
        estepe: checklist.estepe ?? false,
        chave_roda: checklist.chave_roda ?? false,
        triangulo: checklist.triangulo ?? false,
        radio: checklist.radio ?? false,
        antena: checklist.antena ?? false,
        sem_parar: checklist.sem_parar ?? false,
        tapetes: checklist.tapetes ?? false,
        calotas: checklist.calotas ?? false,
        extintor: checklist.extintor ?? false,
        cartao_ticket_car: checklist.cartao_ticket_car ?? false,
        ar_condicionado: checklist.ar_condicionado ?? false,
        crlv: checklist.crlv ?? false,
        bateria: checklist.bateria ?? false,
        trava: checklist.trava ?? false,
        manual: checklist.manual ?? false,
        giroflex: checklist.giroflex ?? false,

        pneus_dianteiros: checklist.pneus_dianteiros || 'Bom',
        pneus_traseiros: checklist.pneus_traseiros || 'Bom',
        pneu_estepe: checklist.pneu_estepe || 'Bom',
        current_km: checklist.current_km || '',

        fuel_level: checklist.fuel_level || 'Vazio',
        observations: checklist.observations || ''
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        const { success, message } = await updateChecklist(checklist.id, formData);
        setIsSaving(false);
        if (success) {
            checklist.type = formData.type;
            checklist.macaco = formData.macaco;
            checklist.estepe = formData.estepe;
            checklist.chave_roda = formData.chave_roda;
            checklist.triangulo = formData.triangulo;
            checklist.radio = formData.radio;
            checklist.antena = formData.antena;
            checklist.sem_parar = formData.sem_parar;
            checklist.tapetes = formData.tapetes;
            checklist.calotas = formData.calotas;
            checklist.extintor = formData.extintor;
            checklist.cartao_ticket_car = formData.cartao_ticket_car;
            checklist.ar_condicionado = formData.ar_condicionado;
            checklist.crlv = formData.crlv;
            checklist.bateria = formData.bateria;
            checklist.trava = formData.trava;
            checklist.manual = formData.manual;
            checklist.giroflex = formData.giroflex;

            checklist.pneus_dianteiros = formData.pneus_dianteiros;
            checklist.pneus_traseiros = formData.pneus_traseiros;
            checklist.pneu_estepe = formData.pneu_estepe;
            checklist.current_km = formData.current_km;

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
                        <DetailItem label="Tipo" value={checklist.type || 'Saída'} icon={<ClipboardCheck size={16} />} color={checklist.type === 'Saída' ? 'var(--primary)' : 'var(--warning)'} />
                        <DetailItem label="KM Registrado" value={checklist.current_km ? `${checklist.current_km} km` : 'N/A'} icon={<Gauge size={16} />} />
                        <DetailItem label="Veículo" value={`${checklist.vehicle?.model} (${checklist.vehicle?.plate})`} icon={<Car size={16} />} />
                        <DetailItem label="Responsável" value={checklist.userName} icon={<User size={16} />} />

                        {/* Grouping Boolean Items */}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Equipamentos (Sim / Não)</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
                                {[
                                    { key: 'macaco', label: 'Macaco' },
                                    { key: 'estepe', label: 'Estepe' },
                                    { key: 'chave_roda', label: 'Chave de Roda' },
                                    { key: 'triangulo', label: 'Triângulo' },
                                    { key: 'radio', label: 'Rádio' },
                                    { key: 'antena', label: 'Antena' },
                                    { key: 'sem_parar', label: 'Sem Parar' },
                                    { key: 'tapetes', label: 'Tapetes' },
                                    { key: 'calotas', label: 'Calotas' },
                                    { key: 'extintor', label: 'Extintor' },
                                    { key: 'cartao_ticket_car', label: 'Cartão Ticket Car' },
                                    { key: 'ar_condicionado', label: 'Ar Condicionado' },
                                    { key: 'crlv', label: 'CRLV' },
                                    { key: 'bateria', label: 'Bateria' },
                                    { key: 'trava', label: 'Trava' },
                                    { key: 'manual', label: 'Manual' },
                                    { key: 'giroflex', label: 'Giroflex' },
                                ].map(item => (
                                    <DetailItem key={item.key} label={item.label} value={checklist[item.key] ? 'Sim' : 'Não'} color={checklist[item.key] ? 'var(--success)' : 'var(--text-secondary)'} />
                                ))}
                            </div>
                        </div>

                        <div style={{ gridColumn: '1 / -1' }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Pneus e Combustível</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
                                <DetailItem label="Nível de Combustível" value={checklist.fuel_level || 'Sem registro'} />
                                <DetailItem label="Pneus Dianteiros" value={checklist.pneus_dianteiros || 'Sem registro'} color={checklist.pneus_dianteiros === 'Ruim' ? 'var(--danger)' : checklist.pneus_dianteiros === 'Médio' ? 'var(--warning)' : 'var(--success)'} />
                                <DetailItem label="Pneus Traseiros" value={checklist.pneus_traseiros || 'Sem registro'} color={checklist.pneus_traseiros === 'Ruim' ? 'var(--danger)' : checklist.pneus_traseiros === 'Médio' ? 'var(--warning)' : 'var(--success)'} />
                                <DetailItem label="Estepe" value={checklist.pneu_estepe || 'Sem registro'} color={checklist.pneu_estepe === 'Ruim' ? 'var(--danger)' : checklist.pneu_estepe === 'Médio' ? 'var(--warning)' : 'var(--success)'} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginBottom: '2rem' }}>

                        <div className="form-group" style={{ maxWidth: '200px' }}>
                            <label>Tipo de Checklist</label>
                            <select className="input" name="type" value={formData.type} onChange={handleChange}>
                                <option value="Saída">Saída</option>
                                <option value="Retorno">Retorno</option>
                            </select>
                        </div>

                        <div className="form-group" style={{ maxWidth: '200px' }}>
                            <label>KM Registrado</label>
                            <input type="number" className="input" name="current_km" value={formData.current_km} onChange={handleChange} />
                        </div>

                        <div>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Equipamentos (Sim / Não)</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                {[
                                    { key: 'macaco', label: 'Macaco' },
                                    { key: 'estepe', label: 'Estepe' },
                                    { key: 'chave_roda', label: 'Chave de Roda' },
                                    { key: 'triangulo', label: 'Triângulo' },
                                    { key: 'radio', label: 'Rádio' },
                                    { key: 'antena', label: 'Antena' },
                                    { key: 'sem_parar', label: 'Sem Parar' },
                                    { key: 'tapetes', label: 'Tapetes' },
                                    { key: 'calotas', label: 'Calotas' },
                                    { key: 'extintor', label: 'Extintor' },
                                    { key: 'cartao_ticket_car', label: 'Cartão Ticket Car' },
                                    { key: 'ar_condicionado', label: 'Ar Condicionado' },
                                    { key: 'crlv', label: 'CRLV' },
                                    { key: 'bateria', label: 'Bateria' },
                                    { key: 'trava', label: 'Trava' },
                                    { key: 'manual', label: 'Manual' },
                                    { key: 'giroflex', label: 'Giroflex' },
                                ].map(item => (
                                    <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ fontSize: '0.875rem' }}>{item.label}</label>
                                        <select className="input" name={item.key} value={formData[item.key]} onChange={(e) => setFormData(p => ({ ...p, [item.key]: e.target.value === 'true' }))} style={{ width: 'auto', padding: '0.25rem 0.5rem' }}>
                                            <option value="true">Sim</option>
                                            <option value="false">Não</option>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Pneus e Combustível</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Nível de Combustível</label>
                                    <select className="input" name="fuel_level" value={formData.fuel_level} onChange={handleChange}>
                                        {['Vazio', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8', 'Cheio'].map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Pneus Dianteiros</label>
                                    <select className="input" name="pneus_dianteiros" value={formData.pneus_dianteiros} onChange={handleChange}>
                                        <option value="Bom">Bom</option>
                                        <option value="Médio">Médio</option>
                                        <option value="Ruim">Ruim</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Pneus Traseiros</label>
                                    <select className="input" name="pneus_traseiros" value={formData.pneus_traseiros} onChange={handleChange}>
                                        <option value="Bom">Bom</option>
                                        <option value="Médio">Médio</option>
                                        <option value="Ruim">Ruim</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Estepe</label>
                                    <select className="input" name="pneu_estepe" value={formData.pneu_estepe} onChange={handleChange}>
                                        <option value="Bom">Bom</option>
                                        <option value="Médio">Médio</option>
                                        <option value="Ruim">Ruim</option>
                                    </select>
                                </div>
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

                {checklist.km_photo && (
                    <div style={{ marginBottom: '2rem', opacity: isEditing ? 0.5 : 1 }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Camera size={18} /> Foto do Painel (Hodômetro) {isEditing && "(Somente Leitura)"}
                        </h3>
                        <div style={{ background: 'white', borderRadius: '0.5rem', border: '1px solid var(--border-color)', padding: '0.5rem', maxWidth: '400px' }}>
                            <img src={checklist.km_photo} alt="Painel do Veículo" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '0.25rem' }} />
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
