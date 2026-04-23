/**
 * Kafka bridge that consumes events from all topics and publishes
 * them to the GraphQL PubSub engine for subscriptions.
 */
import { Kafka, Consumer } from 'kafkajs';
import { PubSub } from 'graphql-subscriptions';
import { config } from './config.js';
import { logger } from './logger.js';

// Exported PubSub instance shared with GraphQL resolvers
export const pubsub = new PubSub();

// Subscription event names (constants shared with resolvers)
export const VEHICULE_STATUT_CHANGED = 'VEHICULE_STATUT_CHANGED';
export const POSITION_VEHICULE_UPDATED = 'POSITION_VEHICULE_UPDATED';
export const NOUVELLE_ALERTE = 'NOUVELLE_ALERTE';
export const MISSION_EVENT = 'MISSION_EVENT';

let consumer: Consumer | null = null;

/**
 * Start Kafka consumer and bridge events to GraphQL PubSub.
 */
export async function startKafkaBridge(): Promise<void> {
  const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: [...config.kafka.brokers],
    retry: { retries: 10, initialRetryTime: 1000 },
  });

  consumer = kafka.consumer({
    groupId: config.kafka.groupId,
    sessionTimeout: 30_000,
    heartbeatInterval: 3_000,
  });

  try {
    await consumer.connect();
    await consumer.subscribe({
      topics: [
        'flotte.vehicules',
        'flotte.localisation',
        'flotte.missions',
        'flotte.maintenances',
        'flotte.conducteurs',
      ],
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const raw = message.value?.toString();
          if (!raw) return;

          const envelope = JSON.parse(raw);
          const eventType: string = envelope.eventType ?? envelope.event_type ?? '';
          const payload = envelope.payload ?? {};

          bridgeEvent(topic, eventType, payload, envelope);
        } catch (err) {
          logger.error(`[kafka-bridge] Error processing ${topic}: ${err}`);
        }
      },
    });

    logger.info('[kafka-bridge] Connected and consuming all flotte.* topics');
  } catch (err) {
    logger.error(`[kafka-bridge] Failed to connect: ${err}`);
    // Non-fatal: subscriptions will simply have no data
  }
}

export async function stopKafkaBridge(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    logger.info('[kafka-bridge] Consumer disconnected');
  }
}

function bridgeEvent(
  topic: string,
  eventType: string,
  payload: Record<string, unknown>,
  envelope: Record<string, unknown>,
) {
  // ── flotte.vehicules ───────────────────────────────────────────────────────
  if (topic === 'flotte.vehicules' && eventType === 'vehicule.statut_changed') {
    pubsub.publish(VEHICULE_STATUT_CHANGED, {
      vehiculeStatutChange: {
        vehiculeId:   payload.vehiculeId,
        statutAvant:  payload.statutAvant,
        statutApres:  payload.statutApres,
        motif:        payload.motif,
        timestamp:    envelope.timestamp,
      },
    });
  }

  // ── flotte.localisation ────────────────────────────────────────────────────
  if (topic === 'flotte.localisation') {
    if (eventType === 'position.updated') {
      pubsub.publish(POSITION_VEHICULE_UPDATED, {
        positionVehicule: {
          vehiculeId: payload.vehiculeId,
          latitude:   payload.latitude,
          longitude:  payload.longitude,
          vitesse:    payload.vitesse,
          cap:        payload.cap,
          time:       payload.time ?? envelope.timestamp,
        },
      });
    }
    if (eventType === 'geofence.alert') {
      pubsub.publish(NOUVELLE_ALERTE, {
        nouvelleAlerte: {
          type:       'GEOFENCE',
          vehiculeId: payload.vehiculeId,
          zoneId:     payload.zoneId,
          zoneNom:    payload.zoneNom,
          typeAlerte: payload.typeAlerte,
          message:    `Véhicule ${payload.vehiculeId} — zone ${payload.zoneNom}: ${payload.typeAlerte}`,
          timestamp:  envelope.timestamp,
        },
      });
    }
  }

  // ── flotte.maintenances ────────────────────────────────────────────────────
  if (topic === 'flotte.maintenances') {
    if (eventType === 'maintenance.started' || eventType === 'maintenance.completed') {
      pubsub.publish(NOUVELLE_ALERTE, {
        nouvelleAlerte: {
          type:       'MAINTENANCE',
          vehiculeId: payload.vehiculeId,
          message:    `Maintenance ${eventType === 'maintenance.started' ? 'démarrée' : 'terminée'} pour véhicule ${payload.vehiculeId}`,
          timestamp:  envelope.timestamp,
        },
      });
    }
  }

  // ── flotte.missions ────────────────────────────────────────────────────────
  if (topic === 'flotte.missions') {
    pubsub.publish(MISSION_EVENT, {
      missionEvent: {
        eventType,
        missionId:    payload.missionId,
        vehiculeId:   payload.vehiculeId,
        conducteurId: payload.conducteurId,
        timestamp:    envelope.timestamp,
      },
    });
  }

  logger.debug(`[kafka-bridge] bridged [${topic}] ${eventType}`);
}
