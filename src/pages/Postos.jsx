import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFleet } from '../contexts/FleetContext';
import { canAddFuelStations } from '../utils/permissions';
import { MapPin, Plus, ExternalLink, Car, ChevronDown, ChevronUp, Edit2, Trash2, FileSpreadsheet, Search, TrendingDown } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Postos() {
    const { user } = useAuth();
    const allowAdd = canAddFuelStations(user?.role);
    const { stations, loading, addStation, editStation, deleteStation, bulkAddStations, getVehiclesByStation } = useFleet();

    const handleImportSpreadsheet = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                if (!XLSX) {
                    throw new Error('Biblioteca de planilhas não carregada. Tente recarregar a página.');
                }

                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
                    throw new Error('Não foi possível ler as abas da planilha. O arquivo pode estar corrompido.');
                }

                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (!rows || rows.length < 2) {
                    alert('O arquivo está vazio ou não possui cabeçalho na primeira linha.');
                    return;
                }

                // Expecting Header: nome, endereco
                const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
                const nameIdx = headers.findIndex(h => h.includes('nome'));
                const addrIdx = headers.findIndex(h => h.includes('endere') || h.includes('endereco') || h.includes('local') || h.includes('morada'));

                if (nameIdx === -1) {
                    alert('Cabeçalho "Nome" não encontrado. Verifique se a primeira linha da planilha contém os nomes das colunas.');
                    return;
                }

                const stationsToImportRaw = rows.slice(1)
                    .filter(row => row[nameIdx] && String(row[nameIdx]).trim())
                    .map(row => ({
                        name: String(row[nameIdx]).trim(),
                        address: row[addrIdx] ? String(row[addrIdx]).trim() : '',
                        partner: false
                    }));

                if (stationsToImportRaw.length === 0) {
                    alert('Nenhum dado válido de posto encontrado após o cabeçalho.');
                    return;
                }

                if (window.confirm(`Deseja importar ${stationsToImportRaw.length} postos? O sistema irá geocodificar os endereços automaticamente.`)) {
                    setLoadingMap(true);
                    const stationsToImport = [];

                    for (const s of stationsToImportRaw) {
                        let latitude = null;
                        let longitude = null;

                        try {
                            // Delay para respeitar rate limit do Nominatim (1 req/sec)
                            if (stationsToImport.length > 0) await new Promise(r => setTimeout(r, 1100));

                            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(s.address)}`);
                            const data = await resp.json();
                            if (data && data.length > 0) {
                                latitude = parseFloat(data[0].lat);
                                longitude = parseFloat(data[0].lon);
                            }
                        } catch (err) {
                            console.error(`Erro ao geocodificar ${s.address}:`, err);
                        }

                        stationsToImport.push({
                            ...s,
                            latitude,
                            longitude
                        });
                    }

                    const result = await bulkAddStations(stationsToImport);
                    if (result.success) {
                        alert('Importação concluída com sucesso!');
                        setShowModal(false);
                    } else {
                        alert('Erro ao salvar no banco de dados: ' + (result.message || 'Erro desconhecido.'));
                    }
                }
            } catch (err) {
                console.error('Erro no processamento da planilha:', err);
                alert('Erro ao processar arquivo: ' + err.message);
            }
        };

        reader.readAsArrayBuffer(file);

        // Reset input
        e.target.value = null;
    };

    const handleExportExcel = () => {
        try {
            const dataToExport = stations.map(s => {
                const vehiclesInStation = getVehiclesByStation(s.id);
                return {
                    'Nome': s.name,
                    'Endereço': s.address || '',
                    'Veículos no Local': vehiclesInStation.length,
                    'Parceiro': s.partner ? 'Sim' : 'Não',
                    'ID Supabase': s.id
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Postos");
            XLSX.writeFile(workbook, `postos_e_patios_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            console.error('Erro ao exportar:', err);
            alert('Erro ao gerar arquivo de exportação.');
        }
    };

    const [showModal, setShowModal] = useState(false);
    const [editingStation, setEditingStation] = useState(null);
    const [loadingMap, setLoadingMap] = useState(false);
    const [newName, setNewName] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [expandedStation, setExpandedStation] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredStations = useMemo(() => {
        if (!searchTerm.trim()) return stations;
        const lowTerm = searchTerm.toLowerCase();
        return stations.filter(s =>
            s.name.toLowerCase().includes(lowTerm) ||
            s.address.toLowerCase().includes(lowTerm)
        );
    }, [stations, searchTerm]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', color: 'var(--text-secondary)' }}>
                <div className="animate-pulse">Carregando postos...</div>
            </div>
        );
    }

    const openAddModal = () => {
        setEditingStation(null);
        setNewName('');
        setNewAddress('');
        setShowModal(true);
    };

    const openEditModal = (station) => {
        setEditingStation(station.id);
        setNewName(station.name);
        setNewAddress(station.address);
        setShowModal(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('Tem certeza que deseja excluir este posto? Os veículos associados a ele ficarão sem pátio.')) {
            deleteStation(id);
        }
    };

    const handleAddStation = async (e) => {
        e.preventDefault();
        if (!allowAdd) return;

        setLoadingMap(true);
        try {
            const isEditing = !!editingStation;
            const currentStation = isEditing ? stations.find(s => s.id === editingStation) : null;
            let position = null;

            if (!isEditing || currentStation?.address !== newAddress) {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newAddress)}`);
                const data = await response.json();

                position = [-23.550520, -46.633308]; // Default SP
                if (data && data.length > 0) {
                    position = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                } else {
                    alert('Endereço não encontrado com precisão no mapa. Usando localização padrão.');
                }
            }

            if (isEditing) {
                const updateData = { name: newName, address: newAddress };
                if (position) updateData.position = position;
                editStation(editingStation, updateData);
            } else {
                addStation({ name: newName, address: newAddress, partner: false, position });
            }

            setShowModal(false);
            setNewName('');
            setNewAddress('');
            setEditingStation(null);
        } catch (error) {
            console.error('Erro ao buscar endereço:', error);
            alert('Erro de conexão ao buscar endereço.');
        } finally {
            setLoadingMap(false);
        }
    };

    const toggleExpand = (stationId) => {
        if (expandedStation === stationId) {
            setExpandedStation(null);
        } else {
            setExpandedStation(stationId);
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Postos e Pátios</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Controle de pontos autorizados e veículos fixados</p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {allowAdd && (
                        <>
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                style={{ display: 'none' }}
                                id="import-stations-input"
                                onChange={(e) => handleImportSpreadsheet(e)}
                            />
                            <button
                                className="btn btn-outline"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                onClick={() => document.getElementById('import-stations-input').click()}
                                disabled={loading || loadingMap}
                            >
                                <FileSpreadsheet size={18} />
                                <span className="hidden-mobile">{loadingMap ? 'Importando...' : 'Importar Planilha'}</span>
                            </button>

                            <button
                                className="btn btn-outline"
                                onClick={handleExportExcel}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    color: 'var(--success)',
                                    borderColor: 'rgba(34, 197, 94, 0.2)',
                                    background: 'rgba(34, 197, 94, 0.05)'
                                }}
                            >
                                <TrendingDown size={18} style={{ transform: 'rotate(-45deg)' }} />
                                <span className="hidden-mobile">Exportar</span>
                            </button>

                            <button className="btn btn-primary" onClick={openAddModal}>
                                <Plus size={18} />
                                <span className="hidden-mobile">Novo Posto</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Barra de Pesquisa */}
            <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                    type="text"
                    placeholder="Pesquisar postos por nome ou endereço..."
                    className="glass"
                    style={{
                        width: '100%',
                        padding: '0.75rem 1rem 0.75rem 3rem',
                        borderRadius: '0.75rem',
                        border: '1px solid var(--border-color)',
                        outline: 'none',
                        fontSize: '0.875rem'
                    }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {
                loadingMap && (
                    <div className="glass animate-fade-in" style={{ padding: '1rem', marginBottom: '2rem', borderRadius: '1rem', border: '1px solid var(--primary)', textAlign: 'center', background: 'rgba(var(--primary-rgb), 0.1)' }}>
                        <p style={{ fontWeight: 'bold', color: 'var(--primary)' }}>Geocodificando endereços... por favor aguarde</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Convertendo locais para o mapa em tempo real.</p>
                    </div>
                )
            }

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', paddingBottom: '2rem' }}>
                {filteredStations.length === 0 ? (
                    <div className="glass" style={{ padding: '3rem', textAlign: 'center', borderRadius: '1rem', color: 'var(--text-secondary)' }}>
                        <p>Nenhum posto encontrado com os critérios de busca.</p>
                    </div>
                ) : (
                    filteredStations.map(station => {
                        const parkings = getVehiclesByStation(station.id);
                        const isExpanded = expandedStation === station.id;

                        return (
                            <div key={station.id} className="glass animate-fade-in" style={{ padding: '1.5rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '0.75rem', border: `1px solid ${station.partner ? 'var(--success)' : 'var(--warning)'}` }}>
                                            <MapPin size={28} color={station.partner ? 'var(--success)' : 'var(--warning)'} />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {station.name}
                                            </h3>
                                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{station.address}</p>
                                            {station.partner ? (
                                                <span style={{ display: 'inline-block', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontSize: '0.65rem', fontWeight: '600', marginTop: '0.5rem' }}>
                                                    Parceiro Oficial
                                                </span>
                                            ) : (
                                                <span style={{ display: 'inline-block', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontSize: '0.65rem', fontWeight: '600', marginTop: '0.5rem' }}>
                                                    Posto Independente
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ textAlign: 'center', marginRight: '1rem' }}>
                                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)', lineHeight: 1 }}>{parkings.length}</p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Carros no local</p>
                                        </div>
                                        {allowAdd && (
                                            <>
                                                <button onClick={() => openEditModal(station)} className="btn btn-ghost" style={{ padding: '0.5rem', color: 'var(--primary)' }} title="Editar">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(station.id)} className="btn btn-ghost" style={{ padding: '0.5rem', color: 'var(--danger)' }} title="Excluir">
                                                    <Trash2 size={18} />
                                                </button>
                                            </>
                                        )}
                                        <button onClick={() => toggleExpand(station.id)} className="btn btn-ghost" style={{ padding: '0.5rem' }}>
                                            {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Accordion Listagem de Carros */}
                                {isExpanded && (
                                    <div className="animate-slide-up" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                        <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                                            <Car size={16} /> Veículos Estacionados
                                        </h4>
                                        {parkings.length > 0 ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                                {parkings.map(v => (
                                                    <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                                                        <div>
                                                            <p style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>{v.model}</p>
                                                            <p style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{v.plate}</p>
                                                        </div>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: v.status === 'OPERACIONAL' ? 'var(--success)' : v.status === 'MANUTENÇÃO' ? 'var(--danger)' : 'var(--primary)' }}>
                                                            {v.status}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', border: '1px dashed var(--border-color)', borderRadius: '0.5rem' }}>
                                                Nenhum veículo neste local.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {
                showModal && allowAdd && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                        <div className="glass animate-slide-up" style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '1rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>{editingStation ? 'Editar Posto' : 'Adicionar Posto/Pátio'}</h2>
                            <form onSubmit={handleAddStation} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="input-group">
                                    <label className="input-label">Nome do Estabelecimento</label>
                                    <input type="text" className="input-field" placeholder="Pátio Matriz" value={newName} onChange={e => setNewName(e.target.value)} required />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Endereço / Localização</label>
                                    <input type="text" className="input-field" placeholder="Rua Central, 123" value={newAddress} onChange={e => setNewAddress(e.target.value)} required />
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                    <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loadingMap}>
                                        {loadingMap ? 'Buscando...' : 'Salvar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
