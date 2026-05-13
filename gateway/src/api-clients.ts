/**
 * Type-safe REST client for upstream microservices.
 * All requests forward the user's Authorization header.
 */
import { config } from './config.js';
import { logger } from './logger.js';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ServiceError extends Error {
  constructor(
    public readonly service: string,
    public readonly status: number,
    message: string,
  ) {
    super(`[${service}] HTTP ${status}: ${message}`);
    this.name = 'ServiceError';
  }
}

async function request<T>(
  serviceUrl: string,
  serviceName: string,
  path: string,
  method: Method,
  token?: string,
  body?: unknown,
): Promise<T> {
  const url = `${serviceUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const fetchFn = (await import('node-fetch')).default;
  const res = await fetchFn(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ServiceError(serviceName, res.status, text);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Vehicle Service ─────────────────────────────────────────────────────────

export const vehicleApi = {
  list:            (q: string, token?: string) =>
    request(config.services.vehicles, 'vehicle-service', `/api/v1/vehicules${q}`, 'GET', token),
  getById:         (id: string, token?: string) =>
    request(config.services.vehicles, 'vehicle-service', `/api/v1/vehicules/${id}`, 'GET', token),
  create:          (body: unknown, token?: string) =>
    request(config.services.vehicles, 'vehicle-service', '/api/v1/vehicules', 'POST', token, body),
  update:          (id: string, body: unknown, token?: string) =>
    request(config.services.vehicles, 'vehicle-service', `/api/v1/vehicules/${id}`, 'PUT', token, body),
  changeStatut:    (id: string, body: unknown, token?: string) =>
    request(config.services.vehicles, 'vehicle-service', `/api/v1/vehicules/${id}/statut`, 'PATCH', token, body),
  delete:          (id: string, token?: string) =>
    request(config.services.vehicles, 'vehicle-service', `/api/v1/vehicules/${id}`, 'DELETE', token),
  historique:      (id: string, token?: string) =>
    request(config.services.vehicles, 'vehicle-service', `/api/v1/vehicules/${id}/historique`, 'GET', token),
};

// ─── Driver Service ───────────────────────────────────────────────────────────

export const driverApi = {
  list:                 (q: string, token?: string) =>
    request(config.services.drivers, 'driver-service', `/api/v1/drivers${q}`, 'GET', token),
  getById:              (id: string, token?: string) =>
    request(config.services.drivers, 'driver-service', `/api/v1/drivers/${id}`, 'GET', token),
  create:               (body: unknown, token?: string) =>
    request(config.services.drivers, 'driver-service', '/api/v1/drivers', 'POST', token, body),
  update:               (id: string, body: unknown, token?: string) =>
    request(config.services.drivers, 'driver-service', `/api/v1/drivers/${id}`, 'PUT', token, body),
  updateStatut:         (id: string, body: unknown, token?: string) =>
    request(config.services.drivers, 'driver-service', `/api/v1/drivers/${id}/statut`, 'PATCH', token, body),
  delete:               (id: string, token?: string) =>
    request(config.services.drivers, 'driver-service', `/api/v1/drivers/${id}`, 'DELETE', token),
  /** Returns the driver whose active assignation matches this vehiculeId */
  getActiveByVehicule:  async (vehiculeId: string, token?: string) => {
    // The driver-service has no direct endpoint by vehiculeId; fetch all active drivers
    // and find the one assigned to this vehicle via their active assignation.
    // Fallback: query drivers list with vehiculeId param (if supported), else null.
    try {
      const q = `?vehicule_id=${encodeURIComponent(vehiculeId)}&limit=1`;
      const list = await request<unknown[]>(config.services.drivers, 'driver-service', `/api/v1/drivers${q}`, 'GET', token);
      return Array.isArray(list) && list.length > 0 ? list[0] : null;
    } catch {
      return null;
    }
  },
  getActiveAssignation: (driverId: string, token?: string) =>
    request(config.services.drivers, 'driver-service', `/api/v1/drivers/${driverId}/assignations/active`, 'GET', token).catch(() => null),
  addAssignation:       (driverId: string, body: unknown, token?: string) =>
    request(config.services.drivers, 'driver-service', `/api/v1/drivers/${driverId}/assignations`, 'POST', token, body),
  closeAssignation:     (driverId: string, assignationId: string, body: unknown, token?: string) =>
    request(config.services.drivers, 'driver-service', `/api/v1/drivers/${driverId}/assignations/${assignationId}`, 'PATCH', token, body),
};

// ─── Mission Service ──────────────────────────────────────────────────────────

export const missionApi = {
  list:               (q: string, token?: string) =>
    request(config.services.missions, 'mission-service', `/api/v1/missions${q}`, 'GET', token),
  getById:            (id: string, token?: string) =>
    request(config.services.missions, 'mission-service', `/api/v1/missions/${id}`, 'GET', token),
  create:             (body: unknown, token?: string) =>
    request(config.services.missions, 'mission-service', '/api/v1/missions', 'POST', token, body),
  changeStatut:       (id: string, body: unknown, token?: string) =>
    request(config.services.missions, 'mission-service', `/api/v1/missions/${id}/statut`, 'PATCH', token, body),
  delete:             (id: string, token?: string) =>
    request(config.services.missions, 'mission-service', `/api/v1/missions/${id}`, 'DELETE', token),
  getActiveByVehicule: async (vehiculeId: string, token?: string) => {
    try {
      const q = `?vehiculeId=${encodeURIComponent(vehiculeId)}&statut=EN_COURS&limit=1`;
      const list = await request<unknown[]>(config.services.missions, 'mission-service', `/api/v1/missions${q}`, 'GET', token);
      return Array.isArray(list) && list.length > 0 ? list[0] : null;
    } catch {
      return null;
    }
  },
};

// ─── Maintenance Service ──────────────────────────────────────────────────────

export const maintenanceApi = {
  list:            (q: string, token?: string) =>
    request(config.services.maintenance, 'maintenance-service', `/api/v1/maintenances${q}`, 'GET', token),
  getById:         (id: string, token?: string) =>
    request(config.services.maintenance, 'maintenance-service', `/api/v1/maintenances/${id}`, 'GET', token),
  create:          (body: unknown, token?: string) =>
    request(config.services.maintenance, 'maintenance-service', '/api/v1/maintenances', 'POST', token, body),
  update:          (id: string, body: unknown, token?: string) =>
    request(config.services.maintenance, 'maintenance-service', `/api/v1/maintenances/${id}`, 'PATCH', token, body),
  changeStatut:    (id: string, statut: string, token?: string) =>
    request(config.services.maintenance, 'maintenance-service', `/api/v1/maintenances/${id}/statut?statut=${statut}`, 'PATCH', token),
  delete:          (id: string, token?: string) =>
    request(config.services.maintenance, 'maintenance-service', `/api/v1/maintenances/${id}`, 'DELETE', token),
  byVehicule:      (vehiculeId: string, token?: string) =>
    request(config.services.maintenance, 'maintenance-service', `/api/v1/maintenances/vehicules/${vehiculeId}/maintenances`, 'GET', token),
};

// ─── Location Service ─────────────────────────────────────────────────────────

export const locationApi = {
  latestPosition:  (vehiculeId: string, token?: string) =>
    request(config.services.location, 'location-service', `/localisation/${vehiculeId}/position`, 'GET', token),
  history:         (vehiculeId: string, q: string, token?: string) =>
    request(config.services.location, 'location-service', `/localisation/${vehiculeId}/historique${q}`, 'GET', token),
  ingest:          (body: unknown, token?: string) =>
    request(config.services.location, 'location-service', '/localisation/positions', 'POST', token, body),
};
