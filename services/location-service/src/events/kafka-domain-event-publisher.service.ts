import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../config/app-config.service';
import { DomainEventEnvelope } from './event-envelope.interface';
import { DomainEventPublisher } from './domain-event-publisher.interface';

@Injectable()
export class KafkaDomainEventPublisherService
  implements DomainEventPublisher, OnModuleDestroy
{
  private readonly logger = new Logger(KafkaDomainEventPublisherService.name);
  private producer: Producer | null = null;
  private isConnected = false;

  constructor(private readonly config: AppConfigService) {}

  async publish<TPayload>(
    eventType: string,
    payload: TPayload,
    correlationId?: string,
    partitionKey?: string,
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

    try {
      await this.ensureConnected();
      await this.producer?.send({
        topic: this.config.kafkaTopic,
        messages: [
          {
            // Use vehiculeId (or correlationId) as partition key for ordering
            key: partitionKey ?? envelope.eventId,
            value: JSON.stringify(envelope),
          },
        ],
      });
    } catch (error) {
      this.logger.warn(
        `Kafka publish failed for ${eventType}, event kept local only: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.isConnected && this.producer) {
      await this.producer.disconnect();
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    const kafka = new Kafka({
      clientId: this.config.kafkaClientId,
      brokers: this.config.kafkaBrokers,
    });

    this.producer = kafka.producer();
    await this.producer.connect();
    this.isConnected = true;
  }
}
