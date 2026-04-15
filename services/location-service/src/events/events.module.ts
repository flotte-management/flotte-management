import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { DOMAIN_EVENT_PUBLISHER } from './event-publisher.constants';
import { KafkaDomainEventPublisherService } from './kafka-domain-event-publisher.service';
import { NoopDomainEventPublisherService } from './noop-domain-event-publisher.service';

@Global()
@Module({
  providers: [
    KafkaDomainEventPublisherService,
    NoopDomainEventPublisherService,
    {
      provide: DOMAIN_EVENT_PUBLISHER,
      inject: [
        AppConfigService,
        KafkaDomainEventPublisherService,
        NoopDomainEventPublisherService,
      ],
      useFactory: (
        config: AppConfigService,
        kafkaPublisher: KafkaDomainEventPublisherService,
        noopPublisher: NoopDomainEventPublisherService,
      ) => {
        if (config.kafkaEnabled && config.kafkaBrokers.length > 0) {
          return kafkaPublisher;
        }

        return noopPublisher;
      },
    },
  ],
  exports: [DOMAIN_EVENT_PUBLISHER],
})
export class EventsModule {}
