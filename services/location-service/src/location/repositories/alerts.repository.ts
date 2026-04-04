import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import {
  AlertFilters,
  GeofenceAlertRecord,
  GeofenceAlertType,
  PagedAlertsResult,
} from '../types/location.types';

type AlertRow = {
  id: string;
  vehiculeId: string;
  zoneId: string;
  typeAlerte: GeofenceAlertType;
  detecteLe: string;
  zoneNom?: string;
  zoneType?: string;
};

type AlertCountRow = {
  total: string;
};

@Injectable()
export class AlertsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createAlert(payload: {
    vehiculeId: string;
    zoneId: string;
    typeAlerte: GeofenceAlertType;
    detecteLe: string;
  }): Promise<GeofenceAlertRecord> {
    const result = await this.databaseService.query<AlertRow>(
      `
        INSERT INTO alertes_geofencing (
          id,
          vehicule_id,
          zone_id,
          type_alerte,
          detecte_le
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          vehicule_id AS "vehiculeId",
          zone_id AS "zoneId",
          type_alerte AS "typeAlerte",
          detecte_le::text AS "detecteLe";
      `,
      [
        randomUUID(),
        payload.vehiculeId,
        payload.zoneId,
        payload.typeAlerte,
        payload.detecteLe,
      ],
    );

    return result.rows[0];
  }

  async listRecent(filters: AlertFilters): Promise<PagedAlertsResult> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let index = 1;

    if (filters.vehiculeId) {
      conditions.push(`a.vehicule_id = $${index++}`);
      params.push(filters.vehiculeId);
    }

    if (filters.zoneId) {
      conditions.push(`a.zone_id = $${index++}`);
      params.push(filters.zoneId);
    }

    if (filters.typeAlerte) {
      conditions.push(`a.type_alerte = $${index++}`);
      params.push(filters.typeAlerte);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (filters.page - 1) * filters.limit;

    const countResult = await this.databaseService.query<AlertCountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM alertes_geofencing a
        ${whereClause};
      `,
      params,
    );

    params.push(filters.limit, offset);

    const result = await this.databaseService.query<AlertRow>(
      `
        SELECT
          a.id,
          a.vehicule_id AS "vehiculeId",
          a.zone_id AS "zoneId",
          a.type_alerte AS "typeAlerte",
          a.detecte_le::text AS "detecteLe",
          z.nom AS "zoneNom",
          z.type AS "zoneType"
        FROM alertes_geofencing a
        JOIN zones_geofencing z ON z.id = a.zone_id
        ${whereClause}
        ORDER BY a.detecte_le DESC
        LIMIT $${index++}
        OFFSET $${index};
      `,
      params,
    );

    return {
      items: result.rows,
      page: filters.page,
      limit: filters.limit,
      total: Number(countResult.rows[0]?.total ?? 0),
    };
  }

  async countForVehicleInRange(
    vehiculeId: string,
    from: string,
    to: string,
  ): Promise<number> {
    const result = await this.databaseService.query<AlertCountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM alertes_geofencing
        WHERE vehicule_id = $1
          AND detecte_le >= $2::timestamptz
          AND detecte_le <= $3::timestamptz;
      `,
      [vehiculeId, from, to],
    );

    return Number(result.rows[0]?.total ?? 0);
  }
}
