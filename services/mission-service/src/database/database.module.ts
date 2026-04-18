import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Mission } from '../missions/entities/mission.entity';
import { EtapeMission } from '../missions/entities/etape-mission.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbSslEnabled = config.get<string>('DB_SSL', 'false') === 'true';

        return {
          type: 'postgres',
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          username:
            config.get<string>('DB_USERNAME') ??
            config.get<string>('DB_USER', 'postgres'),
          password: config.get<string>('DB_PASSWORD', 'postgres'),
          database: config.get<string>('DB_NAME', 'flotte_missions'),
          entities: [Mission, EtapeMission],
          synchronize: config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
          logging: config.get<string>('DB_LOGGING', 'false') === 'true',
          ssl: dbSslEnabled ? { rejectUnauthorized: false } : false,
          // Retry sur démarrage (attend que Postgres soit prêt en Docker)
          retryAttempts: 10,
          retryDelay: 3000,
          autoLoadEntities: true,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
