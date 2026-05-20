import { Controller, Get, Header } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';

let metricsInitialized = false;

function ensureDefaultMetrics(): void {
  if (metricsInitialized) return;
  collectDefaultMetrics();
  metricsInitialized = true;
}

@Controller()
export class MetricsController {
  constructor() {
    ensureDefaultMetrics();
  }

  @Get('metrics')
  @Header('Content-Type', register.contentType)
  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}

