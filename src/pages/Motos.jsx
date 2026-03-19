import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFleet } from '../contexts/FleetContext';
import { canManageVehicles, canManageMaintenance } from '../utils/permissions';
import {
    Bike, Search, Plus, Filter, AlertCircle, TrendingUp, TrendingDown, ClipboardCheck, Edit2, Trash2,
    MapPin, ExternalLink, Calendar, PenTool, LayoutGrid, List, FileSpreadsheet,
    Wrench, CheckCircle, AlertTriangle, Camera, Gauge, FileText, Upload, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';

export default function Motos() {
    const { user } = useAuth();
    const { vehicles, stations, loading, addVehicle, bulkAddVehicles, editVehicle, deleteVehicle, updateVehicleKM, requestMaintenance, finishMaintenance, refreshData } = useFleet();

    const allowAdd = canManageVehicles(user?.role);
    const allowMaintenance = canManageMaintenance(user?.role);

    const [showModal, setShowModal] = useState(false);
    const [editingMoto, setEditingMoto] = useState(null);
    const [showKmModal, setShowKmModal] = useState(null); // id do veiculo pra atualizar km
    const [showMntModal, setShowMntModal] = useState(null); // id do veiculo
    const [searchTerm, setSearchTerm] = useState('');
    const [showChecklistModal, setShowChecklistModal] = useState(null); // id do veiculo

    // Estados do Modal Cadastro
    const [newPlate, setNewPlate] = useState('');
    const [newModel, setNewModel] = useState('');
    const [newPrefix, setNewPrefix] = useState('');
    const [newArea, setNewArea] = useState('');
    const [newStationId, setNewStationId] = useState('');
    const [newInitialKm, setNewInitialKm] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // Estado Modal MNT
    const [mntReason, setMntReason] = useState('');
    const [mntDate, setMntDate] = useState('');

    // Estado Modal KM
    const [kmValue, setKmValue] = useState('');
    const [kmPhoto, setKmPhoto] = useState(null);
    const fileInputRef = useRef(null);
    const fileImportRef = useRef(null);
    const [loadingImport, setLoadingImport] = useState(false);

    const filteredMotos = React.useMemo(() => {
        let list = vehicles.filter(v => v.type === 'MOTO');

        // Filtro por Posto se for Funcionário de Posto
        if (user?.role === 'FUNCIONARIO_POSTO' && user?.station_id) {
            list = list.filter(v => v.stationId === user.station_id);
        }

        if (!searchTerm.trim()) return list;
        const lowTerm = searchTerm.toLowerCase();
        return list.filter(v =>
            (v.plate && v.plate.toLowerCase().includes(lowTerm)) ||
            (v.model && v.model.toLowerCase().includes(lowTerm)) ||
            (v.prefix && v.prefix.toLowerCase().includes(lowTerm))
        );
    }, [vehicles, searchTerm, user?.role, user?.station_id]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', color: 'var(--text-secondary)' }}>
                <div className="animate-pulse">Carregando frota...</div>
            </div>
        );
    }

    const openAddModal = () => {
        setEditingMoto(null);
        setNewPlate('');
        setNewModel('');
        setNewPrefix('');
        setNewArea('');
        setNewStationId('');
        setNewInitialKm('');
        setErrorMsg('');
        setShowModal(true);
    };

    const openEditModal = (v) => {
        setEditingMoto(v.id);
        setNewPlate(v.plate || '');
        setNewModel(v.model || '');
        setNewPrefix(v.prefix || '');
        setNewArea(v.area || '');
        setNewStationId(v.stationId || '');
        setNewInitialKm(v.currentKm !== null && v.currentKm !== undefined ? v.currentKm : 0);
        setShowModal(true);
    };



    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoadingImport(true);
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
                    setLoadingImport(false);
                    return;
                }

                // Header Detection (Normalized)
                const normalize = (str) => String(str || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const headers = rows[0].map(h => normalize(h));

                const plateIdx = headers.findIndex(h => h.includes('placa'));
                const modelIdx = headers.findIndex(h => h.includes('modelo'));
                const prefixIdx = headers.findIndex(h => h.includes('prefixo') || h.includes('pref'));
                const areaIdx = headers.findIndex(h => h.includes('area') || h.includes('territorio') || h.includes('setor') || h.includes('unidade'));
                const kmIdx = headers.findIndex(h => h.includes('km') || h.includes('quilometragem') || h.includes('hodo'));
                const revisionIdx = headers.findIndex(h => h.includes('revisao'));
                const stationIdx = headers.findIndex(h => h.includes('posto') || h.includes('patio'));

                if (plateIdx === -1 || modelIdx === -1) {
                    alert('Cabeçalhos inválidos. A planilha deve conter ao menos "placa" e "modelo".');
                    setLoadingImport(false);
                    return;
                }

                const motosToImport = rows.slice(1)
                    .filter(row => row[plateIdx] && String(row[plateIdx]).trim() && row[modelIdx] && String(row[modelIdx]).trim())
                    .map(row => {
                        const currentKm = Number(String(row[kmIdx] || '').replace(/[^\d]/g, '')) || 0;
                        const defaultRev = currentKm + 10000;
                        const revKm = revisionIdx !== -1 ? (Number(String(row[revisionIdx] || '').replace(/[^\d]/g, '')) || defaultRev) : defaultRev;

                        const stationRef = row[stationIdx] ? String(row[stationIdx]).trim() : null;
                        let matchedStationId = null;

                        if (stationRef) {
                            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                            if (uuidRegex.test(stationRef)) {
                                matchedStationId = stationRef;
                            } else {
                                const station = (stations || []).find(s => normalize(s.name) === normalize(stationRef));
                                if (station) matchedStationId = station.id;
                            }
                        }

                        return {
                            plate: String(row[plateIdx]).trim().toUpperCase().replace(/[^A-Z0-9]/g, ''),
                            model: String(row[modelIdx]).trim(),
                            prefix: prefixIdx !== -1 ? String(row[prefixIdx]).trim() : null,
                            area: areaIdx !== -1 ? String(row[areaIdx]).trim() : null,
                            current_mileage: currentKm,
                            next_maintenance_mileage: revKm,
                            current_station_id: matchedStationId,
                            type: 'MOTO'
                        };
                    });

                if (motosToImport.length === 0) {
                    alert('Nenhum dado válido de moto encontrado após o cabeçalho.');
                } else if (window.confirm(`Deseja importar ${motosToImport.length} motos?`)) {
                    const result = await bulkAddVehicles(motosToImport);
                    if (result.success) {
                        alert('Importação concluída com sucesso!');
                    } else {
                        alert('Erro ao salvar no banco de dados: ' + (result.message || 'Verifique o formato dos dados.'));
                    }
                }
            } catch (err) {
                console.error('Erro no processamento da planilha:', err);
                alert('Erro ao processar arquivo: ' + err.message);
            } finally {
                setLoadingImport(false);
            }
        };

        reader.readAsArrayBuffer(file);
        e.target.value = null;
    };

    const handleExportExcel = () => {
        try {
            const dataToExport = filteredMotos.map(v => ({
                'Placa': v.plate,
                'Modelo': v.model,
                'Prefixo': v.prefix || '',
                'Área/Território': v.area || '',
                'Status': v.status,
                'KM Atual': v.currentKm,
                'Proxima Revisao': v.revisionKm,
                'Posto/Patio': (stations || []).find(s => s.id === v.stationId)?.name || 'Nenhum'
            }));

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Veiculos");
            XLSX.writeFile(workbook, `frota_veiculos_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            console.error('Erro ao exportar:', err);
            alert('Erro ao gerar arquivo de exportação.');
        }
    };

    const handleDelete = (id) => {
        if (window.confirm('Tem certeza que deseja excluir o registro deste moto da frota?')) {
            deleteVehicle(id);
        }
    };

    const handleSaveVehicle = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!allowAdd) {
            setErrorMsg('Você não tem permissão para cadastrar ou editar.');
            return;
        }

        const initialKmNum = Number(newInitialKm) || 0;
        let result = null;

        try {
            if (editingMoto) {
                result = await editVehicle(editingMoto, {
                    plate: newPlate.toUpperCase(),
                    model: newModel,
                    prefix: newPrefix || null,
                    area: newArea || null,
                    stationId: newStationId || null,
                    currentKm: initialKmNum,
                    type: 'MOTO'
                });
            } else {
                result = await addVehicle({
                    plate: newPlate.toUpperCase(),
                    model: newModel,
                    prefix: newPrefix || null,
                    area: newArea || null,
                    stationId: newStationId || null,
                    currentKm: initialKmNum,
                    revisionKm: initialKmNum + 10000,
                    lastMaintenance: 'Nunca',
                    type: 'MOTO'
                });
            }

            if (result && result.success) {
                setShowModal(false);
                setNewPlate('');
                setNewModel('');
                setNewPrefix('');
                setNewArea('');
                setNewStationId('');
                setNewInitialKm('');
                setEditingMoto(null);
            } else {
                setErrorMsg('Falha do Servidor: ' + (result?.message || 'Erro RLS Desconhecido'));
            }
        } catch (error) {
            console.error('Erro Catastrófico ao Salvar Moto:', error);
            setErrorMsg('Falha Crítica do App: ' + error.message);
        }
    };

    const handleUpdateKM = (e) => {
        e.preventDefault();
        updateVehicleKM(showKmModal, kmValue, kmPhoto);
        setShowKmModal(null);
        setKmValue('');
        setKmPhoto(null);
    };

    const [ocrProcessing, setOcrProcessing] = useState(false);

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const imageUrl = URL.createObjectURL(file);
            setKmPhoto(imageUrl);
            setOcrProcessing(true);

            try {
                // Tesseract OCR pra extrair números
                const result = await Tesseract.recognize(file, 'eng', {
                    logger: (m) => console.log(m),
                });

                // Pega apenas números do resultado
                const text = result.data.text;
                const numbersOnly = text.replace(/\D/g, '');

                if (numbersOnly && numbersOnly.length > 0) {
                    setKmValue(numbersOnly);
                    alert(`Leitura Automática: ${numbersOnly} km identificados. (Verifique se está correto)`);
                } else {
                    alert('Não foi possível ler o KM na imagem. Por favor, digite manualmente.');
                }
            } catch (err) {
                console.error("Erro no OCR:", err);
                alert('Erro ao processar imagem.');
            } finally {
                setOcrProcessing(false);
            }
        }
    };

    const submitMaintenance = (e) => {
        e.preventDefault();
        if (!mntReason || !mntDate) return;
        requestMaintenance(showMntModal, mntReason, mntDate);
        setShowMntModal(null);
        setMntReason('');
        setMntDate('');
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'OPERACIONAL': return 'var(--success)';
            case 'EM ROTA': return 'var(--primary)';
            case 'MANUTENÇÃO': return 'var(--danger)';
            default: return 'var(--text-secondary)';
        }
    };

    const renderKmAlerts = (v) => {
        const diff = v.revisionKm - v.currentKm;
        if (diff <= 0) {
            return <span style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 'bold' }}>⚠️ Revisão Vencida!</span>;
        }
        if (diff <= 1000) {
            return <span style={{ color: 'var(--warning)', fontSize: '0.75rem', fontWeight: 'bold' }}>⚠️ Revisão Próxima (Faltam {diff}km)</span>;
        }
        return <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>Próx. Rev: {v.revisionKm}km</span>;
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
            {/* Modal Checklist */}
            {showChecklistModal && (
                <ChecklistModal
                    vehicleId={showChecklistModal}
                    onClose={() => setShowChecklistModal(null)}
                />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Frota de Motos</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Controle de motocicletas unificado</p>
                </div>

                {allowAdd && (
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            ref={fileImportRef}
                            style={{ display: 'none' }}
                            onChange={handleImportExcel}
                        />
                        <button
                            className="btn btn-outline"
                            onClick={() => fileImportRef.current.click()}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: 'var(--primary)',
                                borderColor: 'rgba(59, 130, 246, 0.2)',
                                background: 'rgba(59, 130, 246, 0.05)'
                            }}
                            disabled={loadingImport}
                        >
                            <FileSpreadsheet size={18} />
                            <span>{loadingImport ? 'Processando...' : 'Importar Excel'}</span>
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
                            <span>Exportar</span>
                        </button>
                        <button className="btn btn-primary" onClick={openAddModal}>
                            <Plus size={18} />
                            <span className="hidden-mobile">Nova Moto</span>
                        </button>
                    </div>
                )}
            </div>

            {/* BARRA DE PESQUISA */}
            <div className="glass" style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Search size={20} color="var(--text-secondary)" />
                <input
                    type="text"
                    placeholder="Pesquisar por placa, modelo ou prefixo..."
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', outline: 'none', fontSize: '1rem' }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', paddingBottom: '2rem' }}>
                {filteredMotos.length > 0 ? (
                    filteredMotos.map(v => (
                        <div key={v.id} className="glass animate-fade-in" style={{ padding: '1.5rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* ... (conteúdo do card mantido) */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {v.prefix && <span style={{ backgroundColor: 'var(--primary)', color: 'white', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontWeight: 'bold' }}>{v.prefix}</span>}
                                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>{v.model}</h3>
                                    </div>
                                    <p style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '1rem', marginTop: '0.25rem' }}>{v.plate}</p>
                                    {v.area && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                            <LayoutGrid size={12} />
                                            <span>{v.area}</span>
                                        </div>
                                    )}
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '0.5rem', border: `1px solid ${getStatusColor(v.status)}` }}>
                                    <Bike size={24} color={getStatusColor(v.status)} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getStatusColor(v.status) }} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: getStatusColor(v.status) }}>{v.status}</span>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', fontWeight: '600' }}>
                                    <MapPin size={14} color="var(--text-secondary)" />
                                    {v.stationId ? ((stations || []).find(s => s.id === v.stationId)?.name || 'Posto Desconhecido') : 'Rota/Sem Patio'}
                                </div>

                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
                                    {allowAdd && (
                                        <>
                                            <button onClick={() => openEditModal(v)} className="btn btn-ghost" style={{ padding: '0.25rem', color: 'var(--primary)' }} title="Editar">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(v.id)} className="btn btn-ghost" style={{ padding: '0.25rem', color: 'var(--danger)' }} title="Excluir">
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Gauge size={14} /> Hodometro Atual
                                    </span>
                                    <span style={{ fontWeight: 'bold' }}>{v.currentKm} km</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    {renderKmAlerts(v)}
                                </div>
                            </div>

                            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <button
                                    onClick={() => { setShowKmModal(v.id); setKmValue(v.currentKm); }}
                                    className="btn btn-ghost"
                                    style={{ width: '100%', fontSize: '0.75rem', padding: '0.5rem' }}
                                >
                                    <Camera size={16} /> Lançar KM / Bater Foto
                                </button>

                                <button
                                    onClick={() => setShowChecklistModal(v.id)}
                                    className="btn btn-outline"
                                    style={{ width: '100%', fontSize: '0.75rem', padding: '0.5rem', marginTop: '0.25rem' }}
                                >
                                    <ClipboardCheck size={16} /> Realizar Checklist
                                </button>

                                {allowMaintenance && (
                                    <>
                                        {v.status !== 'MANUTENÇÃO' ? (
                                            <button
                                                onClick={() => setShowMntModal(v.id)}
                                                className="btn btn-outline"
                                                style={{ width: '100%', color: 'var(--warning)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                                            >
                                                <AlertTriangle size={18} /> Solicitar Manutenção
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => finishMaintenance(v.id)}
                                                className="btn btn-primary"
                                                style={{ width: '100%', backgroundColor: 'var(--success)' }}
                                            >
                                                <CheckCircle size={18} /> Finalizar Reparo (+10k rev)
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                        <Bike size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <p>{searchTerm ? 'Nenhuma moto encontrada para esta busca.' : 'Nenhuma moto cadastrada na frota.'}</p>
                    </div>
                )}
            </div>

            {/* Modal Simples de Cadastro */}
            {showModal && allowAdd && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="glass animate-slide-up" style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>{editingMoto ? 'Editar Moto' : 'Nova Moto'}</h2>
                        {errorMsg && (
                            <div style={{ padding: '0.75rem', marginBottom: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                                {errorMsg}
                            </div>
                        )}
                        <form onSubmit={handleSaveVehicle} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div className="input-group">
                                <label className="input-label">Placa da Moto</label>
                                <input type="text" className="input-field" placeholder="ABC-1234" value={newPlate} onChange={e => setNewPlate(e.target.value)} required maxLength={8} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Prefixo (Opcional)</label>
                                <input type="text" className="input-field" placeholder="Ex: TX-01" value={newPrefix} onChange={e => setNewPrefix(e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Area / Territorio</label>
                                <input
                                    type="text"
                                    list="areas-list"
                                    className="input-field"
                                    placeholder="Selecione ou digite..."
                                    value={newArea}
                                    onChange={e => setNewArea(e.target.value)}
                                />
                                <datalist id="areas-list">
                                    {['Operacional', 'Filial RJ', 'Comercial Curitiba', 'COMERCIAL SP', 'Delta', 'Pelicano', 'RMS', 'Facilities', 'Frotas', 'CTH', 'Relacionamento', 'meta', 'Auditoria', 'Comercial RJ', 'RMC', 'Extremo', 'FLECHA', 'Implantação', 'Aguia I', 'Arco', 'Filial Curitiba', 'DELTA I', 'PELICANO ABC', 'DELTA II', 'IMPLANTAÇÃO', 'Cosecutity Curitiba', 'RMC - CTH', 'ADM OP. MOTORISTAS', 'TECNOLOGIA', 'Comercial', 'AGUIA II', 'Facilities - RJ', 'COMERCIAL MG', 'Check Point', 'ARCO I', 'GGO Fleha', 'Arco II', 'Extremo / RMC', 'GGO AGUIA', 'RMSJ- AGUIA', 'PLANEJAMENTO', 'GLOBAL SECURITY', 'PELICANO I e II', 'IMPLANTAÇÃO SEG.', 'Filial MG', 'COSECURITY', 'ARCO'].map(area => (
                                        <option key={area} value={area} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Modelo / Descrição</label>
                                <input type="text" className="input-field" placeholder="Ex: Fiat Mobi 2024" value={newModel} onChange={e => setNewModel(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <label className="input-label">KM Inicial</label>
                                <input type="number" className="input-field" placeholder="0" value={newInitialKm} onChange={e => setNewInitialKm(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Patio/Posto Atual</label>
                                <select className="input-field" value={newStationId} onChange={e => setNewStationId(e.target.value)}>
                                    <option value="">Em rota (Nenhum Posto)</option>
                                    {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editingMoto ? 'Salvar Edição' : 'Gravar Moto'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Atualizar KM / Foto */}
            {showKmModal !== null && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="glass animate-slide-up" style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Relatar Quilometragem</h2>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Tire ou anexe uma foto do painel ou digite o valor manual.</p>

                        <form onSubmit={handleUpdateKM} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="input-group">
                                <label className="input-label">KM Hodometro</label>
                                <input type="number" className="input-field" value={kmValue} onChange={e => setKmValue(e.target.value)} required />
                            </div>

                            <div style={{ border: '2px dashed var(--border-color)', borderRadius: '0.5rem', padding: '1rem', textAlign: 'center' }}>
                                {kmPhoto ? (
                                    <div style={{ position: 'relative' }}>
                                        <img src={kmPhoto} alt="Foto Painel" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '0.25rem' }} />
                                        <button type="button" onClick={(e) => { e.stopPropagation(); setKmPhoto(null); }} style={{ position: 'absolute', top: 5, right: 5, background: 'red', color: 'white', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>X</button>
                                    </div>
                                ) : (
                                    <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }} onClick={() => fileInputRef.current?.click()}>
                                        <Camera size={32} color="var(--primary)" />
                                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Tirar foto do painel</span>
                                        {ocrProcessing && <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>Processando Imagem (OCR)...</span>}
                                    </div>
                                )}
                                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} style={{ display: 'none' }} onChange={handlePhotoUpload} disabled={ocrProcessing} />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowKmModal(null)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Salvar Registro</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Manutencao */}
            {showMntModal !== null && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="glass animate-slide-up" style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertTriangle color="var(--danger)" /> Enviar para Oficina
                        </h2>
                        <form onSubmit={submitMaintenance} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="input-group">
                                <label className="input-label">Motivo da Manutencao ou Revisao</label>
                                <textarea
                                    className="input-field"
                                    rows="3"
                                    placeholder="Ex: Troca de oleo, pastilhas gastas, pneu furado..."
                                    value={mntReason}
                                    onChange={e => setMntReason(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={14} /> Data Agendada</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={mntDate}
                                    onChange={e => setMntDate(e.target.value)}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowMntModal(null)}>Cancelar</button>
                                <button type="submit" className="btn btn-danger" style={{ flex: 1 }}>Reportar Falha</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

function DamageCanvas({ value, onChange }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const motoSvgString = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="350" viewBox="0 0 500 350">
  <style>
    .moto-line { fill: none; stroke: #6b7280; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .moto-fill { fill: #f8fafc; stroke: #6b7280; stroke-width: 2; }
    .text { fill: #6b7280; font-family: sans-serif; font-size: 14px; font-weight: bold; text-anchor: middle; }
  </style>
  <!-- LEFT SIDE -->
  <g transform="translate(40, 50)">
    <text x="80" y="-10" class="text">Lateral Esquerda</text>
    <path class="moto-fill" d="M10,80 C10,50 30,30 60,30 L100,30 C120,40 140,40 160,80 Z" />
    <circle class="moto-line" cx="30" cy="80" r="20" />
    <circle class="moto-line" cx="140" cy="80" r="20" />
    <path class="moto-line" d="M60,30 L50,15 L70,15" />
    <path class="moto-line" d="M90,30 C100,50 120,50 130,30" />
  </g>
  <!-- RIGHT SIDE -->
  <g transform="translate(260, 50)">
    <text x="80" y="-10" class="text">Lateral Direita</text>
    <path class="moto-fill" d="M10,80 C10,50 30,30 60,30 L100,30 C120,40 140,40 160,80 Z" />
    <circle class="moto-line" cx="30" cy="80" r="20" />
    <circle class="moto-line" cx="140" cy="80" r="20" />
    <path class="moto-line" d="M60,30 L50,15 L70,15" />
    <path class="moto-line" d="M90,30 C100,50 120,50 130,30" />
  </g>
  <!-- TOP VIEW -->
  <g transform="translate(180, 200)">
    <text x="70" y="-10" class="text">Vista Superior</text>
    <rect class="moto-fill" x="20" y="20" width="100" height="30" rx="10" />
    <rect class="moto-line" x="10" y="25" width="20" height="20" rx="5" />
    <rect class="moto-line" x="110" y="25" width="20" height="20" rx="5" />
    <path class="moto-line" d="M90,10 L90,60" />
  </g>
</svg>`;

    const drawBaseGrid = (ctx, canvas, customValue) => {
        const img = new Image();
        img.onload = () => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };

        if (customValue) {
            img.src = customValue;
        } else {
            img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(motoSvgString)}`;
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        drawBaseGrid(ctx, canvas, value);
    }, [value]);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let clientX = e.clientX;
        let clientY = e.clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e) => {
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        // Prevent scrolling on touch
        if (e.type === 'touchmove') e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        onChange(canvasRef.current.toDataURL());
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            onChange(null);
        };
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(motoSvgString)}`;
    };

    return (
        <div style={{ position: 'relative', background: '#fff', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <canvas
                ref={canvasRef}
                width={500}
                height={350}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                onTouchCancel={stopDrawing}
                style={{ cursor: 'crosshair', width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
            />
            <button
                type="button"
                onClick={clear}
                className="btn btn-ghost"
                style={{ position: 'absolute', top: '5px', right: '5px', fontSize: '0.7rem', padding: '0.2rem 0.5rem', border: '1px solid var(--border-color)' }}
            >
                Limpar
            </button>
        </div>
    );
}

function SignatureCanvas({ value, onChange }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!value) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Draw a subtle placeholder line
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(30, canvas.height - 30);
            ctx.lineTo(canvas.width - 30, canvas.height - 30);
            ctx.stroke();

            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#e5e7eb';
            ctx.fillText('Assine aqui', canvas.width / 2 - 35, canvas.height / 2);
        } else {
            // Se já tem valor, carrega a imagem
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
            };
            img.src = value;
        }
    }, [value]);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let clientX = e.clientX;
        let clientY = e.clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Se estava vazio, limpa o texto "Assine aqui" na primeira vez que clicar
        if (!value) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            onChange(canvasRef.current.toDataURL()); // set initial non-empty state
        }

        const { x, y } = getCoordinates(e);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        if (e.type === 'touchmove') e.preventDefault();

        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        onChange(canvasRef.current.toDataURL());
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(30, canvas.height - 30);
        ctx.lineTo(canvas.width - 30, canvas.height - 30);
        ctx.stroke();

        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#e5e7eb';
        ctx.fillText('Assine aqui', canvas.width / 2 - 35, canvas.height / 2);

        onChange(null);
    };

    return (
        <div style={{ position: 'relative', background: '#fff', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <canvas
                ref={canvasRef}
                width={400}
                height={150}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                onTouchCancel={stopDrawing}
                style={{ cursor: 'crosshair', width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
            />
            <button
                type="button"
                onClick={clear}
                className="btn btn-ghost"
                style={{ position: 'absolute', top: '5px', right: '5px', fontSize: '0.7rem', padding: '0.2rem 0.5rem', border: '1px solid var(--border-color)' }}
            >
                Limpar
            </button>
        </div>
    );
}

function ChecklistModal({ vehicleId, onClose }) {
    const { submitChecklist } = useFleet();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        type: 'Saída', // Saída ou Retorno

        // Itens Sim/Não (true/false para simplificar no state, ou string)
        capaceteMestre: false,
        capaceteReserva: false,
        capaChuva: false,
        bauleto: false,
        travaDisco: false,
        antenaCortaPipa: false,






        crlv: false,
        bateria: false,

        manual: false,
        giroflex: false,

        // Estado dos Pneus
        pneusDianteiros: 'Bom',
        pneusTraseiros: 'Bom',


        // Hodometro (Novo)
        currentKm: '',
        kmPhoto: null,

        // Outros
        fuelLevel: '1/2',
        damagesDiagram: null,
        observations: '',
        signature: null
    });

    const fileInputRef = useRef(null);
    const [ocrProcessing, setOcrProcessing] = useState(false);

    const handlePhotoUploadChecklist = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const imageUrl = URL.createObjectURL(file);
            setForm(prev => ({ ...prev, kmPhoto: imageUrl }));
            setOcrProcessing(true);

            try {
                const result = await Tesseract.recognize(file, 'eng');
                const text = result.data.text;
                const numbersOnly = text.replace(/\D/g, '');

                if (numbersOnly && numbersOnly.length > 0) {
                    setForm(prev => ({ ...prev, currentKm: numbersOnly }));
                    alert(`Leitura Automática: ${numbersOnly} km identificados.`);
                } else {
                    alert('Não foi possível ler o KM na imagem. Por favor, digite manualmente.');
                }
            } catch (err) {
                console.error("Erro no OCR:", err);
                alert('Erro ao processar imagem.');
            } finally {
                setOcrProcessing(false);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.signature) {
            alert('Por favor, assine o checklist antes de finalizar.');
            return;
        }

        setLoading(true);
        const res = await submitChecklist({ ...form, vehicleId });
        setLoading(false);
        if (res.success) {
            alert('Checklist enviado com sucesso!');
            onClose();
        } else {
            alert('Erro ao enviar: ' + (res.message || 'Erro desconhecido'));
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
            <div className="glass animate-slide-up" style={{ width: '100%', maxWidth: '500px', maxHeight: '95vh', overflowY: 'auto', padding: '1.5rem', borderRadius: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Checklist Virtual</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Passo {step} de 2</span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1, height: '4px', background: step >= 1 ? 'var(--primary)' : 'var(--border-color)', borderRadius: '2px' }} />
                    <div style={{ flex: 1, height: '4px', background: step >= 2 ? 'var(--primary)' : 'var(--border-color)', borderRadius: '2px' }} />
                </div>

                <form onSubmit={handleSubmit}>
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                                {/* Coluna 1: Itens Sim/Não */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

                                    <div style={{ marginBottom: '1rem' }}>
                                        <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Tipo de Checklist</h3>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button type="button" onClick={() => setForm({ ...form, type: 'Saída' })} className={form.type === 'Saída' ? 'btn btn-primary' : 'btn btn-outline'} style={{ flex: 1, padding: '0.5rem' }}>Saída</button>
                                            <button type="button" onClick={() => setForm({ ...form, type: 'Retorno' })} className={form.type === 'Retorno' ? 'btn btn-primary' : 'btn btn-outline'} style={{ flex: 1, padding: '0.5rem' }}>Retorno</button>
                                        </div>
                                    </div>

                                    <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Equipamentos (Sim / Nao)</h3>
                                    {[
                                        { key: 'capaceteMestre', label: 'Capacete Mestre' },
                                        { key: 'capaceteReserva', label: 'Capacete Reserva' },
                                        { key: 'capaChuva', label: 'Capa de Chuva' },
                                        { key: 'bauleto', label: 'Baú / Bauleto' },
                                        { key: 'travaDisco', label: 'Trava de Disco' },
                                        { key: 'antenaCortaPipa', label: 'Antena Corta-Pipa' },
                                        { key: 'crlv', label: 'CRLV / Documento' },
                                        { key: 'bateria', label: 'Bateria' },
                                        { key: 'manual', label: 'Manual do Proprietário' },
                                        { key: 'giroflex', label: 'Giroflex' },
                                    ].map(item => (
                                        <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0', borderBottom: '1px solid var(--border-color)' }}>
                                            <span style={{ fontSize: '0.875rem' }}>{item.label}</span>
                                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                <button type="button" onClick={() => setForm({ ...form, [item.key]: true })} className={form[item.key] ? 'btn btn-primary' : 'btn btn-outline'} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', minWidth: '40px' }}>Sim</button>
                                                <button type="button" onClick={() => setForm({ ...form, [item.key]: false })} className={!form[item.key] ? 'btn btn-primary' : 'btn btn-outline'} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', minWidth: '40px' }}>Não</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Coluna 2: Pneus e Combustível */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Nivel de Combustivel</h3>
                                        <select className="input-field" value={form.fuelLevel} onChange={e => setForm({ ...form, fuelLevel: e.target.value })}>
                                            {['Vazio', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8', 'Cheio'].map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Estado dos Pneus</h3>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {[
                                                { key: 'pneusDianteiros', label: 'Pneu Dianteiro' },
                                                { key: 'pneusTraseiros', label: 'Pneu Traseiro' }
                                            ].map(pneu => (
                                                <div key={pneu.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{pneu.label}</span>
                                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                        {['Bom', 'Medio', 'Ruim'].map(estado => (
                                                            <button
                                                                key={estado}
                                                                type="button"
                                                                onClick={() => setForm({ ...form, [pneu.key]: estado })}
                                                                className={form[pneu.key] === estado ? 'btn btn-primary' : 'btn btn-outline'}
                                                                style={{ flex: 1, padding: '0.25rem 0', fontSize: '0.75rem' }}
                                                            >
                                                                {estado}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                        <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Quilometragem (Hodometro)</h3>

                                        <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                                            <input type="number" className="input-field" placeholder="KM Atual (Digite ou Tire Foto)" value={form.currentKm} onChange={e => setForm({ ...form, currentKm: e.target.value })} required />
                                        </div>

                                        <div style={{ border: '2px dashed var(--border-color)', borderRadius: '0.5rem', padding: '0.5rem', textAlign: 'center' }}>
                                            {form.kmPhoto ? (
                                                <div style={{ position: 'relative' }}>
                                                    <img src={form.kmPhoto} alt="Foto Painel" style={{ width: '100%', maxHeight: '100px', objectFit: 'cover', borderRadius: '0.25rem' }} />
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); setForm({ ...form, kmPhoto: null }); }} style={{ position: 'absolute', top: 5, right: 5, background: 'red', color: 'white', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>X</button>
                                                </div>
                                            ) : (
                                                <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', padding: '0.5rem' }} onClick={() => fileInputRef.current?.click()}>
                                                    <Camera size={24} color="var(--primary)" />
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>Capturar KM</span>
                                                    {ocrProcessing && <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>Processando...</span>}
                                                </div>
                                            )}
                                            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} style={{ display: 'none' }} onChange={handlePhotoUploadChecklist} disabled={ocrProcessing} />
                                        </div>
                                    </div>

                                </div>
                            </div>

                            <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setStep(2)}>Proximo: Registro de Avarias</button>
                        </div>
                    )}

                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="input-group">
                                <label className="input-label">Marque Riscos e Amassados abaixo:</label>
                                <DamageCanvas value={form.damagesDiagram} onChange={(val) => setForm({ ...form, damagesDiagram: val })} />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Observacoes</label>
                                <textarea className="input-field" rows="2" value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} placeholder="Mais detalhes (Ex: arranhoes, avisos, etc)..." />
                            </div>

                            <div className="input-group">
                                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <PenTool size={16} /> Assinatura do Responsavel *
                                </label>
                                <SignatureCanvas value={form.signature} onChange={(val) => setForm({ ...form, signature: val })} />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setStep(1)} style={{ flex: 1 }}>Voltar</button>
                                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>{loading ? 'Enviando...' : 'Finalizar Checklist'}</button>
                            </div>
                        </div>
                    )}

                    <button type="button" className="btn btn-ghost" onClick={onClose} style={{ width: '100%', marginTop: '1rem', color: 'var(--danger)' }}>Fechar</button>
                </form>
            </div>
        </div>
    );
}
