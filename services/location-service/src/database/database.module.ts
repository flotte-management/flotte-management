import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { DATABASE_POOL } from './database.constants';
import { DatabaseBootstrapService } from './database-bootstrap.service';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [
    AppConfigService,
    {
      provide: DATABASE_POOL,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new Pool({
          host: config.dbHost,
          port: config.dbPort,
          database: config.dbName,
          user: config.dbUser,
          password: config.dbPassword,
          max: 10,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 10000,
          allowExitOnIdle: true,
        }),
    },
    DatabaseService,
    DatabaseBootstrapService,
  ],
  exports: [DatabaseService, AppConfigService],
})
export class DatabaseModule {}
