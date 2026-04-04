export interface DomainEventPublisher {
  publish<TPayload>(
    eventType: string,
    payload: TPayload,
    correlationId?: string,
  ): Promise<void>;
}
