/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from './AuthContext';

const FleetContext = createContext(null);

export const FleetProvider = ({ children }) => {
    const { user } = useAuth();
    const [vehicles, setVehicles] = useState([]);
    const [stations, setStations] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastFetch, setLastFetch] = useState(0);

    const fetchData = async (force = false) => {
        if (!user?.company_id || !supabase) {
            setLoading(false);
            return;
        }

        // Debounce: Evitar múltiplas chamadas em menos de 1 segundo (a menos que seja forçado)
        const now = Date.now();
        if (!force && lastFetch && now - lastFetch < 1000) {
            return;
        }
        setLastFetch(now);

        // Se já está carregando e não é forçado, não inicia novo loading UI
        if (!loading) {
            // Se for atualização em background (real-time), não resetamos loading para true
            // para não causar flickering na UI
        } else {
            setLoading(true);
        }

        const timeout = setTimeout(() => {
            setLoading(false);
        }, 5000);

        try {
            // Parallel Fetch
            const [stationsRes, vehiclesRes, mntRes, routesRes] = await Promise.all([
                supabase.from('fuel_stations').select('*').eq('company_id', user.company_id).order('name', { ascending: true }).limit(10000),
                supabase.from('vehicles').select('*').eq('company_id', user.company_id).order('model', { ascending: true }).limit(10000),
                supabase.from('maintenance_records').select('*').eq('company_id', user.company_id).eq('status', 'PENDING').limit(10000),
                supabase.from('routes').select('*').eq('company_id', user.company_id).order('order_index', { ascending: true }).limit(10000)
            ]);

            const stationsData = stationsRes?.data || [];
            const vehiclesData = vehiclesRes?.data || [];
            const mntData = mntRes?.data || [];
            const routesData = routesRes?.data || [];

            console.log("[FleetContext] stationsRes:", { error: stationsRes?.error, count: stationsData.length });

            if (stationsData) {
                console.log("[FleetContext] Mapped stationsData sample:", stationsData.slice(0, 2));
                setStations(stationsData.map(s => {
                    const lat = parseFloat(s.latitude);
                    const lon = parseFloat(s.longitude);
                    return {
                        ...s,
                        latitude: isNaN(lat) ? null : lat,
                        longitude: isNaN(lon) ? null : lon,
                        position: (!isNaN(lat) && !isNaN(lon)) ? [lat, lon] : null
                    };
                }));
            }
            if (vehiclesData) {
                const adaptedVehicles = vehiclesData.map(v => {
                    const pendingMnt = mntData.find(m => m.vehicle_id === v.id);
                    return {
                        id: v.id,
                        plate: v.plate,
                        model: v.model,
                        status: v.status === 'AVAILABLE' ? 'OPERACIONAL' : v.status === 'MAINTENANCE' ? 'MANUTENÇÃO' : 'EM ROTA',
                        currentKm: v.current_mileage,
                        revisionKm: v.next_maintenance_mileage,
                        stationId: v.current_station_id,
                        prefix: v.prefix,
                        area: v.area,
                        company_id: v.company_id,
                        type: v.type,
                        maintenanceReason: pendingMnt ? pendingMnt.description : null,
                        maintenanceDate: pendingMnt ? pendingMnt.service_date : null,
                        userName: pendingMnt ? pendingMnt.requester_name : null
                    };
                });
                setVehicles(adaptedVehicles);
            }

            if (routesData) {
                setRoutes(routesData.map(r => ({
                    ...r,
                    driver: r.driver_name
                })));
            }
        } catch (err) {
            console.error('Erro ao buscar dados do frotista:', err);
        } finally {
            clearTimeout(timeout);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user?.company_id || !supabase) {
            setLoading(false);
            return;
        }

        fetchData();

        // Real-time Subscriptions
        const channel = supabase
            .channel('fleet-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'fuel_stations',
                    filter: `company_id=eq.${user.company_id}`
                },
                () => {
                    console.log('Realtime update: Stations');
                    fetchData(true);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'vehicles',
                    filter: `company_id=eq.${user.company_id}`
                },
                () => {
                    console.log('Realtime update: Vehicles');
                    fetchData(true);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'routes',
                    filter: `company_id=eq.${user.company_id}`
                },
                () => {
                    console.log('Realtime update: Routes');
                    fetchData(true);
                }
            )
            .subscribe();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.company_id]);

    const requestMaintenance = async (vehicleId, reason, date) => {
        if (!supabase) return;
        const { error } = await supabase
            .from('vehicles')
            .update({ status: 'MAINTENANCE' })
            .eq('id', vehicleId);

        if (!error) {
            await supabase
                .from('maintenance_records')
                .insert([{
                    vehicle_id: vehicleId,
                    description: reason,
                    service_date: date,
                    company_id: user.company_id,
                    mileage_at_service: vehicles.find(v => v.id === vehicleId)?.currentKm || 0,
                    status: 'PENDING',
                    requester_name: user?.name || 'Sistema'
                }]);

            fetchData();
        }
    };

    const finishMaintenance = async (vehicleId) => {
        if (!supabase) return;
        const vehicle = vehicles.find(v => v.id === vehicleId);
        const newRevisionKm = (vehicle?.currentKm || 0) + 10000;

        // Update Vehicle Status
        const { error: vError } = await supabase
            .from('vehicles')
            .update({
                status: 'AVAILABLE',
                next_maintenance_mileage: newRevisionKm
            })
            .eq('id', vehicleId);

        if (!vError) {
            // Update all PENDING maintenance records for this vehicle to COMPLETED
            await supabase
                .from('maintenance_records')
                .update({ status: 'COMPLETED' })
                .eq('vehicle_id', vehicleId)
                .eq('status', 'PENDING');

            fetchData();
        }
    };

    const addVehicle = async (vehicleData) => {
        try {
            if (!supabase || !user?.company_id) return { success: false, message: 'Não autorizado.' };

            const { error } = await supabase
                .from('vehicles')
                .insert([{
                    plate: vehicleData.plate,
                    model: vehicleData.model,
                    prefix: vehicleData.prefix,
                    area: vehicleData.area,
                    current_mileage: vehicleData.currentKm,
                    next_maintenance_mileage: vehicleData.revisionKm,
                    current_station_id: vehicleData.stationId,
                    company_id: user.company_id,
                    status: 'AVAILABLE',
                    type: vehicleData.type || 'CARRO'
                }]);

            if (!error) {
                fetchData(true);
                return { success: true };
            } else {
                console.error('Erro ao adicionar veículo:', error);
                return { success: false, message: error.message || JSON.stringify(error) };
            }
        } catch (err) {
            console.error('Catch no addVehicle:', err);
            return { success: false, message: String(err) };
        }
    };

    const bulkAddVehicles = async (vehicles) => {
        if (!supabase || !user?.company_id) return { success: false, message: 'Não autorizado.' };

        const vehiclesToInsert = vehicles.map(v => ({
            ...v,
            company_id: user.company_id,
            status: 'AVAILABLE',
            type: v.type || 'CARRO'
        }));

        const { error } = await supabase
            .from('vehicles')
            .insert(vehiclesToInsert);

        if (!error) {
            fetchData();
            return { success: true };
        } else {
            console.error('Erro no import massivo:', error);
            return { success: false, message: error.message };
        }
    };

    const editVehicle = async (vehicleId, updatedData) => {
        try {
            if (!supabase || !user?.company_id) return { success: false, message: 'Não autorizado.' };

            const { error } = await supabase
                .from('vehicles')
                .update({
                    plate: updatedData.plate,
                    model: updatedData.model,
                    prefix: updatedData.prefix || null,
                    area: updatedData.area || null,
                    current_station_id: updatedData.stationId,
                    current_mileage: updatedData.currentKm,
                    type: updatedData.type || 'CARRO'
                })
                .eq('id', vehicleId)
                .eq('company_id', user.company_id);

            if (!error) {
                fetchData(true);
                return { success: true };
            } else {
                console.error('Erro ao editar veículo:', error);
                return { success: false, message: error.message || JSON.stringify(error) };
            }
        } catch (err) {
            console.error('Catch no editVehicle:', err);
            return { success: false, message: String(err) };
        }
    };

    const deleteVehicle = async (vehicleId) => {
        const { error } = await supabase
            .from('vehicles')
            .delete()
            .eq('id', vehicleId);

        if (!error) {
            fetchData();
        } else {
            console.error('Erro ao excluir veículo:', error);
            alert('Erro ao excluir veículo: ' + error.message);
        }
    };

    const updateVehicleKM = async (vehicleId, newKm, photoUrl = null) => {
        const { error } = await supabase
            .from('vehicles')
            .update({ current_mileage: Number(newKm) })
            .eq('id', vehicleId);

        if (!error) fetchData();
    };

    const submitChecklist = async (checklistData) => {
        if (!supabase || !user?.company_id) return { success: false, message: 'Não autorizado ou banco não configurado.' };

        // Determine performer_name
        let performerName = user?.name || 'Usuário Desconhecido';
        if (user?.role === 'FUNCIONARIO_POSTO' && user?.station_id) {
            const station = stations.find(s => s.id === user.station_id);
            if (station) {
                performerName = station.name;
            }
        }

        const { error } = await supabase
            .from('checklists')
            .insert([{
                vehicle_id: checklistData.vehicleId,
                user_id: user.id,
                company_id: user.company_id,

                type: checklistData.type,

                macaco: checklistData.macaco,
                estepe: checklistData.estepe,
                chave_roda: checklistData.chaveRoda,
                triangulo: checklistData.triangulo,
                radio: checklistData.radio,
                antena: checklistData.antena,
                sem_parar: checklistData.semParar,
                tapetes: checklistData.tapetes,
                calotas: checklistData.calotas,
                extintor: checklistData.extintor,
                cartao_ticket_car: checklistData.cartaoTicketCar,
                ar_condicionado: checklistData.arCondicionado,
                crlv: checklistData.crlv,
                bateria: checklistData.bateria,
                trava: checklistData.trava,
                manual: checklistData.manual,
                giroflex: checklistData.giroflex,

                pneus_dianteiros: checklistData.pneusDianteiros,
                pneus_traseiros: checklistData.pneusTraseiros,
                pneu_estepe: checklistData.pneuEstepe,

                current_km: checklistData.currentKm ? Number(checklistData.currentKm) : 0,
                km_photo: checklistData.kmPhoto || null,

                fuel_level: checklistData.fuelLevel,
                damages_diagram: checklistData.damagesDiagram,
                observations: checklistData.observations,
                performer_name: performerName,
                signature: checklistData.signature
            }]);

        if (error) {
            console.error('Erro ao salvar checklist no Supabase:', error);
            console.error('Detalhes do erro:', JSON.stringify(error, null, 2));
            return { success: false, message: error.message || 'Erro desconhecido ao salvar' };
        }

        // Atualiza também o KM atual do veículo em si para mante-lo sincronizado
        if (checklistData.currentKm) {
            const { error: errorKm } = await supabase
                .from('vehicles')
                .update({
                    current_mileage: Number(checklistData.currentKm)
                })
                .eq('id', checklistData.vehicleId);

            if (!errorKm) {
                setVehicles(prev => prev.map(v => v.id === checklistData.vehicleId ? { ...v, currentKm: Number(checklistData.currentKm) } : v));
            }
        }

        // To ensure we get fresh data immediately on the history page:
        fetchData();

        return { success: true };
    };

    const getChecklists = async () => {
        if (!supabase || !user?.company_id) return [];

        let query = supabase
            .from('checklists')
            .select(`
                *,
                vehicle:vehicles (
                    plate,
                    model,
                    prefix
                )
            `)
            .eq('company_id', user.company_id)
            .order('created_at', { ascending: false })
            .limit(5000);

        // Restringir visibilidade para Colaboradores e Funcionários de Posto
        if (user?.role !== 'ADMIN' && user?.role !== 'LIDER') {
            query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Erro ao buscar históricos de checklist:', error);
            console.error('Detalhes do erro:', JSON.stringify(error, null, 2));
            return [];
        }

        console.log("DEBUG getChecklists data from DB:", data);

        return data.map(item => ({
            ...item,
            vehicle: Array.isArray(item.vehicle) ? item.vehicle[0] : item.vehicle,
            userName: item.performer_name || 'Desconhecido'
        }));
    };

    const updateChecklist = async (id, updatedData) => {
        if (!supabase || !user?.company_id) return { success: false, message: 'Não autorizado.' };

        const { error } = await supabase
            .from('checklists')
            .update(updatedData)
            .eq('id', id)
            .eq('company_id', user.company_id);

        if (error) {
            console.error('Erro ao editar checklist:', error);
            return { success: false, message: error.message };
        }
        return { success: true };
    };

    const deleteChecklist = async (id) => {
        if (!supabase || !user?.company_id) return { success: false, message: 'Não autorizado.' };

        const { error } = await supabase
            .from('checklists')
            .delete()
            .eq('id', id)
            .eq('company_id', user.company_id);

        if (error) {
            console.error('Erro ao deletar checklist:', error);
            return { success: false, message: error.message };
        }
        return { success: true };
    };

    const addStation = async (stationData) => {
        try {
            if (!supabase || !user?.company_id) return { success: false, message: 'Não autorizado. Faltando Company ID.' };

            const { error } = await supabase
                .from('fuel_stations')
                .insert([{
                    name: stationData.name,
                    address: stationData.address,
                    latitude: stationData.position?.[0] || null,
                    longitude: stationData.position?.[1] || null,
                    company_id: user.company_id,
                    partner: stationData.partner || false
                }]);

            if (!error) {
                console.log("[FleetContext] addStation succeeded. Invoking fetchData(true).");
                fetchData(true);
                return { success: true };
            } else {
                console.error('[FleetContext] Erro ao adicionar posto no DB:', error);
                return { success: false, message: error.message || JSON.stringify(error) };
            }
        } catch (err) {
            console.error('Catch no addStation:', err);
            return { success: false, message: String(err) };
        }
    };

    const bulkAddStations = async (stationsData) => {
        if (!supabase || !user?.company_id) return { success: false, message: 'Não autorizado.' };

        const stationsToInsert = stationsData.map(s => ({
            ...s,
            company_id: user.company_id,
            partner: s.partner ?? false
        }));

        const { error } = await supabase
            .from('fuel_stations')
            .insert(stationsToInsert);

        if (!error) {
            fetchData();
            return { success: true };
        } else {
            console.error('Erro no import de postos:', error);
            return { success: false, message: error.message };
        }
    };

    const editStation = async (stationId, updatedData) => {
        try {
            if (!supabase || !user?.company_id) return { success: false, message: 'Não autorizado.' };

            const updateObject = {
                name: updatedData.name,
                address: updatedData.address
            };

            // Somente sobrescreve coordenadas se o Mapa de Geoconding retornou nova Posição
            if (updatedData.position && updatedData.position.length === 2) {
                updateObject.latitude = updatedData.position[0];
                updateObject.longitude = updatedData.position[1];
            }

            const { error } = await supabase
                .from('fuel_stations')
                .update(updateObject)
                .eq('id', stationId)
                .eq('company_id', user.company_id);

            if (!error) {
                console.log("[FleetContext] editStation succeeded. Invoking fetchData(true).");
                fetchData(true);
                return { success: true };
            } else {
                console.error('[FleetContext] Erro ao editar posto no DB:', error);
                return { success: false, message: error.message || JSON.stringify(error) };
            }
        } catch (err) {
            console.error('Catch no editStation:', err);
            return { success: false, message: String(err) };
        }
    };

    const deleteStation = async (stationId) => {
        const { error } = await supabase
            .from('fuel_stations')
            .delete()
            .eq('id', stationId);

        if (!error) fetchData(true);
    };

    const vehiclesByStationMap = React.useMemo(() => {
        const map = {};
        vehicles.forEach(v => {
            if (v.stationId) {
                if (!map[v.stationId]) map[v.stationId] = [];
                map[v.stationId].push(v);
            }
        });
        return map;
    }, [vehicles]);

    const getVehiclesByStation = React.useCallback((stationId) => {
        return vehiclesByStationMap[stationId] || [];
    }, [vehiclesByStationMap]);

    const addRoute = async (routeData) => {
        if (!supabase) return;
        const { error } = await supabase
            .from('routes')
            .insert([{
                points: routeData.points,
                driver_name: routeData.driver,
                company_id: user.company_id,
                status: 'AGENDADA',
                observations: routeData.observations || null,
                order_index: (routes.length > 0) ? Math.max(...routes.map(r => r.order_index || 0)) + 1 : 1
            }]);

        if (!error) fetchData();
    };

    const editRoute = async (routeId, updatedData) => {
        const { error } = await supabase
            .from('routes')
            .update({
                points: updatedData.points,
                driver_name: updatedData.driver,
                observations: updatedData.observations || null
            })
            .eq('id', routeId);

        if (!error) fetchData();
    };

    const deleteRoute = async (routeId) => {
        const { error } = await supabase
            .from('routes')
            .delete()
            .eq('id', routeId);

        if (!error) fetchData();
    };

    const updateRouteStatus = async (routeId, status) => {
        const { error } = await supabase
            .from('routes')
            .update({ status })
            .eq('id', routeId);

        if (!error) fetchData();
    };

    const updateRoutesOrder = async (reorderedRoutes) => {
        if (!supabase) return;

        // Update each route with its new order_index
        const promises = reorderedRoutes.map((route, index) =>
            supabase
                .from('routes')
                .update({ order_index: index + 1 })
                .eq('id', route.id)
        );

        await Promise.all(promises);
        fetchData(true);
    };

    return (
        <FleetContext.Provider value={{
            vehicles,
            stations,
            routes,
            loading,
            requestMaintenance,
            finishMaintenance,
            addVehicle,
            bulkAddVehicles,
            editVehicle,
            deleteVehicle,
            updateVehicleKM,
            addStation,
            bulkAddStations,
            editStation,
            deleteStation,
            addRoute,
            editRoute,
            deleteRoute,
            updateRouteStatus,
            updateRoutesOrder,
            submitChecklist,
            getChecklists,
            updateChecklist,
            deleteChecklist,
            fetchData,
            getVehiclesByStation,
            refreshData: fetchData
        }}>
            {children}
        </FleetContext.Provider>
    );
};

export const useFleet = () => {
    const context = useContext(FleetContext);
    if (!context) {
        throw new Error('useFleet deve ser usado dentro de um FleetProvider');
    }
    return context;
};
