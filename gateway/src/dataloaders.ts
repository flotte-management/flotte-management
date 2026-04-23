import DataLoader from 'dataloader';
import { vehicleApi, driverApi } from './api-clients.js';

// ─── Vehicle DataLoader ───────────────────────────────────────────────────────

export function createVehiculeLoader(token?: string) {
  return new DataLoader<string, unknown>(async (ids) => {
    const results = await Promise.allSettled(
      ids.map((id) => vehicleApi.getById(id, token)),
    );
    return results.map((r) => (r.status === 'fulfilled' ? r.value : null));
  });
}

// ─── Driver DataLoader ────────────────────────────────────────────────────────

export function createConducteurLoader(token?: string) {
  return new DataLoader<string, unknown>(async (ids) => {
    const results = await Promise.allSettled(
      ids.map((id) => driverApi.getById(id, token)),
    );
    return results.map((r) => (r.status === 'fulfilled' ? r.value : null));
  });
}

export interface Loaders {
  vehiculeLoader:    DataLoader<string, unknown>;
  conducteurLoader:  DataLoader<string, unknown>;
}

export function createLoaders(token?: string): Loaders {
  return {
    vehiculeLoader:   createVehiculeLoader(token),
    conducteurLoader: createConducteurLoader(token),
  };
}
