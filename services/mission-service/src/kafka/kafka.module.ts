import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaService } from './kafka.service';
import { KafkaConsumerService } from './kafka-consumer.service';

@Module({
  imports: [ConfigModule],
  providers: [KafkaService, KafkaConsumerService],
  exports: [KafkaService],
})
export class KafkaModule {}
