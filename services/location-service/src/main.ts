import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

function resolveProtoPath(): string {
  const candidates = [
    join(__dirname, 'proto/location.proto'),
    join(__dirname, 'proto/proto/location.proto'),
    join(process.cwd(), 'src/proto/location.proto'),
  ];

  const resolvedPath = candidates.find((candidate) => existsSync(candidate));
  if (!resolvedPath) {
    throw new Error(
      `Unable to locate location.proto. Checked: ${candidates.join(', ')}`,
    );
  }

  return resolvedPath;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);
  const protoPath = resolveProtoPath();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      url: `0.0.0.0:${config.grpcPort}`,
      package: 'location.v1',
      protoPath,
      loader: {
        keepCase: false,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    },
  });

  await app.startAllMicroservices();
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Location Service')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Keycloak access token',
      },
      'JWT-Keycloak',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);
  await app.listen(config.httpPort);
}

void bootstrap();
