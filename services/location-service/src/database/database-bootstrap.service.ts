import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { DatabaseService } from './database.service';

@Injectable()
export class DatabaseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.dbAutoBootstrap) {
      this.logger.log('Database auto-bootstrap disabled');
      return;
    }

    try {
      await this.ensureExtensions();
      await this.ensureSchema();
      this.logger.log('Database bootstrap completed');
    } catch (error) {
      if (this.config.dbAllowStartWithoutDatabase) {
        this.logger.error(
          'Database bootstrap failed but startup is allowed without database connectivity',
          error instanceof Error ? error.stack : undefined,
        );
        return;
      }

      throw error;
    }
  }

  private async ensureExtensions(): Promise<void> {
    await this.databaseService.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    await this.databaseService.query(
      'CREATE EXTENSION IF NOT EXISTS timescaledb;',
    );
  }

  private async ensureSchema(): Promise<void> {
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS positions_gps (
        id BIGSERIAL,
        "time" TIMESTAMPTZ NOT NULL,
        vehicule_id VARCHAR(64) NOT NULL,
        latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
        longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
        vitesse DOUBLE PRECISION,
        cap DOUBLE PRECISION CHECK (cap BETWEEN 0 AND 360),
        precision_metres DOUBLE PRECISION,
        geom geometry(Point, 4326) GENERATED ALWAYS AS (
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
        ) STORED,
        PRIMARY KEY (id, "time")
      );
    `);

    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS zones_geofencing (
        id UUID PRIMARY KEY,
        nom VARCHAR(120) NOT NULL,
        type VARCHAR(60) NOT NULL,
        geometrie geometry(Polygon, 4326) NOT NULL,
        actif BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS alertes_geofencing (
        id UUID PRIMARY KEY,
        vehicule_id VARCHAR(64) NOT NULL,
        zone_id UUID NOT NULL REFERENCES zones_geofencing(id) ON DELETE CASCADE,
        type_alerte VARCHAR(32) NOT NULL CHECK (type_alerte IN ('ENTER', 'EXIT')),
        detecte_le TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.databaseService.query(`
      SELECT create_hypertable(
        'positions_gps',
        'time',
        if_not_exists => TRUE,
        migrate_data => TRUE
      );
    `);

    await this.databaseService.query(`
      CREATE INDEX IF NOT EXISTS idx_positions_vehicle_time
      ON positions_gps (vehicule_id, "time" DESC);
    `);

    await this.databaseService.query(`
      CREATE INDEX IF NOT EXISTS idx_positions_time
      ON positions_gps ("time" DESC);
    `);

    await this.databaseService.query(`
      CREATE INDEX IF NOT EXISTS idx_positions_geom
      ON positions_gps USING GIST (geom);
    `);

    await this.databaseService.query(`
      CREATE INDEX IF NOT EXISTS idx_zones_geofencing_geom
      ON zones_geofencing USING GIST (geometrie);
    `);

    await this.databaseService.query(`
      CREATE INDEX IF NOT EXISTS idx_alertes_detecte_le
      ON alertes_geofencing (detecte_le DESC);
    `);

    await this.databaseService.query(`
      CREATE INDEX IF NOT EXISTS idx_alertes_vehicle_detecte_le
      ON alertes_geofencing (vehicule_id, detecte_le DESC);
    `);
  }
}
