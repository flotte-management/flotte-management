import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get httpPort(): number {
    return this.getNumber('PORT', 3000);
  }

  get grpcPort(): number {
    return this.getNumber('GRPC_PORT', 3001);
  }

  get dbHost(): string {
    return this.getString('DB_HOST', 'localhost');
  }

  get dbPort(): number {
    return this.getNumber('DB_PORT', 5432);
  }

  get dbName(): string {
    return this.getString('DB_NAME', 'location_db');
  }

  get dbUser(): string {
    return this.getString('DB_USER', 'postgres');
  }

  get dbPassword(): string {
    return this.getString('DB_PASSWORD', 'secret');
  }

  get dbAutoBootstrap(): boolean {
    return this.getBoolean('DB_AUTO_BOOTSTRAP', true);
  }

  get dbAllowStartWithoutDatabase(): boolean {
    return this.getBoolean('DB_ALLOW_START_WITHOUT_DATABASE', false);
  }

  get kafkaEnabled(): boolean {
    return this.getBoolean('KAFKA_ENABLED', false);
  }

  get kafkaClientId(): string {
    return this.getString('KAFKA_CLIENT_ID', 'location-service');
  }

  get kafkaTopic(): string {
    return this.getString('KAFKA_TOPIC', 'location-domain-events');
  }

  get kafkaBrokers(): string[] {
    return this.getStringArray('KAFKA_BROKERS');
  }

  get aiAgentEnabled(): boolean {
    return this.getBoolean('AI_AGENT_ENABLED', true);
  }

  private getString(key: string, fallback?: string): string {
    const value = this.configService.get<string>(key);
    if (value !== undefined && value !== '') {
      return value;
    }

    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`Missing configuration key: ${key}`);
  }

  private getNumber(key: string, fallback?: number): number {
    const value = this.configService.get<string>(key);
    if (value === undefined || value === '') {
      if (fallback !== undefined) {
        return fallback;
      }

      throw new Error(`Missing configuration key: ${key}`);
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid numeric configuration for ${key}: ${value}`);
    }

    return parsed;
  }

  private getBoolean(key: string, fallback: boolean): boolean {
    const value = this.configService.get<string>(key);
    if (value === undefined || value === '') {
      return fallback;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private getStringArray(key: string): string[] {
    const value = this.configService.get<string>(key);
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}
