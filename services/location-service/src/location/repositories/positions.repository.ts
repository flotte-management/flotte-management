import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreatePositionDto } from '../dto/create-position.dto';
import { PositionRecord } from '../types/location.types';

type PositionRow = {
  id: number;
  time: string;
  vehiculeId: string;
  latitude: number;
  longitude: number;
  vitesse: number | null;
  cap: number | null;
  precision: number | null;
};

@Injectable()
export class PositionsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async insertPosition(
    payload: CreatePositionDto,
    recordedAt: string,
  ): Promise<PositionRecord> {
    const result = await this.databaseService.query<PositionRow>(
      `
        INSERT INTO positions_gps (
          "time",
          vehicule_id,
          latitude,
          longitude,
          vitesse,
          cap,
          precision_metres
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          "time"::text AS "time",
          vehicule_id AS "vehiculeId",
          latitude,
          longitude,
          vitesse,
          cap,
          precision_metres AS "precision";
      `,
      [
        recordedAt,
        payload.vehiculeId,
        payload.latitude,
        payload.longitude,
        payload.vitesse ?? null,
        payload.cap ?? null,
        payload.precision ?? null,
      ],
    );

    return result.rows[0];
  }

  async findLatestByVehicle(
    vehiculeId: string,
  ): Promise<PositionRecord | null> {
    const result = await this.databaseService.query<PositionRow>(
      `
        SELECT
          id,
          "time"::text AS "time",
          vehicule_id AS "vehiculeId",
          latitude,
          longitude,
          vitesse,
          cap,
          precision_metres AS "precision"
        FROM positions_gps
        WHERE vehicule_id = $1
        ORDER BY "time" DESC, id DESC
        LIMIT 1;
      `,
      [vehiculeId],
    );

    return result.rows[0] ?? null;
  }

  async findLatestBefore(
    vehiculeId: string,
    recordedAt: string,
  ): Promise<PositionRecord | null> {
    const result = await this.databaseService.query<PositionRow>(
      `
        SELECT
          id,
          "time"::text AS "time",
          vehicule_id AS "vehiculeId",
          latitude,
          longitude,
          vitesse,
          cap,
          precision_metres AS "precision"
        FROM positions_gps
        WHERE vehicule_id = $1
          AND "time" < $2::timestamptz
        ORDER BY "time" DESC, id DESC
        LIMIT 1;
      `,
      [vehiculeId, recordedAt],
    );

    return result.rows[0] ?? null;
  }

  async findHistory(
    vehiculeId: string,
    from: string,
    to: string,
  ): Promise<PositionRecord[]> {
    const result = await this.databaseService.query<PositionRow>(
      `
        SELECT
          id,
          "time"::text AS "time",
          vehicule_id AS "vehiculeId",
          latitude,
          longitude,
          vitesse,
          cap,
          precision_metres AS "precision"
        FROM positions_gps
        WHERE vehicule_id = $1
          AND "time" >= $2::timestamptz
          AND "time" <= $3::timestamptz
        ORDER BY "time" ASC, id ASC;
      `,
      [vehiculeId, from, to],
    );

    return result.rows;
  }
}
