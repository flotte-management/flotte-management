import { Counter } from 'prom-client';

export const missionsCreatedTotal = new Counter({
  name: 'fleet_missions_created_total',
  help: 'Nombre de missions creees',
});

export const missionsDeletedTotal = new Counter({
  name: 'fleet_missions_deleted_total',
  help: 'Nombre de missions supprimees',
});

export const missionsStatusChangedTotal = new Counter({
  name: 'fleet_missions_status_changed_total',
  help: 'Nombre de changements de statut de mission',
  labelNames: ['status'],
});

export const missionsStartedTotal = new Counter({
  name: 'fleet_missions_started_total',
  help: 'Nombre de missions demarrees',
});

export const missionsCompletedTotal = new Counter({
  name: 'fleet_missions_completed_total',
  help: 'Nombre de missions terminees',
});

export const missionsCancelledTotal = new Counter({
  name: 'fleet_missions_cancelled_total',
  help: 'Nombre de missions annulees',
});

export const etapesAddedTotal = new Counter({
  name: 'fleet_mission_etapes_added_total',
  help: 'Nombre d\'etapes ajoutees a une mission',
});

export const etapesUpdatedTotal = new Counter({
  name: 'fleet_mission_etapes_updated_total',
  help: 'Nombre d\'etapes modifiees',
});

export function recordMissionCreated(): void {
  missionsCreatedTotal.inc();
}

export function recordMissionDeleted(): void {
  missionsDeletedTotal.inc();
}

export function recordMissionStatusChanged(status: string): void {
  missionsStatusChangedTotal.labels(status).inc();
}

export function recordMissionStarted(): void {
  missionsStartedTotal.inc();
}

export function recordMissionCompleted(): void {
  missionsCompletedTotal.inc();
}

export function recordMissionCancelled(): void {
  missionsCancelledTotal.inc();
}

export function recordEtapeAdded(): void {
  etapesAddedTotal.inc();
}

export function recordEtapeUpdated(): void {
  etapesUpdatedTotal.inc();
}

