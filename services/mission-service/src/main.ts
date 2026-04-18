import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { RolesGuard } from './common/guards';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // ─── Validation globale ───────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // strip propriétés non déclarées dans les DTOs
      forbidNonWhitelisted: true,
      transform: true,           // cast automatique (string → number pour les query params)
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Filtre d'exception global ────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ─── Guard global rôles ───────────────────────────────────────────────────
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new RolesGuard(reflector));

  // ─── Swagger / OpenAPI ────────────────────────────────────────────────────
  const swaggerEnabled =
    process.env.SWAGGER_ENABLED !== 'false'; // activé par défaut

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Service Missions — Gestion de Flotte')
      .setDescription(
        `## Microservice Missions\n\n` +
        `Gère le cycle de vie complet des missions : planification, démarrage, étapes, clôture.\n\n` +
        `### Authentification\n` +
        `Tous les endpoints nécessitent un **Bearer Token JWT** émis par Keycloak.\n\n` +
        `### Rôles\n` +
        `| Rôle | Permissions |\n` +
        `|---|---|\n` +
        `| \`ADMIN\` | Accès complet |\n` +
        `| \`MANAGER\` | Création, modification, annulation |\n` +
        `| \`UTILISATEUR\` | Consultation & actions sur ses propres missions |`,
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'JWT émis par Keycloak (RS256). Realm : flotte-management',
          in: 'header',
        },
        'JWT-Keycloak',
      )
      .addTag('Missions', 'CRUD et gestion du cycle de vie des missions')
      .addTag('Health', 'Healthcheck et métadonnées du service')
      .addServer(`http://localhost:${process.env.APP_PORT ?? 3005}`, 'Local dev')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const swaggerPath = process.env.SWAGGER_PATH ?? 'api/docs';
    SwaggerModule.setup(swaggerPath, app, document, {
      swaggerOptions: {
        persistAuthorization: true,   // conserve le token entre rechargements
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      },
      customSiteTitle: 'Service Missions — API Docs',
    });

    logger.log(`📄 Swagger disponible sur : http://localhost:${process.env.APP_PORT ?? 3005}/${swaggerPath}`);
  }

  // ─── Démarrage ────────────────────────────────────────────────────────────
  const port = parseInt(process.env.APP_PORT ?? '3005', 10);
  await app.listen(port);
  logger.log(`🚀 Service Missions démarré sur le port ${port}`);
  logger.log(`🌍 Environnement : ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap();
