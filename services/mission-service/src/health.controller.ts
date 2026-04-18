import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check du service' })
  async health() {
    const dbOk = this.dataSource.isInitialized;
    return {
      status: dbOk ? 'ok' : 'degraded',
      service: 'service-missions',
      version: process.env.npm_package_version ?? '1.0.0',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? 'up' : 'down',
      },
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  root() {
    return {
      service: 'service-missions',
      docs: '/api/docs',
      health: '/health',
    };
  }
}
