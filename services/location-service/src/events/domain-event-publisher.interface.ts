export interface DomainEventPublisher {
  publish<TPayload>(
    eventType: string,
    payload: TPayload,
    correlationId?: string,
    partitionKey?: string,
  ): Promise<void>;
}
