import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canDefineRoutes, canCompleteRoutes } from '../utils/permissions';
import { Navigation, Route as RouteIcon, Send, Map as MapIcon, ChevronDown, ChevronUp, Plus, Trash2, Edit2, CheckCircle, Clock, MapPin, GripVertical, Share2, Copy, ExternalLink } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import { useFleet } from '../contexts/FleetContext';

export default function Rotas() {
    const { user, getCompanyUsers } = useAuth();
    const { routes, stations, loading, addRoute, editRoute, deleteRoute, updateRouteStatus, updateRoutesOrder } = useFleet();
    const allowDefine = canDefineRoutes(user?.role);
    const allowComplete = canCompleteRoutes(user?.role);

    const [companyUsers, setCompanyUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);

    React.useEffect(() => {
        const fetchUsers = async () => {
            const users = await getCompanyUsers();
            setCompanyUsers(users || []);
            setLoadingUsers(false);
        };
        fetchUsers();
    }, [getCompanyUsers]);

    const availableDrivers = companyUsers.filter(u => u.role === 'COLABORADOR');

    const [showModal, setShowModal] = useState(false);
    const [editingRoute, setEditingRoute] = useState(null);
    const [loadingCreation, setLoadingCreation] = useState(false);

    // Agora newPoints é um array de strings (endereços)
    const [newPoints, setNewPoints] = useState(['', '']);
    const [newDriver, setNewDriver] = useState('');
    const [newObservations, setNewObservations] = useState('');

    const [expandedRoute, setExpandedRoute] = useState(null);
    const [routeData, setRouteData] = useState({}); // { id: { coords: [], loading: false, error: null, bounds: [], distance: 0, duration: 0, waypoints: [] } }
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [draggedRouteIndex, setDraggedRouteIndex] = useState(null);

    if (loading || loadingUsers) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', color: 'var(--text-secondary)' }}>
                <div className="animate-pulse">Carregando rotas...</div>
            </div>
        );
    }

    const geocodeAddress = async (address) => {
        if (!address.trim()) return null;

        const matchedStation = stations?.find(s =>
            (s.address && s.address.toLowerCase() === address.trim().toLowerCase()) ||
            s.name.toLowerCase() === address.trim().toLowerCase()
        );
        if (matchedStation && matchedStation.position) {
            return matchedStation.position;
        }

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
            const data = await res.json();
            if (data && data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            return null;
        } catch (e) {
            console.error(e);
            return null;
        }
    };

    const fetchRouteData = async (route) => {
        if (routeData[route.id]?.coords && routeData[route.id]?.pointsLength === route.points.length) return;

        setRouteData(prev => ({ ...prev, [route.id]: { loading: true, error: null, pointsLength: route.points.length } }));

        try {
            // Geocode all points
            const coordsPromises = route.points.map(p => geocodeAddress(p));
            const geoCoords = await Promise.all(coordsPromises);

            if (geoCoords.some(c => c === null)) {
                setRouteData(prev => ({ ...prev, [route.id]: { loading: false, error: 'Não foi possível encontrar as coordenadas para todos os pontos da rota.' } }));
                return;
            }

            // OSRM: lon,lat;lon,lat;...
            const coordinatesString = geoCoords.map(c => `${c[1]},${c[0]}`).join(';');
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordinatesString}?overview=full&geometries=geojson`;

            const osrmRes = await fetch(osrmUrl);
            const osrmData = await osrmRes.json();

            if (osrmData.code !== 'Ok' || !osrmData.routes || osrmData.routes.length === 0) {
                setRouteData(prev => ({ ...prev, [route.id]: { loading: false, error: 'Não foi possível traçar a rota com o serviço de mapas.' } }));
                return;
            }

            // OSRM GeoJSON is [lon, lat], Leaflet is [lat, lon]
            const coords = osrmData.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            const distance = (osrmData.routes[0].distance / 1000).toFixed(1); // in meters, converted to km
            const durationArr = osrmData.routes[0].duration; // in seconds
            const hours = Math.floor(durationArr / 3600);
            const minutes = Math.floor((durationArr % 3600) / 60);
            const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

            // Calc bounds
            const lats = coords.map(c => c[0]);
            const lons = coords.map(c => c[1]);
            const bounds = [
                [Math.min(...lats), Math.min(...lons)],
                [Math.max(...lats), Math.max(...lons)]
            ];

            setRouteData(prev => ({ ...prev, [route.id]: { loading: false, coords, waypoints: geoCoords, bounds, distance, duration: durationStr, pointsLength: route.points.length } }));
        } catch (error) {
            console.error('Fetch route error:', error);
            setRouteData(prev => ({ ...prev, [route.id]: { loading: false, error: 'Erro de conexão ao buscar rota.' } }));
        }
    };

    const toggleExpand = (route) => {
        if (expandedRoute === route.id) {
            setExpandedRoute(null);
        } else {
            setExpandedRoute(route.id);
            fetchRouteData(route);
        }
    };

    // Form helpers
    const handlePointChange = (index, value) => {
        const updatedPoints = [...newPoints];
        updatedPoints[index] = value;
        setNewPoints(updatedPoints);
    };

    const addPoint = () => {
        setNewPoints([...newPoints, '']);
    };

    const removePoint = (index) => {
        if (newPoints.length <= 2) return; // Mínimo 2 pontos
        const updatedPoints = newPoints.filter((_, i) => i !== index);
        setNewPoints(updatedPoints);
    };

    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // Opcional: esconder o ghost image padrão se ficar feio
    };

    const handleDragOver = (e, index) => {
        e.preventDefault(); // Necessário para permitir o drop
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) return;

        const updatedPoints = [...newPoints];
        const draggedPoint = updatedPoints[draggedIndex];

        updatedPoints.splice(draggedIndex, 1);
        updatedPoints.splice(dropIndex, 0, draggedPoint);

        setNewPoints(updatedPoints);
        setDraggedIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const openAddModal = () => {
        setEditingRoute(null);
        setNewPoints(['', '']);
        setNewDriver('');
        setNewObservations('');
        setShowModal(true);
    };

    const openEditModal = (route) => {
        setEditingRoute(route.id);
        setNewPoints([...route.points]);
        setNewDriver(route.driver);
        setNewObservations(route.observations || '');
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir esta rota?')) {
            await deleteRoute(id);
            if (expandedRoute === id) setExpandedRoute(null);
        }
    };

    const handleComplete = async (id) => {
        if (window.confirm('Confirmar conclusão desta rota?')) {
            await updateRouteStatus(id, 'CONCLUÍDA');
        }
    };

    const handleRouteDragStart = (e, index) => {
        if (!allowDefine) return;
        setDraggedRouteIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleRouteDragOver = (e) => {
        if (!allowDefine) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleRouteDrop = async (e, dropIndex) => {
        if (!allowDefine) return;
        e.preventDefault();
        if (draggedRouteIndex === null || draggedRouteIndex === dropIndex) return;

        const updatedRoutes = [...routes];
        const draggedRoute = updatedRoutes[draggedRouteIndex];

        updatedRoutes.splice(draggedRouteIndex, 1);
        updatedRoutes.splice(dropIndex, 0, draggedRoute);

        setDraggedRouteIndex(null);
        await updateRoutesOrder(updatedRoutes);
    };

    const handleSaveRoute = async (e) => {
        e.preventDefault();
        if (!allowDefine) return;

        // Limpar pontos vazios do fim
        const validPoints = newPoints.filter(p => p.trim() !== '');
        if (validPoints.length < 2) {
            alert('A rota deve ter pelo menos um ponto de partida e um destino.');
            return;
        }

        setLoadingCreation(true);
        try {
            // Validar se todos os endereços existem
            for (let i = 0; i < validPoints.length; i++) {
                const coords = await geocodeAddress(validPoints[i]);
                if (!coords) {
                    alert(`Não foi possível encontrar a localização do Ponto ${i + 1} no mapa. Digite um endereço mais completo.`);
                    setLoadingCreation(false);
                    return;
                }
            }

            if (editingRoute) {
                await editRoute(editingRoute, {
                    points: validPoints,
                    driver: newDriver,
                    observations: newObservations
                });
                // Clear cache for this route so it fetches again
                setRouteData(prev => { const next = { ...prev }; delete next[editingRoute]; return next; });
                if (expandedRoute === editingRoute) fetchRouteData({ id: editingRoute, points: validPoints });
            } else {
                await addRoute({
                    points: validPoints,
                    driver: newDriver,
                    observations: newObservations
                });
            }

            setShowModal(false);
        } catch (err) {
            console.error(err);
            alert('Erro ao validar os endereços. Tente novamente.');
        } finally {
            setLoadingCreation(false);
        }
    };
    const handleShareWaze = (route) => {
        const lastPoint = route.points[route.points.length - 1];
        const url = `https://waze.com/ul?q=${encodeURIComponent(lastPoint)}&navigate=yes`;
        window.open(url, '_blank');
    };

    const handleShareGoogleMaps = (route) => {
        const origin = route.points[0];
        const destination = route.points[route.points.length - 1];
        const waypoints = route.points.slice(1, -1).join('|');
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}`;
        window.open(url, '_blank');
    };

    const handleCopyRoute = (route) => {
        const text = route.points.map((p, i) => `${i + 1}. ${p}`).join('\n');
        navigator.clipboard.writeText(text);
        alert('Roteiro copiado para a área de transferência!');
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Rotas Operacionais</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Gestão e visualização de trajetos da frota</p>
                </div>

                {allowDefine && (
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <Send size={18} />
                        <span className="hidden-mobile">Criar Nova Rota</span>
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {routes.filter(r => user?.role === 'COLABORADOR' ? r.driver === user.name : true).map((r, rIdx) => (
                    <div
                        key={r.id}
                        className={`glass animate-fade-in ${draggedRouteIndex === rIdx ? 'dragging' : ''}`}
                        draggable={allowDefine}
                        onDragStart={(e) => handleRouteDragStart(e, rIdx)}
                        onDragOver={handleRouteDragOver}
                        onDrop={(e) => handleRouteDrop(e, rIdx)}
                        style={{
                            padding: '1.5rem',
                            borderRadius: '1rem',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '1.5rem',
                            alignItems: 'flex-start',
                            border: draggedRouteIndex === rIdx ? '2px dashed var(--primary)' : '1px solid transparent',
                            opacity: draggedRouteIndex === rIdx ? 0.5 : 1,
                            cursor: allowDefine ? 'grab' : 'default'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', marginBottom: '-0.5rem' }}>
                            <span style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                {rIdx + 1}ª Rota
                            </span>
                            {allowDefine && <GripVertical size={16} color="var(--text-secondary)" />}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', minWidth: '250px', flex: 1 }}>
                            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '50%', marginTop: '0.25rem' }}>
                                <RouteIcon size={24} color="var(--primary)" />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                                {r.points.map((pt, idx) => (
                                    <React.Fragment key={idx}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{
                                                width: 10, height: 10, borderRadius: '50%',
                                                backgroundColor: idx === 0 ? 'var(--success)' : (idx === r.points.length - 1 ? 'var(--danger)' : 'var(--warning)')
                                            }}></div>
                                            <span style={{ fontSize: '0.875rem', fontWeight: idx === 0 || idx === r.points.length - 1 ? '600' : '400' }}>
                                                {idx === 0 ? 'Origem: ' : (idx === r.points.length - 1 ? 'Destino: ' : `Parada ${idx}: `)}
                                                {pt}
                                            </span>
                                        </div>
                                        {idx < r.points.length - 1 && (
                                            <div style={{ borderLeft: '2px dashed var(--border-color)', height: '16px', marginLeft: '4px' }}></div>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        <div style={{ minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Motorista Designado</p>
                                <p style={{ fontWeight: '500' }}>{r.driver}</p>
                            </div>

                            <div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status</p>
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    color: r.status === 'CONCLUÍDA' ? 'var(--success)' : (r.status === 'EM ANDAMENTO' ? 'var(--primary)' : 'var(--warning)'),
                                    backgroundColor: r.status === 'CONCLUÍDA' ? 'rgba(16, 185, 129, 0.1)' : (r.status === 'EM ANDAMENTO' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)'),
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem'
                                }}>
                                    {r.status}
                                </span>
                            </div>

                            {r.observations && (
                                <div style={{ marginTop: '0.5rem', backgroundColor: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', maxWidth: '250px' }}>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '0.25rem' }}>Observações</p>
                                    <p style={{ fontSize: '0.8rem', fontStyle: 'italic', wordBreak: 'break-word' }}>"{r.observations}"</p>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', marginLeft: 'auto' }}>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button className="btn btn-ghost" onClick={() => handleCopyRoute(r)} title="Copiar Endereços" style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>
                                    <Copy size={20} />
                                </button>
                                <button className="btn btn-ghost" onClick={() => handleShareGoogleMaps(r)} title="Abrir no Google Maps" style={{ padding: '0.5rem', color: '#4285F4' }}>
                                    <ExternalLink size={20} />
                                </button>
                                <button className="btn btn-ghost" onClick={() => handleShareWaze(r)} title="Abrir no Waze" style={{ padding: '0.5rem', color: '#33CCFF' }}>
                                    <Navigation size={20} />
                                </button>
                                {allowComplete && r.status !== 'CONCLUÍDA' && (
                                    <button className="btn btn-ghost" onClick={() => handleComplete(r.id)} title="Marcar como Concluída" style={{ padding: '0.5rem', color: 'var(--success)' }}>
                                        <CheckCircle size={20} />
                                    </button>
                                )}
                                {allowDefine && (
                                    <>
                                        <button className="btn btn-ghost" onClick={() => openEditModal(r)} title="Editar Rota" style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>
                                            <Edit2 size={20} />
                                        </button>
                                        <button className="btn btn-ghost" onClick={() => handleDelete(r.id)} title="Excluir Rota" style={{ padding: '0.5rem', color: 'var(--danger)' }}>
                                            <Trash2 size={20} />
                                        </button>
                                    </>
                                )}
                                <button className="btn btn-ghost" onClick={() => toggleExpand(r)} title="Ver Mapa" style={{ padding: '0.5rem', color: 'var(--primary)' }}>
                                    {expandedRoute === r.id ? <ChevronUp size={24} /> : <MapIcon size={24} />}
                                </button>
                            </div>
                        </div>

                        {/* Expanded Map View */}
                        {expandedRoute === r.id && (
                            <div className="animate-slide-up" style={{ width: '100%', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                {routeData[r.id]?.loading && (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Carregando dados da rota no mapa...</div>
                                )}
                                {routeData[r.id]?.error && (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.5rem' }}>
                                        {routeData[r.id].error}
                                    </div>
                                )}
                                {routeData[r.id]?.coords && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ display: 'flex', gap: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-primary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                                                <MapPin size={18} color="var(--primary)" /> Distância: {routeData[r.id].distance} km
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                                                <Clock size={18} color="var(--warning)" /> Tempo Est.: {routeData[r.id].duration}
                                            </div>
                                        </div>

                                        <div style={{ height: '350px', width: '100%', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                            <MapContainer
                                                bounds={routeData[r.id].bounds}
                                                style={{ height: '100%', width: '100%', zIndex: 0 }}
                                                zoomControl={true}
                                            >
                                                <TileLayer
                                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                                />
                                                <Polyline positions={routeData[r.id].coords} color="var(--primary)" weight={4} opacity={0.8} />

                                                {routeData[r.id].waypoints.map((wp, i) => (
                                                    <Marker key={i} position={wp}>
                                                        <Popup>{r.points[i]}</Popup>
                                                    </Marker>
                                                ))}
                                            </MapContainer>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                ))}

                {routes.filter(r => user?.role === 'COLABORADOR' ? r.driver === user.name : true).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        Nenhuma rota definida para você no momento.
                    </div>
                )}
            </div>

            {showModal && allowDefine && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div className="glass animate-slide-up" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', borderRadius: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{editingRoute ? 'Editar Rota' : 'Definir Nova Rota'}</h2>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Adicione os pontos de parada na ordem desejada.</p>

                        <form onSubmit={handleSaveRoute} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {newPoints.map((pt, idx) => (
                                    <div
                                        key={idx} // Usamos o indice pois podem haver endereços repetidos
                                        className={`input-group ${draggedIndex === idx ? 'dragging' : ''}`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, idx)}
                                        onDragOver={(e) => handleDragOver(e, idx)}
                                        onDrop={(e) => handleDrop(e, idx)}
                                        onDragEnd={handleDragEnd}
                                        style={{
                                            display: 'flex', alignItems: 'flex-end', gap: '0.5rem', marginBottom: 0,
                                            padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: draggedIndex === idx ? 'var(--bg-secondary)' : 'transparent',
                                            border: draggedIndex === idx ? '2px dashed var(--primary)' : '1px solid transparent',
                                            opacity: draggedIndex === idx ? 0.5 : 1, transition: 'all 0.2s', cursor: 'grab'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                                            <GripVertical size={20} style={{ cursor: 'grab' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label className="input-label" style={{ marginBottom: '0.25rem', pointerEvents: 'none' }}>
                                                {idx === 0 ? 'Partida (Origem)' : (idx === newPoints.length - 1 ? 'Destino Final' : `Parada ${idx}`)}
                                            </label>
                                            <input
                                                type="text"
                                                list="stations-list"
                                                className="input-field"
                                                placeholder="Endereço ou Nome do Posto"
                                                value={pt}
                                                onChange={e => handlePointChange(idx, e.target.value)}
                                                required
                                            />
                                        </div>
                                        {newPoints.length > 2 && (
                                            <button type="button" onClick={() => removePoint(idx)} className="btn btn-ghost" style={{ padding: '0.75rem', color: 'var(--danger)' }} title="Remover ponto">
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <datalist id="stations-list">
                                {stations?.map(s => (
                                    <option key={s.id} value={s.address || s.name}>{s.name}</option>
                                ))}
                            </datalist>

                            <button type="button" onClick={addPoint} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderStyle: 'dashed' }}>
                                <Plus size={16} /> Adicionar Parada Intermediária
                            </button>

                            <div className="input-group" style={{ marginTop: '1rem' }}>
                                <label className="input-label">Motorista/Colaborador Designado</label>
                                <select className="input-field" value={newDriver} onChange={e => setNewDriver(e.target.value)} required>
                                    <option value="" disabled>Selecione um colaborador</option>
                                    {availableDrivers.map(driver => (
                                        <option key={driver.id} value={driver.name} style={{ color: 'black' }}>
                                            {driver.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group" style={{ marginTop: '0.5rem' }}>
                                <label className="input-label">Observações (Opcional)</label>
                                <textarea
                                    className="input-field"
                                    rows="3"
                                    placeholder="Ex: Pegar chave no posto 2, carregar caixas vermelhas..."
                                    value={newObservations}
                                    onChange={e => setNewObservations(e.target.value)}
                                ></textarea>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)} disabled={loadingCreation}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1, backgroundColor: 'var(--success)' }} disabled={loadingCreation}>
                                    {loadingCreation ? 'Buscando...' : (editingRoute ? 'Salvar Edição' : <><Send size={18} /> Enviar Rota</>)}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
