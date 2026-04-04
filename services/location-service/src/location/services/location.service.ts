import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DOMAIN_EVENT_PUBLISHER } from '../../events/event-publisher.constants';
import type { DomainEventPublisher } from '../../events/domain-event-publisher.interface';
import { AnalyseLocationQueryDto } from '../dto/analyse-location-query.dto';
import { CreatePositionDto } from '../dto/create-position.dto';
import { CreateZoneDto } from '../dto/create-zone.dto';
import { GetAlertsQueryDto } from '../dto/get-alerts-query.dto';
import { GetHistoryQueryDto } from '../dto/get-history-query.dto';
import { UpdateZoneDto } from '../dto/update-zone.dto';
import { AlertsRepository } from '../repositories/alerts.repository';
import { PositionsRepository } from '../repositories/positions.repository';
import { ZonesRepository } from '../repositories/zones.repository';
import {
  GeoJsonPolygon,
  PositionRecord,
  ZonePoint,
} from '../types/location.types';
import { GeofencingService } from './geofencing.service';
import { LocationInsightsAgentService } from './location-insights-agent.service';
import { RealtimeVehicleStreamService } from './realtime-vehicle-stream.service';

@Injectable()
export class LocationService {
  constructor(
    private readonly positionsRepository: PositionsRepository,
    private readonly zonesRepository: ZonesRepository,
    private readonly alertsRepository: AlertsRepository,
    private readonly geofencingService: GeofencingService,
    private readonly realtimeVehicleStreamService: RealtimeVehicleStreamService,
    private readonly insightsAgentService: LocationInsightsAgentService,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async ingestPosition(payload: CreatePositionDto): Promise<PositionRecord> {
    const recordedAt = payload.time ?? new Date().toISOString();
    const previousPosition = await this.positionsRepository.findLatestBefore(
      payload.vehiculeId,
      recordedAt,
    );
    const createdPosition = await this.positionsRepository.insertPosition(
      payload,
      recordedAt,
    );

    await this.eventPublisher.publish(
      'position.updated',
      {
        vehiculeId: createdPosition.vehiculeId,
        time: createdPosition.time,
        latitude: createdPosition.latitude,
        longitude: createdPosition.longitude,
        vitesse: createdPosition.vitesse,
        cap: createdPosition.cap,
        precision: createdPosition.precision,
      },
      payload.correlationId,
    );

    await this.geofencingService.evaluateTransition(
      previousPosition,
      createdPosition,
      payload.correlationId,
    );

    this.realtimeVehicleStreamService.publish(createdPosition);

    return createdPosition;
  }

  async getLatestPosition(vehiculeId: string): Promise<PositionRecord> {
    const position =
      await this.positionsRepository.findLatestByVehicle(vehiculeId);

    if (!position) {
      throw new NotFoundException(
        `No known position found for vehicle ${vehiculeId}`,
      );
    }

    return position;
  }

  async getHistory(vehiculeId: string, query: GetHistoryQueryDto) {
    const range = this.validateDateRange(query.from, query.to);
    const history = await this.positionsRepository.findHistory(
      vehiculeId,
      range.from,
      range.to,
    );

    return {
      vehiculeId,
      from: range.from,
      to: range.to,
      count: history.length,
      items: history,
    };
  }

  async listZones() {
    return this.zonesRepository.findAll();
  }

  async createZone(payload: CreateZoneDto) {
    return this.zonesRepository.createZone({
      nom: payload.nom,
      type: payload.type,
      actif: payload.actif ?? true,
      geometry: this.toPolygonGeoJson(payload.coordinates),
    });
  }

  async updateZone(id: string, payload: UpdateZoneDto) {
    const updated = await this.zonesRepository.updateZone(id, {
      nom: payload.nom,
      type: payload.type,
      actif: payload.actif,
      geometry: payload.coordinates
        ? this.toPolygonGeoJson(payload.coordinates)
        : undefined,
    });

    if (!updated) {
      throw new NotFoundException(`Zone ${id} not found`);
    }

    return updated;
  }

  async deleteZone(id: string): Promise<void> {
    const deleted = await this.zonesRepository.deleteZone(id);
    if (!deleted) {
      throw new NotFoundException(`Zone ${id} not found`);
    }
  }

  async listAlerts(query: GetAlertsQueryDto) {
    return this.alertsRepository.listRecent({
      page: query.page,
      limit: query.limit,
      vehiculeId: query.vehiculeId,
      zoneId: query.zoneId,
      typeAlerte: query.typeAlerte,
    });
  }

  async analyseVehicle(vehiculeId: string, query: AnalyseLocationQueryDto) {
    const to = query.to ?? new Date().toISOString();
    const from =
      query.from ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const range = this.validateDateRange(from, to);

    return this.insightsAgentService.analyseVehicle(
      vehiculeId,
      range.from,
      range.to,
    );
  }

  private validateDateRange(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid ISO-8601 date range');
    }

    if (fromDate > toDate) {
      throw new BadRequestException('`from` must be before or equal to `to`');
    }

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    };
  }

  private toPolygonGeoJson(coordinates: ZonePoint[]): GeoJsonPolygon {
    const ring = coordinates.map((point) => [point.longitude, point.latitude]);

    if (ring.length < 3) {
      throw new BadRequestException(
        'A geofencing polygon must contain at least 3 points',
      );
    }

    const [firstLongitude, firstLatitude] = ring[0];
    const [lastLongitude, lastLatitude] = ring[ring.length - 1];

    if (firstLongitude !== lastLongitude || firstLatitude !== lastLatitude) {
      ring.push([firstLongitude, firstLatitude]);
    }

    return {
      type: 'Polygon',
      coordinates: [ring],
    };
  }
}
