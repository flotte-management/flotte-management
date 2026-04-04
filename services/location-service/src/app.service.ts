import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      service: 'location-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
