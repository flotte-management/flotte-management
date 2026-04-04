export type GeofenceAlertType = 'ENTER' | 'EXIT';

export interface PositionRecord {
  id: number;
  time: string;
  vehiculeId: string;
  latitude: number;
  longitude: number;
  vitesse: number | null;
  cap: number | null;
  precision: number | null;
}

export interface ZonePoint {
  latitude: number;
  longitude: number;
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface ZoneRecord {
  id: string;
  nom: string;
  type: string;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
  geometry: GeoJsonPolygon;
}

export interface ZoneMembership {
  id: string;
  nom: string;
  type: string;
}

export interface GeofenceAlertRecord {
  id: string;
  vehiculeId: string;
  zoneId: string;
  typeAlerte: GeofenceAlertType;
  detecteLe: string;
  zoneNom?: string;
  zoneType?: string;
}

export interface AlertFilters {
  page: number;
  limit: number;
  vehiculeId?: string;
  zoneId?: string;
  typeAlerte?: GeofenceAlertType;
}

export interface PagedAlertsResult {
  items: GeofenceAlertRecord[];
  page: number;
  limit: number;
  total: number;
}

export interface LocationAnalysisResult {
  vehicleId: string;
  from: string;
  to: string;
  provider: 'rule-based-agent' | 'disabled';
  pointsAnalysed: number;
  totalDistanceKm: number;
  averageSpeedKph: number | null;
  maxSpeedKph: number | null;
  alertCount: number;
  latestPosition: PositionRecord | null;
  insights: string[];
}
