export const canManageVehicles = (role) => {
    return role === 'ADMIN';
};

export const canManageMaintenance = (role) => {
    return role === 'ADMIN' || role === 'LIDER' || role === 'FUNCIONARIO_POSTO';
};

export const canDefineRoutes = (role) => {
    return role === 'ADMIN' || role === 'LIDER';
};

export const canAddFuelStations = (role) => {
    return role === 'ADMIN';
};

export const canCompleteRoutes = (role) => {
    return role === 'ADMIN' || role === 'LIDER' || role === 'COLABORADOR';
};
