import { Module } from '@nestjs/common';
import { LocationController } from './location.controller';
import { LocationGrpcController } from './location-grpc.controller';
import { AlertsRepository } from './repositories/alerts.repository';
import { PositionsRepository } from './repositories/positions.repository';
import { ZonesRepository } from './repositories/zones.repository';
import { GeofencingService } from './services/geofencing.service';
import { LocationInsightsAgentService } from './services/location-insights-agent.service';
import { LocationService } from './services/location.service';
import { RealtimeVehicleStreamService } from './services/realtime-vehicle-stream.service';

@Module({
  controllers: [LocationController, LocationGrpcController],
  providers: [
    PositionsRepository,
    ZonesRepository,
    AlertsRepository,
    RealtimeVehicleStreamService,
    GeofencingService,
    LocationInsightsAgentService,
    LocationService,
  ],
})
export class LocationModule {}
