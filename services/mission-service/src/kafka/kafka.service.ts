import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, RecordMetadata } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';

export interface KafkaEnvelope<T = unknown> {
  eventId: string;
  eventType: string;
  version: string;
  timestamp: string;
  source: string;
  correlationId: string | null;
  payload: T;
}

// ─── Payloads typés ──────────────────────────────────────────────────────────

export interface MissionCreatedPayload {
  missionId: string;
  titre: string;
  vehiculeId: string;
  conducteurId: string;
  statut: string;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  adresseOrigine: string;
  adresseDestination: string;
  distanceEstimeeKm: number | null;
  creePar: string;
}

export interface MissionStartedPayload {
  missionId: string;
  vehiculeId: string;
  conducteurId: string;
  dateDebutReelle: string;
}

export interface MissionCompletedPayload {
  missionId: string;
  vehiculeId: string;
  conducteurId: string;
  dateDebutReelle: string;
  dateFinReelle: string;
  distanceReelleKm: number | null;
  dureeReelleMin: number | null;
}

export interface MissionCancelledPayload {
  missionId: string;
  vehiculeId: string;
  conducteurId: string;
  motifAnnulation: string | null;
  annulePar: string;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private producer: Producer | null = null;
  private readonly kafkaEnabled: boolean;
  private isConnected = false;
  private readonly TOPIC = 'flotte.missions';

  constructor(private readonly config: ConfigService) {
    this.kafkaEnabled = this.config.get<string>('KAFKA_ENABLED', 'true') !== 'false';

    if (!this.kafkaEnabled) {
      this.logger.warn('Kafka désactivé via KAFKA_ENABLED=false');
      return;
    }

    const brokers = this.config
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',');

    const kafka = new Kafka({
      clientId: this.config.get<string>('KAFKA_CLIENT_ID', 'service-missions'),
      brokers,
      retry: { retries: 5, initialRetryTime: 300 },
    });

    this.producer = kafka.producer({
      allowAutoTopicCreation: true,
      idempotent: true,
    });
  }

  async onModuleInit() {
    if (!this.kafkaEnabled || !this.producer) {
      return;
    }

    try {
      await this.producer.connect();
      this.isConnected = true;
      this.logger.log('Kafka producer connecté');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Kafka indisponible au démarrage (${message}). Le service continue sans publication d'evenements.`);
    }
  }

  async onModuleDestroy() {
    if (!this.producer || !this.isConnected) {
      return;
    }

    await this.producer.disconnect();
    this.isConnected = false;
    this.logger.log('Kafka producer déconnecté');
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private buildEnvelope<T>(
    eventType: string,
    payload: T,
    correlationId: string | null = null,
  ): KafkaEnvelope<T> {
    return {
      eventId: uuidv4(),
      eventType,
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'service-missions',
      correlationId,
      payload,
    };
  }

  private async publish<T>(
    key: string,
    eventType: string,
    payload: T,
    correlationId?: string,
  ): Promise<RecordMetadata[]> {
    if (!this.kafkaEnabled || !this.producer || !this.isConnected) {
      this.logger.warn(`[Kafka] Publication ignoree (${eventType}) car Kafka n'est pas connecte`);
      return [];
    }

    const envelope = this.buildEnvelope(eventType, payload, correlationId ?? null);
    try {
      const result = await this.producer.send({
        topic: this.TOPIC,
        messages: [
          {
            key,
            value: JSON.stringify(envelope),
            headers: { eventType, version: '1.0' },
          },
        ],
      });
      this.logger.log(`[Kafka] ${eventType} publié — key=${key}`);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Kafka] Erreur publication ${eventType}: ${message}`);
      throw err;
    }
  }

  // ─── Événements métier ───────────────────────────────────────────────────

  async publishMissionCreated(
    payload: MissionCreatedPayload,
    correlationId?: string,
  ) {
    return this.publish(
      payload.missionId,
      'mission.created',
      payload,
      correlationId,
    );
  }

  async publishMissionStarted(
    payload: MissionStartedPayload,
    correlationId?: string,
  ) {
    return this.publish(
      payload.missionId,
      'mission.started',
      payload,
      correlationId,
    );
  }

  async publishMissionCompleted(
    payload: MissionCompletedPayload,
    correlationId?: string,
  ) {
    return this.publish(
      payload.missionId,
      'mission.completed',
      payload,
      correlationId,
    );
  }

  async publishMissionCancelled(
    payload: MissionCancelledPayload,
    correlationId?: string,
  ) {
    return this.publish(
      payload.missionId,
      'mission.cancelled',
      payload,
      correlationId,
    );
  }
}
