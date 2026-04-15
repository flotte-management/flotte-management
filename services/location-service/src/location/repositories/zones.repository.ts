import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import {
  GeoJsonPolygon,
  ZoneMembership,
  ZoneRecord,
} from '../types/location.types';

type ZoneRow = {
  id: string;
  nom: string;
  type: string;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
  geometry: GeoJsonPolygon | string;
};

type ZoneMembershipRow = {
  id: string;
  nom: string;
  type: string;
};

@Injectable()
export class ZonesRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(): Promise<ZoneRecord[]> {
    const result = await this.databaseService.query<ZoneRow>(`
      SELECT
        id,
        nom,
        type,
        actif,
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt",
        ST_AsGeoJSON(geometrie)::json AS geometry
      FROM zones_geofencing
      ORDER BY created_at DESC;
    `);

    return result.rows.map((row) => this.mapZone(row));
  }

  async createZone(payload: {
    nom: string;
    type: string;
    actif: boolean;
    geometry: GeoJsonPolygon;
  }): Promise<ZoneRecord> {
    const result = await this.databaseService.query<ZoneRow>(
      `
        INSERT INTO zones_geofencing (
          id,
          nom,
          type,
          geometrie,
          actif
        )
        VALUES (
          $1,
          $2,
          $3,
          ST_SetSRID(ST_GeomFromGeoJSON($4), 4326),
          $5
        )
        RETURNING
          id,
          nom,
          type,
          actif,
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt",
          ST_AsGeoJSON(geometrie)::json AS geometry;
      `,
      [
        randomUUID(),
        payload.nom,
        payload.type,
        JSON.stringify(payload.geometry),
        payload.actif,
      ],
    );

    return this.mapZone(result.rows[0]);
  }

  async updateZone(
    id: string,
    payload: {
      nom?: string;
      type?: string;
      actif?: boolean;
      geometry?: GeoJsonPolygon;
    },
  ): Promise<ZoneRecord | null> {
    const assignments: string[] = [];
    const params: unknown[] = [];
    let index = 1;

    if (payload.nom !== undefined) {
      assignments.push(`nom = $${index++}`);
      params.push(payload.nom);
    }

    if (payload.type !== undefined) {
      assignments.push(`type = $${index++}`);
      params.push(payload.type);
    }

    if (payload.actif !== undefined) {
      assignments.push(`actif = $${index++}`);
      params.push(payload.actif);
    }

    if (payload.geometry !== undefined) {
      assignments.push(
        `geometrie = ST_SetSRID(ST_GeomFromGeoJSON($${index++}), 4326)`,
      );
      params.push(JSON.stringify(payload.geometry));
    }

    assignments.push('updated_at = NOW()');
    params.push(id);

    const result = await this.databaseService.query<ZoneRow>(
      `
        UPDATE zones_geofencing
        SET ${assignments.join(', ')}
        WHERE id = $${index}
        RETURNING
          id,
          nom,
          type,
          actif,
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt",
          ST_AsGeoJSON(geometrie)::json AS geometry;
      `,
      params,
    );

    return result.rows[0] ? this.mapZone(result.rows[0]) : null;
  }

  async deleteZone(id: string): Promise<boolean> {
    const result = await this.databaseService.query(
      `
        DELETE FROM zones_geofencing
        WHERE id = $1;
      `,
      [id],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async findContainingZones(
    latitude: number,
    longitude: number,
  ): Promise<ZoneMembership[]> {
    const result = await this.databaseService.query<ZoneMembershipRow>(
      `
        SELECT id, nom, type
        FROM zones_geofencing
        WHERE actif = TRUE
          AND ST_Covers(
            geometrie,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)
          );
      `,
      [longitude, latitude],
    );

    return result.rows;
  }

  private mapZone(row: ZoneRow): ZoneRecord {
    return {
      id: row.id,
      nom: row.nom,
      type: row.type,
      actif: row.actif,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      geometry:
        typeof row.geometry === 'string'
          ? (JSON.parse(row.geometry) as GeoJsonPolygon)
          : row.geometry,
    };
  }
}
