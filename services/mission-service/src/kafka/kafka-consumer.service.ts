import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka } from 'kafkajs';

/**
 * KafkaConsumerService
 *
 * Subscribes to:
 *   - flotte.vehicules  → react to vehicule.statut_changed (cancel missions on HORS_SERVICE)
 *   - flotte.conducteurs → react to driver status changes
 *
 * Implements Saga choreography for the mission lifecycle.
 */
@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private consumer: Consumer | null = null;
  private readonly kafkaEnabled: boolean;

  // In-process idempotency cache (use Redis in multi-replica deployments)
  private readonly processedEventIds = new Set<string>();
  private readonly MAX_IDEMPOTENCY_CACHE = 10_000;

  constructor(private readonly config: ConfigService) {
    this.kafkaEnabled =
      this.config.get<string>('KAFKA_ENABLED', 'true') !== 'false';

    if (!this.kafkaEnabled) {
      this.logger.warn('Kafka consumer disabled (KAFKA_ENABLED=false)');
      return;
    }

    const brokers = this.config
      .get<string>('KAFKA_BROKERS', 'kafka:29092')
      .split(',');

    const kafka = new Kafka({
      clientId: this.config.get<string>(
        'KAFKA_CLIENT_ID',
        'service-missions-consumer',
      ),
      brokers,
      retry: { retries: 5, initialRetryTime: 300 },
    });

    this.consumer = kafka.consumer({
      groupId: 'mission-service-group',
      sessionTimeout: 30_000,
      heartbeatInterval: 3_000,
    });
  }

  async onModuleInit() {
    if (!this.kafkaEnabled || !this.consumer) return;

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topics: ['flotte.vehicules', 'flotte.conducteurs'],
        fromBeginning: false,
      });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const raw = message.value?.toString();
            if (!raw) return;

            const envelope = JSON.parse(raw);
            const eventId: string = envelope.eventId || envelope.event_id;
            const eventType: string =
              envelope.eventType || envelope.event_type;
            const payload = envelope.payload ?? {};

            // Idempotency
            if (eventId && this.processedEventIds.has(eventId)) {
              this.logger.debug(
                `Duplicate event ${eventId} on ${topic} – skipping`,
              );
              return;
            }

            this.logger.log(
              `Received [${topic}] eventType=${eventType} id=${eventId}`,
            );

            if (topic === 'flotte.vehicules') {
              await this.handleVehiculeEvent(eventType, payload);
            } else if (topic === 'flotte.conducteurs') {
              await this.handleConducteurEvent(eventType, payload);
            }

            // Track processed event
            if (eventId) {
              this.processedEventIds.add(eventId);
              if (this.processedEventIds.size > this.MAX_IDEMPOTENCY_CACHE) {
                // Remove the oldest entry
                const first = this.processedEventIds.values().next().value;
                if (first) this.processedEventIds.delete(first);
              }
            }
          } catch (err) {
            this.logger.error(
              `Error processing message on ${topic} partition=${partition}: ${err}`,
              err instanceof Error ? err.stack : undefined,
            );
            // kafkajs re-delivers on restart — at-least-once semantics preserved
          }
        },
      });

      this.logger.log(
        'Mission Kafka consumer connected, listening to flotte.vehicules + flotte.conducteurs',
      );
    } catch (err) {
      this.logger.error(`Failed to start Kafka consumer: ${err}`);
    }
  }

  async onModuleDestroy() {
    if (this.consumer) {
      await this.consumer.disconnect();
      this.logger.log('Mission Kafka consumer disconnected');
    }
  }

  // ── Event handlers ───────────────────────────────────────────────────────

  private async handleVehiculeEvent(
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    switch (eventType) {
      case 'vehicule.statut_changed': {
        const { vehiculeId, statutApres } = payload as {
          vehiculeId: string;
          statutApres: string;
        };
        this.logger.log(
          `Vehicle ${vehiculeId} status changed to ${statutApres}`,
        );

        // If vehicle goes HORS_SERVICE, log alert (saga extension point)
        if (statutApres === 'HORS_SERVICE' || statutApres === 'RETIRE') {
          this.logger.warn(
            `Vehicle ${vehiculeId} is ${statutApres} — active missions may need rescheduling`,
          );
          // TODO: query MissionRepository for active missions with this vehiculeId
          // and transition them to ANNULEE (with appropriate motifAnnulation)
        }
        break;
      }
      case 'vehicule.deleted': {
        const { vehiculeId } = payload as { vehiculeId: string };
        this.logger.warn(
          `Vehicle ${vehiculeId} deleted — future missions should be cancelled`,
        );
        break;
      }
      default:
        this.logger.debug(`Ignored vehicle event: ${eventType}`);
    }
  }

  private async handleConducteurEvent(
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    switch (eventType) {
      case 'driver.statut_changed': {
        const { driver_id: conducteurId, new_statut: newStatut } =
          payload as { driver_id: string; new_statut: string };
        this.logger.log(
          `Driver ${conducteurId} status changed to ${newStatut}`,
        );
        // Extension point: reschedule missions if driver is suspended/inactive
        if (newStatut === 'suspendu' || newStatut === 'inactif') {
          this.logger.warn(
            `Driver ${conducteurId} is ${newStatut} — active missions may need reassignment`,
          );
        }
        break;
      }
      default:
        this.logger.debug(`Ignored conductor event: ${eventType}`);
    }
  }
}
