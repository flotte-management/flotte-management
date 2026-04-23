import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { useServer } from 'graphql-ws/lib/use/ws';
import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import rateLimit from 'express-rate-limit';

import { config } from './config.js';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';
import { verifyToken } from './auth.js';
import { createLoaders } from './dataloaders.js';
import { startKafkaBridge, stopKafkaBridge } from './kafka-bridge.js';
import { logger } from './logger.js';
import type { GatewayContext } from './context.js';

async function main() {
  const app = express();
  const httpServer = createServer(app);

  // ── Trust proxy (Docker/reverse-proxy setup) ────────────────────────────────
  app.set('trust proxy', 1);

  // ── Rate limiting ───────────────────────────────────────────────────────────
  app.use(
    '/graphql',
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max:      config.rateLimit.maxRequests,
      standardHeaders: true,
      legacyHeaders:   false,
      message: { errors: [{ message: 'Too many requests, please slow down.' }] },
    }),
  );

  // ── Build schema ────────────────────────────────────────────────────────────
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // ── WebSocket server for subscriptions ─────────────────────────────────────
  const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });

  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        const authHeader =
          (ctx.connectionParams?.Authorization as string) ??
          (ctx.connectionParams?.authorization as string);
        const user = await verifyToken(authHeader);
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
        return { user, token, loaders: createLoaders(token) };
      },
    },
    wsServer,
  );

  // ── Apollo Server ───────────────────────────────────────────────────────────
  const server = new ApolloServer<GatewayContext>({
    schema,
    csrfPrevention: true,
    plugins: [
      ApolloServerPluginLandingPageLocalDefault({ footer: false }),
      // Graceful shutdown plugin
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  // ── HTTP middleware ─────────────────────────────────────────────────────────
  app.use(
    '/graphql',
    cors<cors.CorsRequest>({
      origin:      process.env.CORS_ORIGIN?.split(',') ?? '*',
      credentials: true,
    }),
    json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const authHeader = req.headers.authorization;
        const user  = await verifyToken(authHeader);
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
        return {
          user,
          token,
          loaders: createLoaders(token),
        };
      },
    }),
  );

  // ── Health check ────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'gateway', timestamp: new Date().toISOString() });
  });

  // ── Start Kafka bridge ──────────────────────────────────────────────────────
  await startKafkaBridge();

  // ── Listen ──────────────────────────────────────────────────────────────────
  await new Promise<void>((resolve) => {
    httpServer.listen({ port: config.port }, resolve);
  });

  logger.info(`🚀 GraphQL API Gateway ready at http://0.0.0.0:${config.port}/graphql`);
  logger.info(`🔌 WebSocket subscriptions at ws://0.0.0.0:${config.port}/graphql`);

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`[gateway] ${signal} received — shutting down...`);
    await stopKafkaBridge();
    await server.stop();
    httpServer.close(() => {
      logger.info('[gateway] HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(`[gateway] Fatal error: ${err}`);
  process.exit(1);
});
