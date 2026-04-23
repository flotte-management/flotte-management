import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DomainEventEnvelope } from './event-envelope.interface';
import { DomainEventPublisher } from './domain-event-publisher.interface';

@Injectable()
export class NoopDomainEventPublisherService implements DomainEventPublisher {
  private readonly logger = new Logger(NoopDomainEventPublisherService.name);

  publish<TPayload>(
    eventType: string,
    payload: TPayload,
    correlationId?: string,
    _partitionKey?: string,
  ): Promise<void> {
    const envelope: DomainEventEnvelope<TPayload> = {
      eventId: randomUUID(),
      eventType,
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'location-service',
      correlationId,
      payload,
    };

    this.logger.log(`Simulated event published: ${JSON.stringify(envelope)}`);
    return Promise.resolve();
  }
}
