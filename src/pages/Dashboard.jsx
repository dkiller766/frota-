import React from 'react';
import { useFleet } from '../contexts/FleetContext';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix para ícones padrão do leaflet caso queira usar, mas vamos usar divIcon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const stationIcon = L.divIcon({
    className: 'custom-station-icon',
    html: `<div style="background-color: #f59e0b; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
         </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
});

export default function Dashboard() {
    const { user } = useAuth();
    const { stations, loading } = useFleet();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (user?.role === ROLES.FUNCIONARIO_POSTO) {
            navigate('/veiculos');
        }
    }, [user, navigate]);

    const stationsWithCoords = stations.filter(s => s.position);
    const partnerStations = stations.filter(s => s.partner).length;
    const independentStations = stations.length - partnerStations;

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                <div className="animate-pulse">Carregando mapa...</div>
            </div>
        );
    }

    function MapAutoCenter({ items }) {
        const map = useMap();
        React.useEffect(() => {
            if (items && items.length > 0) {
                try {
                    const bounds = L.latLngBounds(items.map(s => s.position));
                    if (bounds.isValid()) {
                        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
                    }
                } catch (err) {
                    console.error('Erro ao ajustar limites do mapa:', err);
                }
            }
        }, [items, map]);
        return null;
    }

    return (
        <div style={{ height: '100%', width: '100%', position: 'relative', borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <div className="glass" style={{
                position: 'absolute',
                top: '1rem',
                left: '1rem',
                zIndex: 1000,
                padding: '1rem',
                borderRadius: '0.75rem',
                minWidth: '200px'
            }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 'bold' }}>Rede de Postos</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Localizações de abastecimento</p>

                <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem' }}>Postos Parceiros:</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>{partnerStations}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem' }}>Independentes:</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--warning)' }}>{independentStations}</span>
                    </div>
                </div>
            </div>

            <MapContainer
                center={[-23.550520, -46.633308]}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
            >
                <ZoomControl position="bottomright" />
                <MapAutoCenter items={stationsWithCoords} />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />

                {stationsWithCoords.map(station => (
                    <Marker key={`st-${station.id}`} position={station.position} icon={stationIcon}>
                        <Popup>
                            <div style={{ padding: '0.25rem' }}>
                                <strong style={{ fontSize: '1rem' }}>{station.name}</strong><br />
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{station.address}</span><br />
                                <div style={{ marginTop: '0.5rem', fontWeight: 'bold', color: station.partner ? 'var(--success)' : 'var(--warning)' }}>
                                    {station.partner ? 'Parceiro Oficial' : 'Posto Independente'}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}
