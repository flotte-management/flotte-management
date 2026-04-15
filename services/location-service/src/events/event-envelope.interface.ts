export interface DomainEventEnvelope<TPayload = unknown> {
  eventId: string;
  eventType: string;
  version: string;
  timestamp: string;
  source: string;
  correlationId?: string;
  payload: TPayload;
}
