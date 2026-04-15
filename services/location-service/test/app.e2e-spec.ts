import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { AppService } from './../src/app.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.DB_AUTO_BOOTSTRAP = 'false';
    process.env.DB_ALLOW_START_WITHOUT_DATABASE = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('boots the application module and exposes health data', () => {
    const appService = app.get(AppService);

    expect(appService.getHealth()).toMatchObject({
      service: 'location-service',
      status: 'ok',
    });
  });
});
