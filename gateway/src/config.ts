// ─── Gateway configuration from environment ──────────────────────────────────

export const config = {
  port: parseInt(process.env.GATEWAY_PORT ?? '4000', 10),
  env: process.env.NODE_ENV ?? 'development',

  // Upstream service URLs
  services: {
    vehicles:    process.env.VEHICLE_SERVICE_URL    ?? 'http://vehicle-service:8080',
    drivers:     process.env.DRIVER_SERVICE_URL     ?? 'http://driver-service:8000',
    missions:    process.env.MISSION_SERVICE_URL    ?? 'http://mission-service:3005',
    maintenance: process.env.MAINTENANCE_SERVICE_URL ?? 'http://maintenance-service:8000',
    location:    process.env.LOCATION_SERVICE_URL   ?? 'http://location-service:3000',
  },

  // Keycloak
  keycloak: {
    realmUrl:  process.env.KEYCLOAK_REALM_URL ?? 'http://keycloak:8080/realms/flotte-management',
    clientId:  process.env.KEYCLOAK_CLIENT_ID ?? 'flotte-services',
    verifyIssuer: (process.env.KEYCLOAK_VERIFY_ISSUER ?? 'false') === 'true',
  },

  // Kafka
  kafka: {
    brokers:  (process.env.KAFKA_BROKERS ?? 'kafka:29092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID ?? 'gateway-service',
    groupId:  process.env.KAFKA_GROUP_ID  ?? 'gateway-group',
  },

  // Rate limiting
  rateLimit: {
    windowMs:  parseInt(process.env.RATE_LIMIT_WINDOW_MS  ?? '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  },
} as const;
