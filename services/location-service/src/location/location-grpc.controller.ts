import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { RealtimeVehicleStreamService } from './services/realtime-vehicle-stream.service';

type StreamVehiclePositionsRequest = {
  vehiculeId: string;
};

@Controller()
export class LocationGrpcController {
  constructor(
    private readonly realtimeVehicleStreamService: RealtimeVehicleStreamService,
  ) {}

  @GrpcMethod('LocationStreamingService', 'StreamVehiclePositions')
  streamVehiclePositions(request: StreamVehiclePositionsRequest): Observable<{
    vehiculeId: string;
    time: string;
    latitude: number;
    longitude: number;
    vitesse: number;
    cap: number;
    precision: number;
  }> {
    return this.realtimeVehicleStreamService.streamVehiclePositions(
      request.vehiculeId,
    );
  }
}
