import { Injectable } from '@nestjs/common';
import { Observable, Subject, concat, defer, filter, from, map } from 'rxjs';
import { PositionsRepository } from '../repositories/positions.repository';
import { PositionRecord } from '../types/location.types';

type GrpcPositionMessage = {
  vehiculeId: string;
  time: string;
  latitude: number;
  longitude: number;
  vitesse: number;
  cap: number;
  precision: number;
};

@Injectable()
export class RealtimeVehicleStreamService {
  private readonly streams = new Map<string, Subject<PositionRecord>>();

  constructor(private readonly positionsRepository: PositionsRepository) {}

  publish(position: PositionRecord): void {
    this.getOrCreateStream(position.vehiculeId).next(position);
  }

  streamVehiclePositions(vehiculeId: string): Observable<GrpcPositionMessage> {
    const latest$ = defer(() =>
      from(this.positionsRepository.findLatestByVehicle(vehiculeId)),
    ).pipe(
      filter((value): value is PositionRecord => value !== null),
      map((position) => this.toGrpcMessage(position)),
    );

    const live$ = this.getOrCreateStream(vehiculeId).pipe(
      map((position) => this.toGrpcMessage(position)),
    );

    return concat(latest$, live$);
  }

  private getOrCreateStream(vehiculeId: string): Subject<PositionRecord> {
    const existingStream = this.streams.get(vehiculeId);
    if (existingStream) {
      return existingStream;
    }

    const stream = new Subject<PositionRecord>();
    this.streams.set(vehiculeId, stream);
    return stream;
  }

  private toGrpcMessage(position: PositionRecord): GrpcPositionMessage {
    return {
      vehiculeId: position.vehiculeId,
      time: position.time,
      latitude: position.latitude,
      longitude: position.longitude,
      vitesse: position.vitesse ?? 0,
      cap: position.cap ?? 0,
      precision: position.precision ?? 0,
    };
  }
}
