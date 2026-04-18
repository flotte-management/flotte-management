import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { MissionsModule } from './missions/missions.module';
import { KafkaModule } from './kafka/kafka.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Config globale — charge le .env automatiquement
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    DatabaseModule,
    AuthModule,
    KafkaModule,
    MissionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
