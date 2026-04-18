import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mission } from './entities/mission.entity';
import { EtapeMission } from './entities/etape-mission.entity';
import { MissionsService } from './missions.service';
import { MissionsController } from './missions.controller';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Mission, EtapeMission]),
    KafkaModule,
  ],
  controllers: [MissionsController],
  providers: [MissionsService],
})
export class MissionsModule {}
