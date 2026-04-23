import { Inject, Injectable } from '@nestjs/common';
import { AlertsRepository } from '../repositories/alerts.repository';
import { ZonesRepository } from '../repositories/zones.repository';
import {
  GeofenceAlertRecord,
  GeofenceAlertType,
  PositionRecord,
  ZoneMembership,
} from '../types/location.types';
import { DOMAIN_EVENT_PUBLISHER } from '../../events/event-publisher.constants';
import type { DomainEventPublisher } from '../../events/domain-event-publisher.interface';

@Injectable()
export class GeofencingService {
  constructor(
    private readonly alertsRepository: AlertsRepository,
    private readonly zonesRepository: ZonesRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async evaluateTransition(
    previousPosition: PositionRecord | null,
    currentPosition: PositionRecord,
    correlationId?: string,
  ): Promise<GeofenceAlertRecord[]> {
    if (!previousPosition) {
      return [];
    }

    const [previousZones, currentZones] = await Promise.all([
      this.zonesRepository.findContainingZones(
        previousPosition.latitude,
        previousPosition.longitude,
      ),
      this.zonesRepository.findContainingZones(
        currentPosition.latitude,
        currentPosition.longitude,
      ),
    ]);

    const previousMap = new Map(previousZones.map((zone) => [zone.id, zone]));
    const currentMap = new Map(currentZones.map((zone) => [zone.id, zone]));
    const alerts: GeofenceAlertRecord[] = [];

    for (const zone of currentZones) {
      if (!previousMap.has(zone.id)) {
        const alert = await this.createAlert(
          currentPosition.vehiculeId,
          zone,
          'ENTER',
          currentPosition.time,
          correlationId,
        );
        alerts.push(alert);
      }
    }

    for (const zone of previousZones) {
      if (!currentMap.has(zone.id)) {
        const alert = await this.createAlert(
          currentPosition.vehiculeId,
          zone,
          'EXIT',
          currentPosition.time,
          correlationId,
        );
        alerts.push(alert);
      }
    }

    return alerts;
  }

  private async createAlert(
    vehiculeId: string,
    zone: ZoneMembership,
    typeAlerte: GeofenceAlertType,
    detectedAt: string,
    correlationId?: string,
  ): Promise<GeofenceAlertRecord> {
    const createdAlert = await this.alertsRepository.createAlert({
      vehiculeId,
      zoneId: zone.id,
      typeAlerte,
      detecteLe: detectedAt,
    });

    const alert: GeofenceAlertRecord = {
      ...createdAlert,
      zoneNom: zone.nom,
      zoneType: zone.type,
    };

    await this.eventPublisher.publish(
      'geofence.alert',
      {
        vehiculeId,
        zoneId: zone.id,
        zoneNom: zone.nom,
        zoneType: zone.type,
        typeAlerte,
        detecteLe: detectedAt,
      },
      correlationId,
      vehiculeId, // partition key — all alerts for the same vehicle go to the same partition
    );

    return alert;
  }
}
