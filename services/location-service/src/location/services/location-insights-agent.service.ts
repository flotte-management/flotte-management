import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { AlertsRepository } from '../repositories/alerts.repository';
import { PositionsRepository } from '../repositories/positions.repository';
import {
  LocationAnalysisResult,
  PositionRecord,
} from '../types/location.types';

@Injectable()
export class LocationInsightsAgentService {
  constructor(
    private readonly config: AppConfigService,
    private readonly positionsRepository: PositionsRepository,
    private readonly alertsRepository: AlertsRepository,
  ) {}

  async analyseVehicle(
    vehiculeId: string,
    from: string,
    to: string,
  ): Promise<LocationAnalysisResult> {
    const [history, latestPosition, alertCount] = await Promise.all([
      this.positionsRepository.findHistory(vehiculeId, from, to),
      this.positionsRepository.findLatestByVehicle(vehiculeId),
      this.alertsRepository.countForVehicleInRange(vehiculeId, from, to),
    ]);

    if (!this.config.aiAgentEnabled) {
      return {
        vehicleId: vehiculeId,
        from,
        to,
        provider: 'disabled',
        pointsAnalysed: history.length,
        totalDistanceKm: this.calculateTotalDistanceKm(history),
        averageSpeedKph: this.calculateAverageSpeed(history),
        maxSpeedKph: this.calculateMaxSpeed(history),
        alertCount,
        latestPosition,
        insights: ['AI agent integration is disabled for this environment.'],
      };
    }

    const totalDistanceKm = this.calculateTotalDistanceKm(history);
    const averageSpeedKph = this.calculateAverageSpeed(history);
    const maxSpeedKph = this.calculateMaxSpeed(history);
    const insights = this.buildInsights({
      history,
      from,
      to,
      alertCount,
      totalDistanceKm,
      averageSpeedKph,
      maxSpeedKph,
      latestPosition,
    });

    return {
      vehicleId: vehiculeId,
      from,
      to,
      provider: 'rule-based-agent',
      pointsAnalysed: history.length,
      totalDistanceKm,
      averageSpeedKph,
      maxSpeedKph,
      alertCount,
      latestPosition,
      insights,
    };
  }

  private buildInsights(input: {
    history: PositionRecord[];
    from: string;
    to: string;
    alertCount: number;
    totalDistanceKm: number;
    averageSpeedKph: number | null;
    maxSpeedKph: number | null;
    latestPosition: PositionRecord | null;
  }): string[] {
    const insights: string[] = [];

    if (input.history.length === 0) {
      return [
        `No GPS point was recorded for the vehicle between ${input.from} and ${input.to}.`,
      ];
    }

    insights.push(
      `Analysed ${input.history.length} GPS points over ${input.totalDistanceKm.toFixed(2)} km.`,
    );

    if (input.averageSpeedKph !== null) {
      insights.push(
        `Average speed was ${input.averageSpeedKph.toFixed(1)} km/h during the selected period.`,
      );
    }

    if (input.maxSpeedKph !== null && input.maxSpeedKph > 120) {
      insights.push(
        `Peak speed reached ${input.maxSpeedKph.toFixed(1)} km/h, which may deserve a quick review.`,
      );
    }

    if (input.alertCount > 0) {
      insights.push(
        `The vehicle triggered ${input.alertCount} geofencing alert(s) in the selected range.`,
      );
    }

    if (input.totalDistanceKm < 1 && input.history.length >= 5) {
      insights.push(
        'The vehicle moved very little despite multiple GPS samples, which may indicate idling or a parked state.',
      );
    }

    if (input.latestPosition) {
      insights.push(
        `Latest known position is at ${input.latestPosition.latitude.toFixed(5)}, ${input.latestPosition.longitude.toFixed(5)} on ${input.latestPosition.time}.`,
      );
    }

    return insights;
  }

  private calculateAverageSpeed(history: PositionRecord[]): number | null {
    const speeds = history
      .map((position) => position.vitesse)
      .filter((value): value is number => value !== null);

    if (speeds.length === 0) {
      return null;
    }

    const total = speeds.reduce((sum, value) => sum + value, 0);
    return total / speeds.length;
  }

  private calculateMaxSpeed(history: PositionRecord[]): number | null {
    const speeds = history
      .map((position) => position.vitesse)
      .filter((value): value is number => value !== null);

    if (speeds.length === 0) {
      return null;
    }

    return Math.max(...speeds);
  }

  private calculateTotalDistanceKm(history: PositionRecord[]): number {
    let total = 0;

    for (let index = 1; index < history.length; index += 1) {
      total += this.haversineDistanceKm(history[index - 1], history[index]);
    }

    return total;
  }

  private haversineDistanceKm(
    from: PositionRecord,
    to: PositionRecord,
  ): number {
    const earthRadiusKm = 6371;
    const dLat = this.degreesToRadians(to.latitude - from.latitude);
    const dLon = this.degreesToRadians(to.longitude - from.longitude);
    const lat1 = this.degreesToRadians(from.latitude);
    const lat2 = this.degreesToRadians(to.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
  }

  private degreesToRadians(value: number): number {
    return (value * Math.PI) / 180;
  }
}
